import { existsSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { retrieveRelevantChunks, toChatSources } from "@/lib/rag";
import { generateAnswer } from "@/lib/gemini";
import {
  sendTelegramMessage,
  sendTelegramChatAction,
  sendTelegramPhoto,
  type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";

const DEFAULT_DOMAIN_SLUG = process.env.TELEGRAM_DEFAULT_DOMAIN ?? "nf-c15-100";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

const WELCOME_MESSAGE =
  "Bonjour ! Je suis l'assistant expert de la norme NF C15-100. " +
  "Posez-moi une question (ex: \"quelle section minimale pour un circuit prise 16A ?\").\n\n" +
  "Important : mes reponses sont une aide a la comprehension de la norme, elles ne remplacent " +
  "pas la validation d'un electricien qualifie ou d'un organisme de controle agree.";

const NOT_LINKED_MESSAGE =
  "Ce domaine necessite un compte relie. Connectez-vous sur le site puis, depuis votre " +
  `tableau de bord (${APP_URL}/dashboard), generez un code de liaison Telegram.`;

const NO_ACCESS_MESSAGE =
  `Votre compte n'a pas (ou plus) d'abonnement actif. Rendez-vous sur ${APP_URL}/dashboard ` +
  "pour demarrer ou reactiver votre abonnement.";

interface ConversationState {
  domainId: string;
  domainSlug: string;
  isPublic: boolean;
  organizationId: string | null;
}

async function getOrCreateConversation(chatId: number): Promise<ConversationState | null> {
  const existing = await query<{
    domain_id: string;
    slug: string;
    is_public: boolean;
    organization_id: string | null;
  }>(
    `SELECT tc.domain_id, d.slug, d.is_public, tc.organization_id
     FROM telegram_conversations tc
     JOIN domains d ON d.id = tc.domain_id
     WHERE tc.chat_id = $1`,
    [chatId]
  );
  if (existing[0]) {
    return {
      domainId: existing[0].domain_id,
      domainSlug: existing[0].slug,
      isPublic: existing[0].is_public,
      organizationId: existing[0].organization_id,
    };
  }

  const domainRows = await query<{ id: string; slug: string; is_public: boolean }>(
    "SELECT id, slug, is_public FROM domains WHERE slug = $1",
    [DEFAULT_DOMAIN_SLUG]
  );
  const domain = domainRows[0];
  if (!domain) return null;

  await query("INSERT INTO telegram_conversations (chat_id, domain_id) VALUES ($1, $2)", [
    chatId,
    domain.id,
  ]);
  return { domainId: domain.id, domainSlug: domain.slug, isPublic: domain.is_public, organizationId: null };
}

async function hasDomainAccess(organizationId: string, domainId: string): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM org_domain_access WHERE organization_id = $1 AND domain_id = $2",
    [organizationId, domainId]
  );
  return rows.length > 0;
}

async function linkChatToOrganization(chatId: number, code: string): Promise<string | null> {
  const rows = await query<{ organization_id: string }>(
    `SELECT organization_id FROM telegram_link_codes
     WHERE code = $1 AND used_at IS NULL AND expires_at > now()`,
    [code]
  );
  const link = rows[0];
  if (!link) return null;

  await query("UPDATE telegram_link_codes SET used_at = now() WHERE code = $1", [code]);
  await query("UPDATE telegram_conversations SET organization_id = $1 WHERE chat_id = $2", [
    link.organization_id,
    chatId,
  ]);
  return link.organization_id;
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
    if (text.startsWith("/start")) {
      const conversation = await getOrCreateConversation(chatId);
      const code = text.slice("/start".length).trim();

      if (code) {
        const organizationId = await linkChatToOrganization(chatId, code);
        if (organizationId) {
          await sendTelegramMessage(
            chatId,
            "Compte relie avec succes ! Vous pouvez maintenant poser vos questions ici."
          );
        } else {
          await sendTelegramMessage(
            chatId,
            "Ce code de liaison est invalide ou a expire. Generez-en un nouveau depuis votre tableau de bord."
          );
        }
      } else {
        await sendTelegramMessage(chatId, WELCOME_MESSAGE);
        if (conversation && !conversation.isPublic) {
          await sendTelegramMessage(chatId, NOT_LINKED_MESSAGE);
        }
      }
      return NextResponse.json({ ok: true });
    }

    const conversation = await getOrCreateConversation(chatId);
    if (!conversation) {
      await sendTelegramMessage(
        chatId,
        "Le service n'est pas encore configure (domaine par defaut introuvable). Contactez l'administrateur."
      );
      return NextResponse.json({ ok: true });
    }
    const { domainId, domainSlug, isPublic, organizationId } = conversation;

    if (!isPublic) {
      if (!organizationId) {
        await sendTelegramMessage(chatId, NOT_LINKED_MESSAGE);
        return NextResponse.json({ ok: true });
      }
      const allowed = await hasDomainAccess(organizationId, domainId);
      if (!allowed) {
        await sendTelegramMessage(chatId, NO_ACCESS_MESSAGE);
        return NextResponse.json({ ok: true });
      }
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

    await sendTelegramMessage(chatId, answer);

    // Jusqu'a 2 pages uniques envoyees en photo (schemas/tableaux que le texte seul ne rend pas).
    const uniquePages = Array.from(new Set(relevantChunks.map((c) => c.pageNumber).filter(Boolean)));
    for (const pageNumber of uniquePages.slice(0, 2)) {
      const imagePath = join(process.cwd(), "public", "norm-pages", domainSlug, `${pageNumber}.png`);
      if (existsSync(imagePath)) {
        await sendTelegramPhoto(chatId, imagePath, `Page ${pageNumber}`).catch((err) =>
          console.error("sendTelegramPhoto error:", err)
        );
      }
    }
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
