import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { query } from "@/lib/db";
import { constructWebhookEvent, getStripe, ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/stripe";
import { syncOrgDomainAccess } from "@/lib/billing";

export const runtime = "nodejs";

async function applySubscriptionStatus(stripeCustomerId: string, subscription: Stripe.Subscription) {
  const rows = await query<{ id: string }>(
    "SELECT id FROM organizations WHERE stripe_customer_id = $1",
    [stripeCustomerId]
  );
  const org = rows[0];
  if (!org) {
    console.error("Webhook Stripe: aucune organisation pour le customer", stripeCustomerId);
    return;
  }

  await query(
    "UPDATE organizations SET subscription_status = $1, stripe_subscription_id = $2 WHERE id = $3",
    [subscription.status, subscription.id, org.id]
  );
  await syncOrgDomainAccess(org.id, ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    console.error("Signature webhook Stripe invalide:", err);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organizationId;
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!organizationId || !customerId || !subscriptionId) {
          console.error("checkout.session.completed incomplet:", session.id);
          break;
        }

        await query(
          "UPDATE organizations SET stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3",
          [customerId, subscriptionId, organizationId]
        );

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await query("UPDATE organizations SET subscription_status = $1 WHERE id = $2", [
          subscription.status,
          organizationId,
        ]);
        await syncOrgDomainAccess(organizationId, ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        await applySubscriptionStatus(customerId, subscription);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Erreur traitement webhook Stripe:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
