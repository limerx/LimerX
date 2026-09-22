import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

interface DomainRow {
  slug: string;
  name: string;
  description: string | null;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const domains = await query<DomainRow>(
    `SELECT d.slug, d.name, d.description
     FROM domains d
     JOIN org_domain_access a ON a.domain_id = d.id
     WHERE a.organization_id = $1
     UNION
     SELECT slug, name, description FROM domains WHERE is_public = true
     ORDER BY name`,
    [session.user.organizationId]
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-brand-700">LimerX</span>
          <span className="text-sm text-slate-600">{session.user.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Vos domaines de connaissance</h1>
        <p className="mt-1 text-slate-600">
          Choisissez un domaine pour poser vos questions.
        </p>

        {domains.length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed border-slate-300 p-6 text-slate-600">
            Votre organisation n'a acces a aucun domaine pour le moment. Contactez l'administrateur.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {domains.map((d) => (
              <Link
                key={d.slug}
                href={`/dashboard/chat/${d.slug}`}
                className="rounded-lg border border-slate-200 bg-white p-6 transition hover:border-brand-400 hover:shadow-sm"
              >
                <h2 className="font-semibold text-slate-900">{d.name}</h2>
                {d.description && (
                  <p className="mt-2 text-sm text-slate-600">{d.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
