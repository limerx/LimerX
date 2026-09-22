# LimerX

Chatbot expert de la norme **NF C15-100** (et d'autres normes/domaines a venir), concu comme
produit **SaaS multi-tenant**. Architecture RAG (Retrieval-Augmented Generation) : chaque reponse
est generee a partir d'extraits reellement retrouves dans le PDF source, avec citation de
l'article correspondant.

## Stack

- **Next.js 15** (App Router, TypeScript) — frontend + API en un seul repo
- **Gemini API** (`@google/generative-ai`) — embeddings (`text-embedding-004`) et generation
  (`gemini-2.0-flash`)
- **PostgreSQL + pgvector** — stockage des chunks vectorises et recherche par similarite
- **Auth.js (NextAuth, Credentials)** — authentification email/mot de passe, session JWT
- **Tailwind CSS** — UI

## Architecture multi-domaine

Le schema n'est pas fige sur la seule norme NF C15-100 : les documents sont ranges dans des
`domains` (table `domains`). Une organisation cliente (`organizations`) obtient un acces a un ou
plusieurs domaines via `org_domain_access`. Pour ajouter une nouvelle norme plus tard (DTU, NF
autre...), il suffit de :

1. Creer une ligne dans `domains` (slug, nom, description)
2. Ingerer son PDF avec `npm run ingest -- --file=... --domain=<slug>`
3. Donner l'acces aux organisations concernees via `org_domain_access`

Aucun changement de code ni de schema n'est necessaire.

## Demarrage local

### 1. Base de donnees

```bash
docker compose up -d
```

Cela lance Postgres 16 avec l'extension `pgvector` (image `pgvector/pgvector:pg16`), sur le port
5432, avec les identifiants `limerx` / `limerx` / base `limerx` (voir `docker-compose.yml`).

### 2. Variables d'environnement

```bash
cp .env.example .env.local
```

Renseigner au minimum :
- `GEMINI_API_KEY` — cle API Google AI Studio (https://aistudio.google.com/app/apikey)
- `NEXTAUTH_SECRET` — generer avec `openssl rand -base64 32`

### 3. Installer les dependances et migrer la base

```bash
npm install
npm run db:migrate
```

`db:migrate` applique `db/schema.sql` (tables + index vectoriel HNSW) puis `db/seed.sql` (cree le
domaine `nf-c15-100`).

### 4. Ingerer le PDF de la norme

Placer le PDF (par exemple) dans `data/sources/nf-c15-100.pdf` (dossier ignore par git — les PDF
de normes sont souvent proprietaires, ne pas les committer), puis :

```bash
npm run ingest -- --file=./data/sources/nf-c15-100.pdf --domain=nf-c15-100 \
  --title="NF C15-100" --version="Edition en vigueur"
```

Le script :
1. Extrait le texte page par page
2. Tente de detecter les references d'article (motif `411.3.3`, `701.1.2`, ...) pour permettre au
   chatbot de citer precisement ses sources — **a ajuster** (`ARTICLE_REGEX` dans
   `scripts/ingest.ts`) si la structure reelle du PDF differe une fois teste
3. Decoupe en chunks (~1100 caracteres, chevauchement de 150) et calcule les embeddings Gemini
4. Insere le tout en base, idempotent par checksum du fichier (un meme PDF ne sera pas re-ingere)

### 5. Lancer l'application

```bash
npm run dev
```

Aller sur http://localhost:3000, creer un compte (une organisation est creee automatiquement),
puis ouvrir le domaine `NF C15-100` depuis le dashboard.

## Points d'attention pour la mise en production / vente SaaS

- **Fiabilite des reponses** : le prompt systeme (`src/lib/gemini.ts`) force le modele a ne
  repondre qu'a partir des extraits retrouves et a toujours citer l'article source, avec un
  rappel qu'il ne remplace pas un professionnel qualifie / un organisme de controle agree
  (Consuel). Ne pas retirer ce garde-fou : c'est ce qui protege juridiquement le produit.
- **Qualite du decoupage (chunking)** : la detection d'articles par regex est un point de depart.
  Une fois le vrai PDF teste, verifier manuellement un echantillon de chunks/articles retrouves
  et affiner `ARTICLE_REGEX` / la logique de segmentation en consequence.
- **Facturation** : les champs `organizations.plan` et `stripe_customer_id` sont prevus mais
  l'integration Stripe (webhooks, limites d'usage, portail client) reste a implementer.
- **Observabilite** : ajouter un suivi des couts Gemini (tokens consommes par organisation) avant
  la mise en vente, pour dimensionner les plans tarifaires.
- **Isolation multi-tenant** : toutes les requetes sont deja filtrees par `organization_id` /
  `domain_id` cote serveur (API routes + pages), a garder en tete pour toute nouvelle route.

## Structure du projet

```
db/schema.sql          Schema Postgres (tables, index pgvector)
db/seed.sql             Donnees initiales (domaine nf-c15-100)
scripts/migrate.ts      Applique schema.sql + seed.sql
scripts/ingest.ts       Ingestion PDF -> chunks -> embeddings -> DB
src/lib/db.ts            Pool Postgres
src/lib/gemini.ts        Wrapper embeddings + generation Gemini (streaming)
src/lib/rag.ts           Recherche vectorielle (retrieval)
src/lib/auth.ts          Configuration NextAuth (Credentials)
src/app/api/chat         Endpoint RAG (streaming SSE, verifie l'acces au domaine)
src/app/api/register     Creation compte + organisation
src/app/dashboard        Liste des domaines accessibles + interface de chat
```
