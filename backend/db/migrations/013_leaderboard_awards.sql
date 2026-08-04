-- Награди од месечен лидерборд: админ испраќа порака + push,
-- наградениот (топ 1–5) пополнува контакт податоци.
CREATE TABLE IF NOT EXISTS leaderboard_awards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month    DATE NOT NULL,
  place           INTEGER NOT NULL CHECK (place BETWEEN 1 AND 5),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_contact'
                  CHECK (status IN ('pending_contact', 'contact_submitted', 'closed')),
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  contact_note    TEXT,
  notified_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_month, place),
  UNIQUE (period_month, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_user
  ON leaderboard_awards(user_id, status);

CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_month
  ON leaderboard_awards(period_month);
