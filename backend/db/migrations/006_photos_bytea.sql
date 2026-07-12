-- ==========================================================================
-- Миграција 006 — сликите се чуваат во база како BYTEA (бинарно), не како URL
-- --------------------------------------------------------------------------
-- По барање на Град Скопје, сите слики остануваат во нивната PostgreSQL база
-- (на Acton), без надворешен диск/object storage. Ги менуваме колоните за
-- слики од TEXT (патека/URL) во BYTEA (бинарни податоци).
--
-- ВНИМАНИЕ: постоечките TEXT вредности (стари URL-и) не се валидни слики, па
-- при конверзијата се празнат (SET NULL). На нова/празна база тоа е без ефект.
--
-- Изврши еднаш врз постоечка база:
--   psql "$DATABASE_URL" -f backend/db/migrations/006_photos_bytea.sql
-- ==========================================================================

-- Пријави: photo_1 … photo_6 → BYTEA
ALTER TABLE reports ALTER COLUMN photo_1 TYPE BYTEA USING NULL;
ALTER TABLE reports ALTER COLUMN photo_2 TYPE BYTEA USING NULL;
ALTER TABLE reports ALTER COLUMN photo_3 TYPE BYTEA USING NULL;
ALTER TABLE reports ALTER COLUMN photo_4 TYPE BYTEA USING NULL;
ALTER TABLE reports ALTER COLUMN photo_5 TYPE BYTEA USING NULL;
ALTER TABLE reports ALTER COLUMN photo_6 TYPE BYTEA USING NULL;

-- Корисници: avatar_url (TEXT) → avatar (BYTEA)
ALTER TABLE users RENAME COLUMN avatar_url TO avatar;
ALTER TABLE users ALTER COLUMN avatar TYPE BYTEA USING NULL;

-- Настани: cover_photo_url (TEXT) → cover_photo (BYTEA)
ALTER TABLE events RENAME COLUMN cover_photo_url TO cover_photo;
ALTER TABLE events ALTER COLUMN cover_photo TYPE BYTEA USING NULL;
