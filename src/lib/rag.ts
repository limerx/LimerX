import { query } from "@/lib/db";
import { embedText, type ChatSource } from "@/lib/gemini";

export interface RetrievedChunk {
  id: string;
  content: string;
  articleRef: string | null;
  pageNumber: number | null;
  distance: number;
}

const TOP_K = 6;
// Distance cosine (pgvector) : 0 = identique, 2 = oppose. On ecarte les extraits
// trop peu pertinents plutot que de forcer le modele a repondre hors-sujet.
const MAX_DISTANCE = 0.6;

export async function retrieveRelevantChunks(
  domainId: string,
  userQuestion: string
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(userQuestion, "RETRIEVAL_QUERY");
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  const rows = await query<{
    id: string;
    content: string;
    article_ref: string | null;
    page_number: number | null;
    distance: number;
  }>(
    `SELECT id, content, article_ref, page_number, embedding <=> $1::vector AS distance
     FROM chunks
     WHERE domain_id = $2
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $3`,
    [vectorLiteral, domainId, TOP_K]
  );

  return rows
    .filter((r) => r.distance <= MAX_DISTANCE)
    .map((r) => ({
      id: r.id,
      content: r.content,
      articleRef: r.article_ref,
      pageNumber: r.page_number,
      distance: r.distance,
    }));
}

export function toChatSources(chunks: RetrievedChunk[]): ChatSource[] {
  return chunks.map((c) => ({
    articleRef: c.articleRef,
    pageNumber: c.pageNumber,
    excerpt: c.content,
  }));
}

// Correspond au chemin ecrit par scripts/ingest.ts (public/norm-pages/<domaine>/<page>.png),
// servi tel quel par Next.js depuis public/.
export function pageImageUrl(domainSlug: string, pageNumber: number | null): string | null {
  if (!pageNumber) return null;
  return `/norm-pages/${domainSlug}/${pageNumber}.png`;
}
