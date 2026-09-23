// Next.js charge automatiquement .env.local, mais les scripts CLI (tsx) executes
// en dehors de Next.js ne le font pas par defaut : dotenv/config ne lit que `.env`.
// On charge .env.local en priorite (convention utilisee dans ce projet), avec repli sur .env.
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envLocalPath = resolve(process.cwd(), ".env.local");
const envPath = resolve(process.cwd(), ".env");

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
} else if (existsSync(envPath)) {
  config({ path: envPath });
}
