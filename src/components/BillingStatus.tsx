"use client";

import { useState } from "react";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Essai gratuit en cours",
  active: "Abonnement actif",
  past_due: "Paiement en retard",
  canceled: "Abonnement annule",
  unpaid: "Impaye",
};

export function BillingStatus({ status }: { status: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEverSubscribed = status !== null;
  const isUsable = status === "trialing" || status === "active";

  async function goTo(endpoint: "checkout" | "portal") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/${endpoint}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Erreur inconnue.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {hasEverSubscribed && (
        <span
          className={`text-sm ${isUsable ? "text-emerald-600" : "text-amber-600"}`}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      )}
      {hasEverSubscribed ? (
        <button
          onClick={() => goTo("portal")}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "..." : "Gerer l'abonnement"}
        </button>
      ) : (
        <button
          onClick={() => goTo("checkout")}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "..." : "Demarrer mon essai gratuit (7 jours)"}
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
