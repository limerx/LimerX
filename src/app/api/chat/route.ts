import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { retrieveRelevantChunks, toChatSources } from "@/lib/rag";
import { generateAnswerStream } from "@/lib/gemini";

export const runtime = "nodejs";

interface ChatRequestBody {
  domainSlug: string;
  question: string;
  conversationId?: string;
}

function sse(event: Record<string, unknown>): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Non authentifie." }), { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const { domainSlug, question } = body;
  if (!domainSlug || !question?.trim()) {
    return new Response(JSON.stringify({ error: "domainSlug et question sont requis." }), {
      status: 400,
    });
  }

  const domainRows = await query<{ id: string; is_public: boolean }>(
    "SELECT id, is_public FROM domains WHERE slug = $1",
    [domainSlug]
  );
  const domain = domainRows[0];
  if (!domain) {
    return new Response(JSON.stringify({ error: "Domaine introuvable." }), { status: 404 });
  }

  if (!domain.is_public) {
    const access = await query(
      "SELECT 1 FROM org_domain_access WHERE organization_id = $1 AND domain_id = $2",
      [session.user.organizationId, domain.id]
    );
    if (access.length === 0) {
      return new Response(
        JSON.stringify({ error: "Votre organisation n'a pas acces a ce domaine." }),
        { status: 403 }
      );
    }
  }

  let conversationId = body.conversationId;
  let history: { role: "user" | "assistant"; content: string }[] = [];

  if (conversationId) {
    const convRows = await query(
      "SELECT 1 FROM conversations WHERE id = $1 AND organization_id = $2",
      [conversationId, session.user.organizationId]
    );
    if (convRows.length === 0) {
      return new Response(JSON.stringify({ error: "Conversation introuvable." }), { status: 404 });
    }
    const pastMessages = await query<{ role: "user" | "assistant"; content: string }>(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 20",
      [conversationId]
    );
    history = pastMessages;
  } else {
    const created = await query<{ id: string }>(
      `INSERT INTO conversations (organization_id, user_id, domain_id, title)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [session.user.organizationId, session.user.id, domain.id, question.slice(0, 80)]
    );
    conversationId = created[0].id;
  }

  await query(
    "INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)",
    [conversationId, question]
  );

  const relevantChunks = await retrieveRelevantChunks(domain.id, question);
  const sources = toChatSources(relevantChunks);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          sse({
            type: "sources",
            conversationId,
            sources: relevantChunks.map((c) => ({
              articleRef: c.articleRef,
              pageNumber: c.pageNumber,
              excerpt: c.content.slice(0, 240),
            })),
          })
        )
      );

      let fullText = "";
      try {
        for await (const piece of generateAnswerStream(question, sources, history)) {
          fullText += piece;
          controller.enqueue(encoder.encode(sse({ type: "chunk", text: piece })));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sse({ type: "error", message: "Erreur lors de la generation de la reponse." })
          )
        );
        console.error("generateAnswerStream error:", err);
      }

      await query(
        "INSERT INTO messages (conversation_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)",
        [
          conversationId,
          fullText,
          JSON.stringify(
            relevantChunks.map((c) => ({
              articleRef: c.articleRef,
              pageNumber: c.pageNumber,
              excerpt: c.content.slice(0, 240),
            }))
          ),
        ]
      );

      controller.enqueue(encoder.encode(sse({ type: "done", conversationId })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
