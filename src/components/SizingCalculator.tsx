"use client";

import { useMemo, useState } from "react";

export interface SizingRule {
  id: string;
  category: string;
  subcategory: string | null;
  powerMinW: number | null;
  powerMaxW: number | null;
  phase: string | null;
  minSectionMm2: number;
  maxBreakerAmps: number;
  notes: string | null;
  sourceRef: string | null;
  sourcePage: number | null;
}

function ruleLabel(rule: SizingRule): string {
  const parts: string[] = [];
  if (rule.subcategory) parts.push(rule.subcategory);
  if (rule.phase) parts.push(rule.phase === "mono" ? "Monophase" : "Triphase");
  if (rule.powerMinW != null || rule.powerMaxW != null) {
    if (rule.powerMinW == null) parts.push(`jusqu'a ${rule.powerMaxW} W`);
    else parts.push(`${rule.powerMinW}-${rule.powerMaxW} W`);
  }
  return parts.length > 0 ? parts.join(" - ") : "Cas standard";
}

export function SizingCalculator({ rules, domainSlug }: { rules: SizingRule[]; domainSlug: string }) {
  const categories = useMemo(() => Array.from(new Set(rules.map((r) => r.category))), [rules]);
  const [category, setCategory] = useState(categories[0] ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rowsForCategory = rules.filter((r) => r.category === category);
  // Un seul cas possible pour cette categorie : pas besoin de selection explicite.
  const selected =
    rowsForCategory.length === 1 ? rowsForCategory[0] : rules.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <label className="block text-sm font-medium text-slate-700">Type de circuit</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSelectedId(null);
          }}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {rowsForCategory.length > 1 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Precisez le cas</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {rowsForCategory.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedId === r.id
                    ? "border-brand-500 bg-brand-50 text-brand-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {ruleLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm text-emerald-700">Resultat pour : {category}</p>
          {selected.subcategory && (
            <p className="text-sm text-emerald-700">{ruleLabel(selected)}</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-600">
                Section mini. cuivre
              </p>
              <p className="text-3xl font-bold text-emerald-900">{selected.minSectionMm2} mm²</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-600">
                Calibre disjoncteur
              </p>
              <p className="text-3xl font-bold text-emerald-900">{selected.maxBreakerAmps} A</p>
            </div>
          </div>
          {selected.notes && (
            <p className="mt-4 text-xs text-emerald-700">{selected.notes}</p>
          )}
          {selected.sourceRef && (
            <p className="mt-3 text-xs text-emerald-600">
              Source : {selected.sourceRef}
              {selected.sourcePage && ` - page ${selected.sourcePage}`}
            </p>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Valeurs extraites directement du document de reference ({domainSlug}) - consultation, pas
        une estimation. Ne remplace pas la validation d&apos;un electricien qualifie ou d&apos;un
        organisme de controle agree.
      </p>
    </div>
  );
}
