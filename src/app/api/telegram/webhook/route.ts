import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { retrieveRelevantChunks, toChatSources } from "@/lib/rag";
import { generateAnswer } from "@/lib/gemini";
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

const DEFAULT_DOMAIN_SLUG = process.env.TELEGRAM_DEFAULT_DOMAIN ?? "nf-c15-100";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const WELCOME_MESSAGE =
  "Bonjour ! Je suis l'assistant expert de la norme NF C15-100. " +
  "Posez-moi une question (ex: \"quelle section minimale pour un circuit prise 16A ?\") " +
  "et je vous reponds en citant l'article de la norme concerne.\n\n" +
  "Cette reponse est une aide a la comprehension de la norme, elle ne remplace pas " +
  "la validation d'un electricien qualifie ou d'un organisme de controle agree.";

async function getOrCreateConversation(chatId: number): Promise<string | null> {
  const existing = await query<{ domain_id: string }>(
    "SELECT domain_id FROM telegram_conversations WHERE chat_id = $1",
    [chatId]
  );
  if (existing[0]) return existing[0].domain_id;

  const domainRows = await query<{ id: string }>("SELECT id FROM domains WHERE slug = $1", [
    DEFAULT_DOMAIN_SLUG,
  ]);
  const domain = domainRows[0];
  if (!domain) return null;

  await query("INSERT INTO telegram_conversations (chat_id, domain_id) VALUES ($1, $2)", [
    chatId,
    domain.id,
  ]);
  return domain.id;
}

function formatReply(answer: string, sources: { articleRef: string | null; pageNumber: number | null }[]) {
  const cited = sources.filter((s) => s.articleRef || s.pageNumber);
  if (cited.length === 0) return answer;

  const footer = cited
    .map((s) => {
      const ref = s.articleRef ? `Article ${s.articleRef}` : "Extrait";
      const page = s.pageNumber ? ` (page ${s.pageNumber})` : "";
      return `- ${ref}${page}`;
    })
    .join("\n");

  return `${answer}\n\n📖 Sources :\n${footer}`;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;
  const message = update.message;

  // Telegram attend un 200 rapide ; on ignore silencieusement ce qu'on ne traite pas
  // (messages edites, non textuels, etc.) plutot que de renvoyer une erreur.
  if (!message?.text || !message.chat) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  try {
    if (text === "/start") {
      await getOrCreateConversation(chatId);
      await sendTelegramMessage(chatId, WELCOME_MESSAGE);
      return NextResponse.json({ ok: true });
    }

    const domainId = await getOrCreateConversation(chatId);
    if (!domainId) {
      await sendTelegramMessage(
        chatId,
        "Le service n'est pas encore configure (domaine par defaut introuvable). Contactez l'administrateur."
      );
      return NextResponse.json({ ok: true });
    }

    await sendTelegramChatAction(chatId, "typing");

    const history = await query<{ role: "user" | "assistant"; content: string }>(
      "SELECT role, content FROM telegram_messages WHERE chat_id = $1 ORDER BY created_at ASC LIMIT 20",
      [chatId]
    );

    await query(
      "INSERT INTO telegram_messages (chat_id, role, content) VALUES ($1, 'user', $2)",
      [chatId, text]
    );

    const relevantChunks = await retrieveRelevantChunks(domainId, text);
    const sources = toChatSources(relevantChunks);
    const answer = await generateAnswer(text, sources, history);

    await query(
      "INSERT INTO telegram_messages (chat_id, role, content, sources) VALUES ($1, 'assistant', $2, $3)",
      [
        chatId,
        answer,
        JSON.stringify(
          relevantChunks.map((c) => ({ articleRef: c.articleRef, pageNumber: c.pageNumber }))
        ),
      ]
    );

    await sendTelegramMessage(chatId, formatReply(answer, sources));
  } catch (err) {
    console.error("Telegram webhook error:", err);
    await sendTelegramMessage(chatId, "Une erreur est survenue. Reessayez dans un instant.").catch(
      () => {}
    );
    if (ADMIN_CHAT_ID) {
      await sendTelegramMessage(
        Number(ADMIN_CHAT_ID),
        `Erreur bot Telegram (chat ${chatId}): ${(err as Error).message}`
      ).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
