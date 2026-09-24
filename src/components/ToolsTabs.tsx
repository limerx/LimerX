"use client";

import { useState } from "react";
import { SizingCalculator, type SizingRule } from "@/components/SizingCalculator";
import { BathroomZonesTable, type BathroomZone } from "@/components/BathroomZonesTable";
import { RoomEquipmentTable, type RoomEquipment } from "@/components/RoomEquipmentTable";

type Tab = "dimensionnement" | "salle-de-bain" | "pieces";

export function ToolsTabs({
  domainSlug,
  sizingRules,
  bathroomZones,
  roomEquipment,
}: {
  domainSlug: string;
  sizingRules: SizingRule[];
  bathroomZones: BathroomZone[];
  roomEquipment: RoomEquipment[];
}) {
  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: "dimensionnement", label: "Section de cable", available: sizingRules.length > 0 },
    { id: "salle-de-bain", label: "Volumes salle de bain", available: bathroomZones.length > 0 },
    { id: "pieces", label: "Equipement par piece", available: roomEquipment.length > 0 },
  ];
  const [tab, setTab] = useState<Tab>(tabs.find((t) => t.available)?.id ?? "dimensionnement");

  return (
    <div>
      <div className="mx-auto mb-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {tabs
          .filter((t) => t.available)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "dimensionnement" && sizingRules.length > 0 && (
        <SizingCalculator rules={sizingRules} domainSlug={domainSlug} />
      )}
      {tab === "salle-de-bain" && bathroomZones.length > 0 && (
        <BathroomZonesTable zones={bathroomZones} domainSlug={domainSlug} />
      )}
      {tab === "pieces" && roomEquipment.length > 0 && (
        <RoomEquipmentTable rooms={roomEquipment} domainSlug={domainSlug} />
      )}
    </div>
  );
}
