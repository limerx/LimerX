"use client";

export interface BathroomZone {
  id: string;
  zoneName: string;
  ipDegree: string;
  canalisationRule: string;
  appareillageRule: string;
  usageMaterialRule: string;
  notes: string | null;
  sourceRef: string | null;
  sourcePage: number | null;
}

export function BathroomZonesTable({ zones, domainSlug }: { zones: BathroomZone[]; domainSlug: string }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-4">
        {zones.map((zone) => (
          <div key={zone.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">{zone.zoneName}</h3>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                {zone.ipDegree}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Canalisation</dt>
                <dd className="mt-1 text-sm text-slate-700">{zone.canalisationRule}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Appareillage</dt>
                <dd className="mt-1 text-sm text-slate-700">{zone.appareillageRule}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Materiels d&apos;utilisation
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{zone.usageMaterialRule}</dd>
              </div>
            </dl>
            {zone.notes && <p className="mt-3 text-xs text-slate-500">{zone.notes}</p>}
            {zone.sourceRef && (
              <p className="mt-3 text-xs text-emerald-600">
                Source : {zone.sourceRef}
                {zone.sourcePage && ` - page ${zone.sourcePage}`}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Valeurs extraites directement du document de reference ({domainSlug}) - consultation, pas
        une estimation. Ne remplace pas la validation d&apos;un electricien qualifie ou d&apos;un
        organisme de controle agree.
      </p>
    </div>
  );
}
