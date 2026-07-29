-- ==========================================================================
-- 012 — Дополнителни админ улоги + одобрување на community настани
-- --------------------------------------------------------------------------
--   psql "$DATABASE_URL" -f backend/db/migrations/012_admin_roles_and_event_approval.sql
-- ==========================================================================

-- Нови администраторски улоги (супер админ останува 'admin').
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin_inspection';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin_environment';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin_hygiene';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Одобрување на настани (одвоено од seat status: open / few_left / closed).
-- Постоечките редови се означуваат како approved; новите добиваат pending.
ALTER TABLE events ADD COLUMN IF NOT EXISTS approval_status TEXT;

UPDATE events SET approval_status = 'approved' WHERE approval_status IS NULL;

ALTER TABLE events ALTER COLUMN approval_status SET DEFAULT 'pending';
ALTER TABLE events ALTER COLUMN approval_status SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_events_approval_status ON events(approval_status);
