import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { createPortalSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }

  const rows = await query<{ stripe_customer_id: string | null }>(
    "SELECT stripe_customer_id FROM organizations WHERE id = $1",
    [session.user.organizationId]
  );
  const stripeCustomerId = rows[0]?.stripe_customer_id;
  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "Aucun abonnement associe a ce compte pour le moment." },
      { status: 400 }
    );
  }

  try {
    const portalSession = await createPortalSession(stripeCustomerId);
    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return NextResponse.json(
      { error: "Impossible d'ouvrir la gestion de l'abonnement pour le moment." },
      { status: 500 }
    );
  }
}
