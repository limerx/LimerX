/**
 * Enregistre l'URL de webhook aupres de l'API Telegram.
 * A executer une fois que l'app est deployee sur une URL HTTPS publique.
 *
 * Usage: npm run telegram:set-webhook
 * (lit TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL, TELEGRAM_WEBHOOK_SECRET depuis .env.local)
 */
import "./load-env";
import { setTelegramWebhook } from "../src/lib/telegram";

async function main() {
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!url) {
    throw new Error(
      "TELEGRAM_WEBHOOK_URL manquant. Renseigner l'URL HTTPS publique de l'app, ex: https://mon-app.vercel.app/api/telegram/webhook"
    );
  }
  if (!secret) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET manquant.");
  }

  const result = await setTelegramWebhook(url, secret);
  console.log(JSON.stringify(result, null, 2));

  if (!result.ok) {
    process.exit(1);
  }
  console.log(`Webhook enregistre avec succes sur ${url}`);
}

main().catch((err) => {
  console.error("Echec:", err);
  process.exit(1);
});
