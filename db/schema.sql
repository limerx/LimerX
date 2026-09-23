-- LimerX schema
-- Modele: SaaS multi-tenant, multi-domaine de connaissance (RAG).
--
-- Un "domain" = un corpus documentaire (ex: "NF C15-100", "DTU 60.1", ...).
-- Une organisation cliente souscrit a un ou plusieurs domaines.
-- Chaque domaine est alimente par des documents (PDF sources) decoupes en chunks vectorises.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- Dimension des embeddings Gemini text-embedding-004
-- (garder en phase avec GEMINI_EMBEDDING_MODEL dans .env)
-- Si vous changez de modele d'embedding, il faut migrer cette colonne.

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'trial', -- trial | starter | pro | enterprise
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ADD COLUMN IF NOT EXISTS plutot que de casser CREATE TABLE IF NOT EXISTS sur une base
-- deja migree : ce fichier n'est pas un outil de migration versionne, juste un schema
-- applique de facon idempotente a chaque `npm run db:migrate`.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS disclaimer_accepted_at TIMESTAMPTZ;
-- Statut Stripe cache localement (source de verite = Stripe, synchronise via webhook) :
-- null (jamais souscrit) | trialing | active | past_due | canceled | unpaid
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catalogue global des domaines de connaissance proposes par le SaaS.
-- C'est ici qu'on ajoute une nouvelle norme/domaine plus tard sans toucher au schema.
CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE, -- ex: 'nf-c15-100'
  name TEXT NOT NULL,        -- ex: 'NF C15-100 - Installations electriques BT'
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false, -- accessible sans souscription (ex: demo)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Droits d'acces d'une organisation a un domaine (souscription).
CREATE TABLE IF NOT EXISTS org_domain_access (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, domain_id)
);

-- Documents sources ingeres (un PDF de norme, par ex.) pour un domaine donne.
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  title TEXT,
  version_label TEXT, -- ex: 'Amendement A5 2020'
  page_count INTEGER,
  checksum TEXT, -- sha256 du fichier source, evite les doublons d'ingestion
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chunks de texte vectorises, unite de base de la recherche RAG.
CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE, -- denormalise pour filtrer vite
  content TEXT NOT NULL,
  article_ref TEXT,     -- ex: '411.3.1.2' si detecte
  page_number INTEGER,
  chunk_index INTEGER NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index de recherche vectorielle (cosine distance, adapte aux embeddings normalises)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_domain_idx ON chunks (domain_id);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id);

-- Historique des conversations, pour l'UI chat et l'audit (tracabilite des reponses).
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB, -- [{chunkId, articleRef, pageNumber, excerpt}], pour affichage des citations
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id);

-- Canal Telegram : les utilisateurs y discutent sans compte SaaS au depart (pas
-- d'organization_id/user_id impose), donc historique separe des conversations web.
-- organization_id est renseigne une fois le chat_id relie a un compte payant (voir
-- telegram_link_codes) ; tant qu'il est null, l'acces est gate en fonction de is_public.
CREATE TABLE IF NOT EXISTS telegram_conversations (
  chat_id BIGINT PRIMARY KEY,
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE telegram_conversations ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Code court, usage unique, genere depuis le dashboard web pour relier un chat_id Telegram
-- a l'organisation de l'utilisateur connecte (flow : /start <code> envoye au bot).
CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code TEXT PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL REFERENCES telegram_conversations(chat_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_messages_chat_idx ON telegram_messages (chat_id);
