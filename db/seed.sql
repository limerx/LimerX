-- Domaines de connaissance initiaux.
-- Ajouter une ligne ici (ou via SQL direct) suffit pour preparer un nouveau domaine
-- avant d'y ingerer des documents avec `npm run ingest`.

INSERT INTO domains (slug, name, description, is_public)
VALUES (
  'nf-c15-100',
  'NF C15-100 - Installations electriques basse tension',
  'Norme francaise regissant la conception, la realisation et la verification des installations electriques basse tension.',
  false
)
ON CONFLICT (slug) DO NOTHING;
