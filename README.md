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

Meme logique cote canaux : le compte (organisation/abonnement) est independant du canal utilise
pour poser les questions. Aujourd'hui web + Telegram (voir plus bas, avec liaison de compte pour
que l'abonnement s'applique aux deux) ; un canal WhatsApp pourra suivre le meme schema (table
`whatsapp_conversations` + liaison par code, comme pour Telegram) sans remettre en cause le reste.

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
1. Extrait le texte page par page, et rend chaque page en image PNG dans
   `public/norm-pages/<domaine>/<page>.png`, **integrale et non modifiee** (schemas/tableaux non
   restituables en texte seul — voir la question posee au chat/a Telegram, qui renvoie une
   vignette vers la page d'origine)
2. Tente de detecter les references d'article (motif `411.3.3`, `701.1.2`, ...) pour le decoupage
   en chunks — **a ajuster** (`ARTICLE_REGEX` dans `scripts/ingest.ts`) si la structure reelle du
   PDF differe une fois teste. Ces references servent uniquement au decoupage interne : le
   chatbot ne les cite plus dans ses reponses (voir plus bas)
3. Decoupe en chunks (~1100 caracteres, chevauchement de 150) et calcule les embeddings Gemini
4. Insere le tout en base, idempotent par checksum du fichier (un meme PDF ne sera pas re-ingere)

Options disponibles si besoin ponctuel : `--crop-bottom=0.04` (rogne le bas de chaque image) et
`--redact=motif1,motif2` (efface les blocs de texte correspondant a des regex, ou qu'ils soient
sur la page) — desactives par defaut, les pages restent authentiques.

Les images generees ne sont pas committees (issues d'un PDF souvent proprietaire, potentiellement
volumineuses) — a regenerer localement via `npm run ingest` sur chaque environnement.

### 5. Lancer l'application

```bash
npm run dev
```

Aller sur http://localhost:3000, creer un compte (une organisation est creee automatiquement),
puis ouvrir le domaine `NF C15-100` depuis le dashboard.

### 6. Facturation (Stripe, abonnement unique avec essai 7 jours)

Un abonnement Stripe donne acces a **tous les domaines** du catalogue (`syncOrgDomainAccess` dans
`src/lib/billing.ts`). Les domaines marques `is_public = true` restent accessibles gratuitement,
independamment de tout abonnement.

1. Creer un compte [Stripe](https://dashboard.stripe.com) (mode test pour commencer)
2. Dans le dashboard Stripe : Produits > creer un produit avec un prix recurrent (mensuel ou
   annuel) — noter l'ID du prix (`price_...`)
3. Renseigner dans `.env.local` : `STRIPE_SECRET_KEY` (cle secrete de test), `STRIPE_PRICE_ID`
4. Pour tester les webhooks en local, installer le [Stripe CLI](https://stripe.com/docs/stripe-cli)
   puis :
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   La commande affiche un secret `whsec_...` a mettre dans `STRIPE_WEBHOOK_SECRET`. En production,
   creer plutot un endpoint webhook depuis le dashboard Stripe pointant vers
   `https://votre-domaine/api/webhooks/stripe`.
5. Depuis le dashboard de l'app, le bouton "Demarrer mon essai gratuit" lance le Checkout Stripe
   (carte requise, essai de 7 jours avant le premier prelevement) ; "Gerer l'abonnement" ouvre le
   portail client Stripe (annulation, moyen de paiement, factures).

Le webhook synchronise `organizations.subscription_status` et accorde/retire l'acces aux domaines
a chaque changement d'etat de l'abonnement (essai, actif, impaye, annule...).

### 7. Brancher le bot Telegram (optionnel)

Le meme moteur RAG est accessible via un bot Telegram. Si le domaine par defaut du bot n'est **pas**
public, un utilisateur Telegram doit relier son compte a une organisation abonnee avant de pouvoir
poser des questions (bouton "Utiliser le bot sur Telegram" dans le dashboard → code envoye en
`/start <code>` au bot → `telegram_conversations.organization_id` renseigne).

1. Creer un bot avec [@BotFather](https://t.me/BotFather), recuperer le token et le nom
   d'utilisateur du bot
2. Renseigner dans `.env.local` : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` (sans le `@`,
   necessaire pour generer le lien de liaison), `TELEGRAM_ADMIN_CHAT_ID` (optionnel, pour les
   notifications d'erreur), `TELEGRAM_WEBHOOK_SECRET` (chaine aleatoire, ex: `openssl rand -hex 16`),
   `TELEGRAM_DEFAULT_DOMAIN` (slug du domaine servi par le bot)
3. Deployer l'app sur une URL HTTPS publique (ou un tunnel ngrok en local pour tester), puis
   renseigner `TELEGRAM_WEBHOOK_URL` (ex: `https://mon-app.vercel.app/api/telegram/webhook`)
4. Enregistrer le webhook aupres de Telegram :
   ```bash
   npm run telegram:set-webhook
   ```

Le webhook (`src/app/api/telegram/webhook/route.ts`) verifie que chaque requete porte le bon
header `X-Telegram-Bot-Api-Secret-Token` avant de traiter le message — indispensable car l'URL du
webhook est publique.

## Points d'attention pour la mise en production / vente SaaS

- **Droits sur le document source** : le decoupage/l'indexation ne dispensent pas de verifier que
  vous avez le droit d'exploiter commercialement le contenu du PDF source. Un guide edite par un
  fabricant (ex: guide "inspire de" la norme publie par un equipementier, avec sa mise en page et
  ses illustrations) reste sous son propre copyright, distinct de la norme AFNOR/UTE elle-meme
  qui est egalement payante. Faire disparaitre une marque des images (voir `--crop-bottom`)
  n'efface pas ce risque juridique — a clarifier avant toute vente.
- **Fiabilite des reponses** : le prompt systeme (`src/lib/gemini.ts`) force le modele a ne
  repondre qu'a partir des extraits retrouves et a ne jamais inventer d'information. Le rappel
  juridique ("ne remplace pas un professionnel qualifie...") n'est plus repete a chaque reponse
  (voir plus bas) mais affiche une fois a la creation du compte (case a cocher obligatoire,
  horodatee dans `organizations.disclaimer_accepted_at`) et en permanence dans l'en-tete du chat.
  Ne pas retirer ce garde-fou : c'est ce qui protege juridiquement le produit.
- **Citations masquees a l'utilisateur final** : le modele ne mentionne plus de numero
  d'article/page dans le texte de la reponse, et l'UI n'affiche plus la liste "Sources" — seules
  les vignettes de page (schemas/tableaux) restent visibles. Les references d'article sont
  toujours stockees en base (`chunks.article_ref`, `messages.sources`) pour l'audit interne.
- **Qualite du decoupage (chunking)** : la detection d'articles par regex est un point de depart.
  Une fois le vrai PDF teste, verifier manuellement un echantillon de chunks/articles retrouves
  et affiner `ARTICLE_REGEX` / la logique de segmentation en consequence.
- **Facturation** : l'abonnement Stripe (essai, paiement, annulation) est fonctionnel (voir plus
  haut). Reste a ajouter si besoin : limites d'usage par plan (messages/mois), plusieurs formules
  tarifaires (le modele actuel est un abonnement unique donnant acces a tout le catalogue).
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
