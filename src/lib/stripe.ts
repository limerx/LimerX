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

export interface PriceInfo {
  amount: number; // en unite principale (ex: 49 pour 49,00 EUR), pas en centimes
  currency: string; // ex: 'eur'
  interval: string; // ex: 'month', 'year'
}

// Prix affiche sur le dashboard, lu directement depuis Stripe : evite de dupliquer/desynchroniser
// le tarif entre le dashboard Stripe et le code si le prix change.
export async function getPublicPriceInfo(): Promise<PriceInfo | null> {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return null;

  try {
    const price = await getStripe().prices.retrieve(priceId);
    if (price.unit_amount == null || !price.recurring) return null;
    return {
      amount: price.unit_amount / 100,
      currency: price.currency,
      interval: price.recurring.interval,
    };
  } catch (err) {
    console.error("getPublicPriceInfo error:", err);
    return null;
  }
}
