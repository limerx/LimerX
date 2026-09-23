"use client";

import { useState } from "react";

export function TelegramLinkCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; deepLink: string } | null>(null);

  async function generateCode() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/link-code", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue.");
      setResult({ code: data.code, deepLink: data.deepLink });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Utiliser le bot sur Telegram</h2>
      <p className="mt-1 text-sm text-slate-600">
        Reliez votre compte pour poser vos questions directement depuis Telegram, avec le meme
        acces que sur le site.
      </p>

      {!result ? (
        <button
          onClick={generateCode}
          disabled={loading}
          className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "..." : "Generer un code de liaison"}
        </button>
      ) : (
        <div className="mt-4 space-y-2 text-sm">
          <p className="text-slate-600">
            Cliquez sur ce lien depuis votre telephone (ouvre Telegram) :
          </p>
          <a
            href={result.deepLink}
            target="_blank"
            rel="noreferrer"
            className="block break-all font-medium text-brand-600 hover:underline"
          >
            {result.deepLink}
          </a>
          <p className="text-slate-500">
            Ou envoyez manuellement <code className="rounded bg-slate-100 px-1">/start {result.code}</code>{" "}
            au bot. Le code expire dans 10 minutes.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
