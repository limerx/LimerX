import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const CODE_TTL_MINUTES = 10;

function generateCode(): string {
  // Alphabet sans caracteres ambigus (0/O, 1/I/l) pour une saisie manuelle fiable.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_USERNAME non configure cote serveur." },
      { status: 500 }
    );
  }

  const code = generateCode();
  await query(
    `INSERT INTO telegram_link_codes (code, organization_id, expires_at)
     VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [code, session.user.organizationId, CODE_TTL_MINUTES]
  );

  return NextResponse.json({
    code,
    deepLink: `https://t.me/${botUsername}?start=${code}`,
    expiresInMinutes: CODE_TTL_MINUTES,
  });
}
