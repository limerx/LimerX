/**
 * Script d'ingestion d'un PDF (norme, DTU, etc.) dans un domaine de connaissance.
 *
 * Usage :
 *   npm run ingest -- --file=./data/sources/nf-c15-100.pdf --domain=nf-c15-100 \
 *     --title="NF C15-100" --version="Amendement A5 2020"
 *
 * Le decoupage tente de detecter les references d'article de la norme
 * (motif "411.3.3", "701.1.2", ...) pour que le chatbot puisse citer ses sources
 * precisement. Si le PDF a une structure differente, ajuster ARTICLE_REGEX ci-dessous.
 *
 * Chaque page est aussi rendue en image (PNG) sous public/norm-pages/<domaine>/<page>.png,
 * pour que le chat puisse renvoyer vers le schema/diagramme original (les normes techniques
 * contiennent souvent des tableaux et diagrammes que le texte seul ne restitue pas).
 */
import "./load-env";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { Client } from "pg";
import { embedTexts } from "../src/lib/gemini";

interface PageText {
  pageNumber: number;
  text: string;
}

interface Chunk {
  content: string;
  articleRef: string | null;
  pageNumber: number;
}

const ARTICLE_REGEX = /(?:^|\n)\s*(\d{2,3}(?:\.\d{1,3}){1,4})\b/g;
const CHUNK_SIZE = 1100;
const CHUNK_OVERLAP = 150;
const PAGE_IMAGE_SCALE = 2;

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args.set(match[1], match[2]);
  }
  const file = args.get("file");
  const domain = args.get("domain");
  if (!file || !domain) {
    console.error(
      "Usage: npm run ingest -- --file=<chemin.pdf> --domain=<slug> [--title=\"...\"] [--version=\"...\"]"
    );
    process.exit(1);
  }
  return {
    file,
    domain,
    title: args.get("title") ?? null,
    version: args.get("version") ?? null,
  };
}

async function extractPagesAndRenderImages(
  buffer: Buffer,
  imageOutDir: string
): Promise<PageText[]> {
  const pdfjsDistRoot = join(process.cwd(), "node_modules", "pdfjs-dist");
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    standardFontDataUrl: join(pdfjsDistRoot, "standard_fonts") + "/",
    cMapUrl: join(pdfjsDistRoot, "cmaps") + "/",
    cMapPacked: true,
  }).promise;

  mkdirSync(imageOutDir, { recursive: true });

  const pages: PageText[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);

    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: unknown) => (item as { str?: string }).str ?? "")
      .join(" ");
    pages.push({ pageNumber, text });

    const viewport = page.getViewport({ scale: PAGE_IMAGE_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    // @napi-rs/canvas n'implemente pas exactement les types DOM Canvas/CanvasRenderingContext2D
    // que pdfjs-dist attend - sans consequence a l'execution (rendu valide, teste manuellement).
    await page.render({ canvasContext: ctx, canvas, viewport } as never).promise;
    writeFileSync(join(imageOutDir, `${pageNumber}.png`), canvas.toBuffer("image/png"));
  }

  return pages;
}

function splitWithOverlap(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    out.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return out;
}

function chunkPage(page: PageText): Chunk[] {
  const text = page.text.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const matches = [...text.matchAll(ARTICLE_REGEX)];
  if (matches.length === 0) {
    return splitWithOverlap(text).map((content) => ({
      content,
      articleRef: null,
      pageNumber: page.pageNumber,
    }));
  }

  const segments: { articleRef: string; content: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    segments.push({ articleRef: matches[i][1], content: text.slice(start, end).trim() });
  }

  const chunks: Chunk[] = [];
  for (const seg of segments) {
    for (const content of splitWithOverlap(seg.content)) {
      chunks.push({ content, articleRef: seg.articleRef, pageNumber: page.pageNumber });
    }
  }
  return chunks;
}

async function main() {
  const { file, domain, title, version } = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL manquant dans l'environnement.");

  console.log(`Lecture du fichier ${file}...`);
  const buffer = readFileSync(file);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const domainRows = await client.query<{ id: string }>(
      "SELECT id FROM domains WHERE slug = $1",
      [domain]
    );
    if (domainRows.rowCount === 0) {
      throw new Error(
        `Domaine '${domain}' introuvable. Cree-le d'abord (voir db/seed.sql ou INSERT INTO domains ...).`
      );
    }
    const domainId = domainRows.rows[0].id;

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM documents WHERE domain_id = $1 AND checksum = $2",
      [domainId, checksum]
    );
    if ((existing.rowCount ?? 0) > 0) {
      console.log("Ce fichier (meme checksum) a deja ete ingere pour ce domaine. Rien a faire.");
      return;
    }

    console.log("Extraction du texte et rendu des pages en image...");
    // Les images sont rangees par domaine (pas par document) : suffisant pour le cas
    // d'un document principal par domaine. Avec plusieurs documents dans un meme domaine,
    // les numeros de page des differents PDF peuvent se recouvrir et s'ecraser - a revoir
    // si ce cas se presente (ranger par document_id demanderait de creer la ligne
    // `documents` avant l'extraction).
    const imageOutDir = join(process.cwd(), "public", "norm-pages", domain);
    const pages = await extractPagesAndRenderImages(buffer, imageOutDir);
    console.log(`${pages.length} pages extraites et rendues en image (${imageOutDir}).`);

    console.log("Decoupage en chunks...");
    const chunks = pages.flatMap(chunkPage);
    console.log(`${chunks.length} chunks produits.`);

    if (chunks.length === 0) {
      throw new Error("Aucun texte exploitable extrait du PDF (PDF scanne sans OCR ?).");
    }

    // Transaction : si le calcul des embeddings echoue en cours de route (cle API
    // invalide, quota, coupure reseau...), on ne doit garder ni le document ni les
    // chunks partiels - sinon le checksum bloque toute re-tentative sur un document
    // "fantome" sans aucun contenu exploitable.
    await client.query("BEGIN");
    try {
      const docResult = await client.query<{ id: string }>(
        `INSERT INTO documents (domain_id, filename, title, version_label, page_count, checksum)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [domainId, file.split("/").pop(), title, version, pages.length, checksum]
      );
      const documentId = docResult.rows[0].id;

      console.log("Calcul des embeddings (Gemini)... cela peut prendre plusieurs minutes.");
      const EMBED_BATCH = 50;
      for (let i = 0; i < chunks.length; i += EMBED_BATCH) {
        const batch = chunks.slice(i, i + EMBED_BATCH);
        const embeddings = await embedTexts(
          batch.map((c) => c.content),
          "RETRIEVAL_DOCUMENT"
        );

        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const vectorLiteral = `[${embeddings[j].join(",")}]`;
          await client.query(
            `INSERT INTO chunks (document_id, domain_id, content, article_ref, page_number, chunk_index, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
            [documentId, domainId, chunk.content, chunk.articleRef, chunk.pageNumber, i + j, vectorLiteral]
          );
        }
        console.log(`  ${Math.min(i + EMBED_BATCH, chunks.length)}/${chunks.length} chunks indexes`);
      }

      await client.query("COMMIT");
      console.log(`Ingestion terminee : document ${documentId} (${chunks.length} chunks) dans le domaine '${domain}'.`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Echec de l'ingestion:", err);
  process.exit(1);
});
