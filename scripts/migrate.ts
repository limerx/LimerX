import "./load-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL manquant dans l'environnement (.env.local ou .env).");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf-8");
    console.log("Application du schema...");
    await client.query(schema);

    const seed = readFileSync(join(process.cwd(), "db", "seed.sql"), "utf-8");
    console.log("Application des donnees initiales (seed)...");
    await client.query(seed);

    console.log("Migration terminee avec succes.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Echec de la migration:", err);
  process.exit(1);
});
