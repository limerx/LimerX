"use client";

import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Essai gratuit en cours",
  active: "Abonnement actif",
  past_due: "Paiement en retard",
  canceled: "Abonnement annule",
  unpaid: "Impaye",
};

const FEATURES = [
  "Acces illimite a tous les domaines de connaissance",
  "Disponible sur le site web et sur Telegram (WhatsApp bientot)",
  "Reponses toujours a jour avec la derniere version des documents",
];

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export interface PriceInfo {
  amount: number;
  currency: string;
  interval: string;
}

function useBillingAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goTo(endpoint: "checkout" | "portal") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Erreur inconnue.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return { loading, error, goTo };
}

export function BillingStatus({
  status,
  priceInfo,
}: {
  status: string | null;
  priceInfo: PriceInfo | null;
}) {
  const { loading, error, goTo } = useBillingAction();

  const isProblem = status === "past_due" || status === "unpaid" || status === "canceled";

  if (status === null) {
    return (
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 text-white shadow-lg">
        <div className="grid gap-8 p-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              Essai gratuit 7 jours
            </span>
            <h2 className="mt-3 text-2xl font-bold">Debloquez l&apos;acces complet</h2>
            <ul className="mt-4 space-y-2 text-sm text-white/90">
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
              <p className="text-4xl font-extrabold">
                {formatPrice(priceInfo.amount, priceInfo.currency)}
                <span className="text-base font-medium text-white/80">
                  {" "}
                  / {priceInfo.interval === "month" ? "mois" : "an"}
                </span>
              </p>
            )}
            <button
              onClick={() => goTo("checkout")}
              disabled={loading}
              className="mt-4 w-full rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow transition hover:bg-slate-100 disabled:opacity-50 sm:w-auto"
            >
              {loading ? "..." : "Demarrer mon essai gratuit"}
            </button>
            <p className="mt-2 text-xs text-white/70">Sans engagement, annulable a tout moment</p>
          </div>
        </div>
        {error && <p className="bg-red-500/20 px-8 py-2 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${
        isProblem ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${
            isProblem ? "bg-amber-400 text-white" : "bg-emerald-500 text-white"
          }`}
        >
          {isProblem ? "!" : "✓"}
        </span>
        <div>
          <p className={`font-semibold ${isProblem ? "text-amber-800" : "text-emerald-800"}`}>
            {STATUS_LABELS[status] ?? status}
          </p>
          {isProblem && (
            <p className="text-sm text-amber-700">
              Mettez a jour votre moyen de paiement pour conserver l&apos;acces.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => goTo("portal")}
        disabled={loading}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {loading ? "..." : "Gerer l'abonnement"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
