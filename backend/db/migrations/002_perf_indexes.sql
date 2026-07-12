-- ==========================================================================
-- Миграција 002 — индекси за перформанси при голем број корисници
-- --------------------------------------------------------------------------
-- Целта е брзи одговори дури и кога кешот „промаши“ (cache miss) под товар од
-- многу истовремени корисници. Изврши еднаш врз постоечка база:
--   psql "$DATABASE_URL" -f backend/db/migrations/002_perf_indexes.sql
-- ==========================================================================

-- Настани се подредуваат по датум (ORDER BY event_date ASC).
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date ASC);

-- Месечниот лидерборд филтрира points_events по време и групира по корисник.
CREATE INDEX IF NOT EXISTS idx_points_user_created ON points_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_points_created ON points_events(created_at);

-- Известувањата се подредуваат по време (ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Спречи еден корисник да собере поени двапати за иста причина по иста пријава
-- (се потпираме на ова во awardPointsOnce). Делумно единствен индекс.
CREATE UNIQUE INDEX IF NOT EXISTS uq_points_report_reason
  ON points_events(report_id, reason)
  WHERE report_id IS NOT NULL;
