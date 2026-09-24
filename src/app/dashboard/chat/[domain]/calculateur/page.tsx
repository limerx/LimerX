import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { type SizingRule } from "@/components/SizingCalculator";
import { type BathroomZone } from "@/components/BathroomZonesTable";
import { type RoomEquipment } from "@/components/RoomEquipmentTable";
import { ToolsTabs } from "@/components/ToolsTabs";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export default async function CalculatorPage({ params }: PageProps) {
  const { domain: domainSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const domainRows = await query<{ id: string; name: string; is_public: boolean }>(
    "SELECT id, name, is_public FROM domains WHERE slug = $1",
    [domainSlug]
  );
  const domain = domainRows[0];
  if (!domain) notFound();

  if (!domain.is_public) {
    const access = await query(
      "SELECT 1 FROM org_domain_access WHERE organization_id = $1 AND domain_id = $2",
      [session.user.organizationId, domain.id]
    );
    if (access.length === 0) redirect("/dashboard");
  }

  const ruleRows = await query<{
    id: string;
    category: string;
    subcategory: string | null;
    power_min_w: number | null;
    power_max_w: number | null;
    phase: string | null;
    min_section_mm2: string;
    max_breaker_amps: string;
    notes: string | null;
    source_ref: string | null;
    source_page: number | null;
  }>(
    `SELECT id, category, subcategory, power_min_w, power_max_w, phase,
            min_section_mm2, max_breaker_amps, notes, source_ref, source_page
     FROM circuit_sizing_rules
     WHERE domain_id = $1
     ORDER BY display_order ASC`,
    [domain.id]
  );

  const sizingRules: SizingRule[] = ruleRows.map((r) => ({
    id: r.id,
    category: r.category,
    subcategory: r.subcategory,
    powerMinW: r.power_min_w,
    powerMaxW: r.power_max_w,
    phase: r.phase,
    minSectionMm2: Number(r.min_section_mm2),
    maxBreakerAmps: Number(r.max_breaker_amps),
    notes: r.notes,
    sourceRef: r.source_ref,
    sourcePage: r.source_page,
  }));

  const zoneRows = await query<{
    id: string;
    zone_name: string;
    ip_degree: string;
    canalisation_rule: string;
    appareillage_rule: string;
    usage_material_rule: string;
    notes: string | null;
    source_ref: string | null;
    source_page: number | null;
  }>(
    `SELECT id, zone_name, ip_degree, canalisation_rule, appareillage_rule, usage_material_rule,
            notes, source_ref, source_page
     FROM bathroom_protection_zones
     WHERE domain_id = $1
     ORDER BY display_order ASC`,
    [domain.id]
  );

  const bathroomZones: BathroomZone[] = zoneRows.map((z) => ({
    id: z.id,
    zoneName: z.zone_name,
    ipDegree: z.ip_degree,
    canalisationRule: z.canalisation_rule,
    appareillageRule: z.appareillage_rule,
    usageMaterialRule: z.usage_material_rule,
    notes: z.notes,
    sourceRef: z.source_ref,
    sourcePage: z.source_page,
  }));

  const roomRows = await query<{
    id: string;
    room_type: string;
    lighting_points: string;
    power_outlets: string;
    multimedia_outlets: string | null;
    specialized_circuits: string | null;
    other_circuits: string | null;
    notes: string | null;
    source_ref: string | null;
    source_page: number | null;
  }>(
    `SELECT id, room_type, lighting_points, power_outlets, multimedia_outlets,
            specialized_circuits, other_circuits, notes, source_ref, source_page
     FROM room_equipment_minimums
     WHERE domain_id = $1
     ORDER BY display_order ASC`,
    [domain.id]
  );

  const roomEquipment: RoomEquipment[] = roomRows.map((r) => ({
    id: r.id,
    roomType: r.room_type,
    lightingPoints: r.lighting_points,
    powerOutlets: r.power_outlets,
    multimediaOutlets: r.multimedia_outlets,
    specializedCircuits: r.specialized_circuits,
    otherCircuits: r.other_circuits,
    notes: r.notes,
    sourceRef: r.source_ref,
    sourcePage: r.source_page,
  }));

  const hasAnyTool = sizingRules.length > 0 || bathroomZones.length > 0 || roomEquipment.length > 0;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link
          href={`/dashboard/chat/${domainSlug}`}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          &larr; Chat
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">
          Calculateurs - {domain.name}
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Valeurs exactes du document de reference - consultation deterministe, pas une
          estimation.
        </p>
      </header>

      <div className="px-6 py-10">
        {!hasAnyTool ? (
          <p className="mx-auto max-w-2xl rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-600">
            Aucun outil n&apos;est encore disponible pour ce domaine.
          </p>
        ) : (
          <ToolsTabs
            domainSlug={domainSlug}
            sizingRules={sizingRules}
            bathroomZones={bathroomZones}
            roomEquipment={roomEquipment}
          />
        )}
      </div>
    </main>
  );
}
