const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

const TELEGRAM_MESSAGE_LIMIT = 4000; // marge sous la limite reelle de 4096 caracteres

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
  };
}

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > TELEGRAM_MESSAGE_LIMIT) {
    let cut = rest.lastIndexOf("\n", TELEGRAM_MESSAGE_LIMIT);
    if (cut <= 0) cut = TELEGRAM_MESSAGE_LIMIT;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  if (!API_BASE) throw new Error("TELEGRAM_BOT_TOKEN manquant dans l'environnement.");

  for (const part of splitMessage(text)) {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: part }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram sendMessage error:", res.status, body);
    }
  }
}

export async function sendTelegramChatAction(chatId: number, action: "typing"): Promise<void> {
  if (!API_BASE) return;
  await fetch(`${API_BASE}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action }),
  }).catch(() => {});
}

export async function setTelegramWebhook(url: string, secretToken: string) {
  if (!API_BASE) throw new Error("TELEGRAM_BOT_TOKEN manquant dans l'environnement.");
  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, secret_token: secretToken }),
  });
  return res.json();
}

export async function getTelegramMe() {
  if (!API_BASE) throw new Error("TELEGRAM_BOT_TOKEN manquant dans l'environnement.");
  const res = await fetch(`${API_BASE}/getMe`);
  return res.json();
}
