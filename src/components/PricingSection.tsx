import Link from "next/link";
import { formatPrice } from "@/lib/format";
import type { PriceInfo } from "@/lib/stripe";

const FEATURES = [
  "Acces illimite a tous les domaines de connaissance",
  "Disponible sur le site web et sur Telegram (WhatsApp bientot)",
  "Reponses toujours a jour avec la derniere version des documents",
  "Essai gratuit de 7 jours, sans engagement",
];

export function PricingSection({ priceInfo }: { priceInfo: PriceInfo | null }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-24">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-lg">
        <div className="grid gap-8 p-8 sm:grid-cols-[1fr_auto] sm:items-center sm:p-12">
          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Essai gratuit 7 jours
            </span>
            <h2 className="mt-3 text-3xl font-bold">Un seul abonnement, acces complet</h2>
            <ul className="mt-5 space-y-2 text-sm text-white/90">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center sm:text-right">
            {priceInfo && (
              <p className="text-5xl font-extrabold">
                {formatPrice(priceInfo.amount, priceInfo.currency)}
                <span className="text-base font-medium text-white/80">
                  {" "}
                  / {priceInfo.interval === "month" ? "mois" : "an"}
                </span>
              </p>
            )}
            <Link
              href="/register"
              className="mt-4 inline-block w-full rounded-lg bg-white px-8 py-3 text-sm font-semibold text-brand-700 shadow transition hover:bg-slate-100 sm:w-auto"
            >
              Essayer gratuitement
            </Link>
            <p className="mt-2 text-xs text-white/70">Carte requise, annulable a tout moment</p>
          </div>
        </div>
      </div>
    </section>
  );
}
