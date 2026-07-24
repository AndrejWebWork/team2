-- ==========================================================================
-- Миграција 009 — Instagram tag за community / organization корисници
-- ==========================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
