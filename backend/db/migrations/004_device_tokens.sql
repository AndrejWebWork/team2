-- ==========================================================================
-- Миграција 004 — токени на уреди за push нотификации (FCM)
-- Изврши еднаш врз постоечка база:
--   psql "$DATABASE_URL" -f backend/db/migrations/004_device_tokens.sql
-- ==========================================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  token        TEXT PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id    TEXT,
  platform     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_device ON device_tokens(device_id);
