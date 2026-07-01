/**
 * Idempotent schema applied on startup and via `npm run migrate`.
 * Kept as a TS string so it ships in both `tsx` (dev) and compiled `dist` builds.
 */
export const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS pcs (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  token_hash   TEXT,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  sources      JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_seen    TIMESTAMPTZ,
  agent_version TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id          TEXT PRIMARY KEY,
  pc_id       TEXT NOT NULL REFERENCES pcs(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'online',
  detail      TEXT,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pc_id, source, account_id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL DEFAULT '',
  tags         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_identities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  external_id TEXT,
  username    TEXT,
  phone       TEXT,
  name        TEXT,
  avatar      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Strong identity key per source.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_identity_source_external
  ON contact_identities (source, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_phone ON contact_identities (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_username ON contact_identities (source, username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_identity_contact ON contact_identities (contact_id);

CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedup_key   TEXT NOT NULL UNIQUE,
  pc_id       TEXT NOT NULL,
  source      TEXT NOT NULL,
  account_id  TEXT NOT NULL,
  chat_id     TEXT NOT NULL,
  chat_title  TEXT,
  chat_kind   TEXT,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  sender_name      TEXT,
  sender_username  TEXT,
  sender_phone     TEXT,
  sender_external  TEXT,
  text        TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  direction   TEXT NOT NULL DEFAULT 'in',
  ts          TIMESTAMPTZ NOT NULL,
  ai          JSONB,
  raw         JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL,
  secret     TEXT NOT NULL,
  events     TEXT[] NOT NULL DEFAULT ARRAY['message.in']::TEXT[],
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  message_id    UUID,
  event         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  attempts      INT NOT NULL DEFAULT 0,
  response_code INT,
  last_error    TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_pending
  ON webhook_deliveries (status, next_attempt_at)
  WHERE status IN ('pending', 'retry');

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
`;

/** Idempotent multi-tenant migration (safe to re-run). */
export const SCHEMA_MIGRATION_SQL = `
ALTER TABLE pcs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pcs_user ON pcs (user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_pc ON messages (pc_id, created_at DESC);

DROP INDEX IF EXISTS uniq_identity_source_external;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_identity_contact_source_external
  ON contact_identities (contact_id, source, external_id)
  WHERE external_id IS NOT NULL;
`;
