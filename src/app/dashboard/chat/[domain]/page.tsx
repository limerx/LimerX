import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { ChatWindow } from "@/components/ChatWindow";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { domain: domainSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const rows = await query<{ id: string; name: string; is_public: boolean }>(
    "SELECT id, name, is_public FROM domains WHERE slug = $1",
    [domainSlug]
  );
  const domain = rows[0];
  if (!domain) notFound();

  if (!domain.is_public) {
    const access = await query(
      "SELECT 1 FROM org_domain_access WHERE organization_id = $1 AND domain_id = $2",
      [session.user.organizationId, domain.id]
    );
    if (access.length === 0) redirect("/dashboard");
  }

  return (
    <main className="flex h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <a href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
          &larr; Domaines
        </a>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{domain.name}</h1>
        <p className="mt-1 text-xs text-slate-400">
          Aide a la comprehension de la norme - ne remplace pas la validation d&apos;un
          professionnel qualifie.
        </p>
      </header>
      <ChatWindow domainSlug={domainSlug} />
    </main>
  );
}
