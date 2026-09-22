import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __limerxPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant dans l'environnement.");
  }
  return new Pool({ connectionString });
}

// En dev, Next.js recharge les modules a chaud : on reutilise le pool via `global`
// pour ne pas epuiser les connexions Postgres a chaque hot-reload.
export const pool = global.__limerxPgPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  global.__limerxPgPool = pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
