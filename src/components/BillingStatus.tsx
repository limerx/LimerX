"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { PriceInfo } from "@/lib/stripe";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Essai gratuit en cours",
  active: "Abonnement actif",
  past_due: "Paiement en retard",
  canceled: "Abonnement annule",
  unpaid: "Impaye",
};

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
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">Aucun abonnement actif</p>
          <p className="text-sm text-slate-600">
            Demarrez votre essai gratuit de 7 jours
            {priceInfo && (
              <>
                {" "}
                ({formatPrice(priceInfo.amount, priceInfo.currency)} /{" "}
                {priceInfo.interval === "month" ? "mois" : "an"} ensuite)
              </>
            )}
            .
          </p>
        </div>
        <button
          onClick={() => goTo("checkout")}
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "..." : "Demarrer mon essai gratuit"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
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
