import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY manquant dans l'environnement.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

const TRIAL_PERIOD_DAYS = 7;

export async function createCheckoutSession(params: {
  organizationId: string;
  customerEmail: string;
  existingStripeCustomerId: string | null;
}) {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID manquant dans l'environnement.");

  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: TRIAL_PERIOD_DAYS,
      metadata: { organizationId: params.organizationId },
    },
    metadata: { organizationId: params.organizationId },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/dashboard?checkout=cancelled`,
    ...(params.existingStripeCustomerId
      ? { customer: params.existingStripeCustomerId }
      : { customer_email: params.customerEmail }),
  });

  return session;
}

export async function createPortalSession(stripeCustomerId: string) {
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  });

  return session;
}

export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET manquant dans l'environnement.");
  return getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
}

// Statuts Stripe consideres comme donnant droit a l'usage du produit.
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);
