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
const REDACT_PADDING_PX = 22;

// Marqueurs textuels des encadres publicitaires/commerciaux a effacer des images de page
// (motif observe dans ce guide fabricant : encadres "XXX recommande", liens vers un
// flipbook produit). Etendre via --redact=motif1,motif2 si d'autres motifs apparaissent
// sur d'autres pages une fois testees.
const DEFAULT_REDACT_MARKERS = [/\bschneider\s*electric\s*recommande\b/i, /flipbook\.se\.com/i];

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
      "Usage: npm run ingest -- --file=<chemin.pdf> --domain=<slug> [--title=\"...\"] [--version=\"...\"] " +
        "[--crop-bottom=0.04] [--redact=motif1,motif2]"
    );
    process.exit(1);
  }
  const cropBottomArg = args.get("crop-bottom");
  const cropBottom = cropBottomArg !== undefined ? Number(cropBottomArg) : 0.04;
  if (Number.isNaN(cropBottom) || cropBottom < 0 || cropBottom >= 1) {
    throw new Error("--crop-bottom doit etre un nombre entre 0 et 1 (ex: 0.04 pour 4%).");
  }
  const extraRedactArg = args.get("redact");
  const redactMarkers = [
    ...DEFAULT_REDACT_MARKERS,
    ...(extraRedactArg ? extraRedactArg.split(",").map((m) => new RegExp(m.trim(), "i")) : []),
  ];
  return {
    file,
    domain,
    title: args.get("title") ?? null,
    version: args.get("version") ?? null,
    cropBottom,
    redactMarkers,
  };
}

interface PdfTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

async function extractPagesAndRenderImages(
  buffer: Buffer,
  imageOutDir: string,
  cropBottomRatio: number,
  redactMarkers: RegExp[]
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
    const viewport = page.getViewport({ scale: PAGE_IMAGE_SCALE });
    const fullWidth = Math.ceil(viewport.width);
    const fullHeight = Math.ceil(viewport.height);

    const textContent = await page.getTextContent();
    const items = textContent.items as PdfTextItem[];

    // Les items dont le texte matche un marqueur publicitaire/commercial sont exclus du
    // texte indexe (pour ne pas polluer les reponses du chatbot avec du contenu marketing)
    // ET localises pour etre effaces de l'image de page rendue plus bas.
    const keptStrings: string[] = [];
    const redactionBandsPx: { top: number; bottom: number }[] = [];

    for (const item of items) {
      const str = item.str ?? "";
      const isAd = redactMarkers.some((re) => re.test(str));
      if (isAd) {
        if (item.transform && item.transform.length >= 6) {
          const x0 = item.transform[4];
          const y0 = item.transform[5];
          const w = item.width ?? 10;
          const h = item.height ?? 10;
          const p1 = viewport.convertToViewportPoint(x0, y0 + h);
          const p2 = viewport.convertToViewportPoint(x0 + w, y0);
          const top = Math.min(p1[1], p2[1]) - REDACT_PADDING_PX;
          const bottom = Math.max(p1[1], p2[1]) + REDACT_PADDING_PX;
          redactionBandsPx.push({ top, bottom });
        }
      } else {
        keptStrings.push(str);
      }
    }
    pages.push({ pageNumber, text: keptStrings.join(" ") });

    const canvas = createCanvas(fullWidth, fullHeight);
    const ctx = canvas.getContext("2d");
    // @napi-rs/canvas n'implemente pas exactement les types DOM Canvas/CanvasRenderingContext2D
    // que pdfjs-dist attend - sans consequence a l'execution (rendu valide, teste manuellement).
    await page.render({ canvasContext: ctx, canvas, viewport } as never).promise;

    // Efface (bande blanche pleine largeur) chaque zone publicitaire detectee, ou qu'elle
    // soit sur la page - pas seulement en bas (encadres "XXX recommande" au milieu de page,
    // bandeaux produits en pied de page, etc.)
    ctx.fillStyle = "white";
    for (const band of redactionBandsPx) {
      const top = Math.max(0, band.top);
      const bottom = Math.min(fullHeight, band.bottom);
      if (bottom > top) ctx.fillRect(0, top, fullWidth, bottom - top);
    }

    // Rogne en plus le tout dernier bas de page (numero de page / mention legale du document
    // source) : pourcentage modeste, la detection par marqueurs ci-dessus fait le plus gros du
    // travail. Ajuster --crop-bottom si necessaire.
    const croppedHeight = Math.max(1, Math.round(fullHeight * (1 - cropBottomRatio)));
    const finalCanvas = createCanvas(fullWidth, croppedHeight);
    finalCanvas.getContext("2d").drawImage(canvas, 0, 0);
    writeFileSync(join(imageOutDir, `${pageNumber}.png`), finalCanvas.toBuffer("image/png"));
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
  const { file, domain, title, version, cropBottom, redactMarkers } = parseArgs();
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
    const pages = await extractPagesAndRenderImages(buffer, imageOutDir, cropBottom, redactMarkers);
    console.log(
      `${pages.length} pages extraites et rendues en image (${imageOutDir}, ${Math.round(cropBottom * 100)}% rogne en bas).`
    );

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
