import { query } from "@/lib/db";

// Abonnement unique : actif => acces a tous les domaines du catalogue.
// Les domaines is_public restent accessibles independamment (voir les routes de chat),
// donc revoquer se resume a vider org_domain_access pour cette organisation.
export async function syncOrgDomainAccess(organizationId: string, isActive: boolean) {
  if (isActive) {
    await query(
      `INSERT INTO org_domain_access (organization_id, domain_id)
       SELECT $1, id FROM domains
       ON CONFLICT DO NOTHING`,
      [organizationId]
    );
  } else {
    await query("DELETE FROM org_domain_access WHERE organization_id = $1", [organizationId]);
  }
}
