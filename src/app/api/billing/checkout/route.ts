import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { createCheckoutSession } from "@/lib/stripe";

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
  const existingStripeCustomerId = rows[0]?.stripe_customer_id ?? null;

  try {
    const checkoutSession = await createCheckoutSession({
      organizationId: session.user.organizationId,
      customerEmail: session.user.email ?? "",
      existingStripeCustomerId,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe n'a pas renvoye d'URL de paiement.");
    }
    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    return NextResponse.json(
      { error: "Impossible de demarrer le paiement pour le moment." },
      { status: 500 }
    );
  }
}
