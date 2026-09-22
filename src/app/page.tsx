import Link from "next/link";

const FEATURES = [
  {
    title: "Reponses sourcees",
    description:
      "Chaque reponse cite l'article exact de la norme utilise, pour une tracabilite complete.",
  },
  {
    title: "Multi-normes",
    description:
      "NF C15-100 aujourd'hui, DTU et autres reglementations techniques demain, sans changer d'outil.",
  },
  {
    title: "Pret pour l'entreprise",
    description:
      "Organisations, utilisateurs multiples, gestion des acces par abonnement : concu pour etre revendu en SaaS.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold text-brand-700">LimerX</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Connexion
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
            >
              Essayer gratuitement
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          L'expert IA de la norme{" "}
          <span className="text-brand-600">NF C15-100</span>, disponible 24/7
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Posez vos questions en langage naturel, obtenez des reponses precises et sourcees
          directement issues du texte de la norme electrique basse tension.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-md bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
          >
            Commencer maintenant
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-100"
          >
            J'ai deja un compte
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        LimerX ne remplace pas l'avis d'un electricien qualifie ou d'un organisme de controle agree.
      </footer>
    </main>
  );
}
