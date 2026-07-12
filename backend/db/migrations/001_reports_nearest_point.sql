-- ==========================================================================
-- Миграција: врзување на пријава за контејнер до најблиска позната OSM точка.
-- Изврши само на ПОСТОЕЧКИ бази (новите веќе ги имаат колоните од schema.sql):
--   psql -d ekoskopje -f db/migrations/001_reports_nearest_point.sql
-- ==========================================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS nearest_point_id         TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS nearest_point_type       TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS nearest_point_distance_m INTEGER;
