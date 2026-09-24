"use client";

import { useState } from "react";

export interface RoomEquipment {
  id: string;
  roomType: string;
  lightingPoints: string;
  powerOutlets: string;
  multimediaOutlets: string | null;
  specializedCircuits: string | null;
  otherCircuits: string | null;
  notes: string | null;
  sourceRef: string | null;
  sourcePage: number | null;
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value || value === "-") return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-emerald-600">{label}</dt>
      <dd className="mt-1 text-sm text-emerald-900">{value}</dd>
    </div>
  );
}

export function RoomEquipmentTable({ rooms, domainSlug }: { rooms: RoomEquipment[]; domainSlug: string }) {
  const [selectedId, setSelectedId] = useState(rooms[0]?.id ?? "");
  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <div>
        <label htmlFor="room-select" className="block text-sm font-medium text-slate-700">
          Piece du logement
        </label>
        <select
          id="room-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomType}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm text-emerald-700">Equipement minimal - {selected.roomType}</p>
          <dl className="mt-4 space-y-4">
            <Field label="Points d'eclairage" value={selected.lightingPoints} />
            <Field label="Prises de courant" value={selected.powerOutlets} />
            <Field label="Prises multimedia (RJ45 / TV)" value={selected.multimediaOutlets} />
            <Field label="Circuits specialises" value={selected.specializedCircuits} />
            <Field label="Autres circuits" value={selected.otherCircuits} />
          </dl>
          {selected.notes && <p className="mt-4 text-xs text-emerald-700">{selected.notes}</p>}
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
