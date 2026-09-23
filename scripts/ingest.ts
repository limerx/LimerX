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
 */
import "./load-env";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error - pdf-parse n'a pas de types ESM propres pour cet import direct
import pdfParse from "pdf-parse/lib/pdf-parse.js";
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

async function extractPages(buffer: Buffer): Promise<PageText[]> {
  const pages: PageText[] = [];
  let pageNumber = 0;

  await pdfParse(buffer, {
    // pdf-parse appelle pagerender pour chaque page ; on capture le texte par page
    // (par defaut la librairie ne renvoie qu'un texte global concatene).
    pagerender: async (pageData: {
      getTextContent: () => Promise<{ items: { str: string }[] }>;
    }) => {
      pageNumber += 1;
      const content = await pageData.getTextContent();
      const text = content.items.map((item) => item.str).join(" ");
      pages.push({ pageNumber, text });
      return text;
    },
  });

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

    console.log("Extraction du texte par page...");
    const pages = await extractPages(buffer);
    console.log(`${pages.length} pages extraites.`);

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
