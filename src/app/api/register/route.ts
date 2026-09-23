import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "@/lib/db";

const registerSchema = z.object({
  organizationName: z.string().min(2).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  disclaimerAccepted: z.literal(true),
});

export async function POST(req: NextRequest) {
  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides." }, { status: 400 });
  }
  const { organizationName, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT 1 FROM users WHERE email = $1", [normalizedEmail]);
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Un compte existe deja avec cet email." }, { status: 409 });
    }

    const orgResult = await client.query<{ id: string }>(
      "INSERT INTO organizations (name, disclaimer_accepted_at) VALUES ($1, now()) RETURNING id",
      [organizationName]
    );
    const organizationId = orgResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    await client.query(
      `INSERT INTO users (organization_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [organizationId, normalizedEmail, passwordHash]
    );

    // Donne un acces d'essai au domaine de demo public si defini (is_public = true).
    await client.query(
      `INSERT INTO org_domain_access (organization_id, domain_id)
       SELECT $1, id FROM domains WHERE is_public = true
       ON CONFLICT DO NOTHING`,
      [organizationId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Registration error:", err);
    return NextResponse.json({ error: "Erreur serveur lors de l'inscription." }, { status: 500 });
  } finally {
    client.release();
  }
}
