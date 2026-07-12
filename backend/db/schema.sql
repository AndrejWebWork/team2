-- ==========================================================================
-- EkoSkopje — PostgreSQL шема
-- --------------------------------------------------------------------------
-- Една база за СИТЕ клиенти: веб апликација + Android + iOS.
-- Сите тие ја користат истата REST/JSON backend услуга, која се поврзува на
-- оваа PostgreSQL база. Базата е предвидена да работи на виртуелната Acton
-- машина на Град Скопје.
--
-- Конвенции:
--   * UUID примарни клучеви (безбедни за дистрибуирани мобилни клиенти).
--   * timestamptz за сите датуми (со временска зона, UTC во база).
--   * Секоја слика од корисник е ПОСЕБНА КОЛОНА (photo_1 ... photo_6).
--   * Складирање слики: сликите се чуваат КАКО БИНАРНИ ПОДАТОЦИ (BYTEA) во
--     самата база — по барање на Град Скопје сите податоци (вклучително
--     сликите) остануваат во нивната PostgreSQL база на Acton, без надворешен
--     диск/object storage. Backend-от ги сервира преку endpoint
--     (пр. /api/reports/:id/photos/:n) со авто-детекција на MIME од содржината.
--     (Ако сакате полесна база, вратете BYTEA → TEXT со патека/URL.)
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";    -- email без разлика на мали/големи букви

-- ----------------------------------------------------------------------------
-- ENUM типови
-- ----------------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('user', 'organization', 'admin');
CREATE TYPE report_type      AS ENUM ('smell', 'waste', 'container');
CREATE TYPE report_status    AS ENUM ('pending', 'in_progress', 'resolved');
CREATE TYPE report_visibility AS ENUM ('admin', 'public');
CREATE TYPE smell_severity   AS ENUM ('warning', 'critical');
CREATE TYPE container_issue  AS ENUM ('none', 'full', 'smell', 'broken'); -- 'broken' = дефект
CREATE TYPE sensor_category  AS ENUM ('referent', 'nonreferent', 'city');
CREATE TYPE app_theme        AS ENUM ('light', 'dark');

-- ----------------------------------------------------------------------------
-- Автоматско ажурирање на updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- КОРИСНИЦИ
-- Секој ред е еден корисник. Профилните податоци, преференциите за
-- известувања и изгледот се посебни колони за тој корисник.
-- ============================================================================
CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              CITEXT UNIQUE,                    -- NULL за анонимни
  password_hash      TEXT,                             -- NULL ако логин е преку база на Град Скопје (SSO)
  display_name       TEXT,
  role               user_role NOT NULL DEFAULT 'user',
  organization_name  TEXT,                             -- за role = 'organization'
  is_anonymous       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Преференци за известувања (од SettingsPage)
  notif_air          BOOLEAN NOT NULL DEFAULT TRUE,
  notif_waste        BOOLEAN NOT NULL DEFAULT TRUE,
  notif_events       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Изглед и јазик (од SettingsPage)
  theme              app_theme NOT NULL DEFAULT 'light',
  language           TEXT NOT NULL DEFAULT 'mk'
                       CHECK (language IN ('mk', 'en', 'sq')),   -- избран јазик на корисникот

  -- Аватар (една слика по корисник) — бинарни податоци (BYTEA) во база
  avatar             BYTEA,

  -- Поени (гамификација): тековен збир од points_events за корисникот.
  -- 1 поен за поднесена пријава (контејнер/дива депонија), +2 кога е решена
  -- (вкупно 3). Анонимните корисници немаат поени.
  points             INTEGER NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- РЕФЕРЕНТНИ ТАБЕЛИ (шифрарници)
-- ============================================================================

-- Институции/сектори за насочување на пријавите
CREATE TABLE institutions (
  id         TEXT PRIMARY KEY,     -- пр. 'komunalna-higiena'
  label      TEXT NOT NULL,
  email      CITEXT,               -- за директно проследување на пријави (иднина)
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Типови/категории контејнери
CREATE TABLE container_kinds (
  id     TEXT PRIMARY KEY,         -- пр. 'mesan', 'podzemen'
  label  TEXT NOT NULL,
  color  TEXT                      -- UI badge клас
);

-- Сензори за квалитет на воздух (референтни МЖСПП, нереферентни Pulse Eco,
-- и идни сензори од Град Скопје). Живите мерења се кешираат тука.
CREATE TABLE sensors (
  id          TEXT PRIMARY KEY,           -- пр. 'WAQI-8104', 'PULSE-...'
  name        TEXT NOT NULL,
  area        TEXT,
  category    sensor_category NOT NULL,
  source      TEXT,                       -- 'МЖСПП (WAQI)', 'Pulse Eco', 'Град Скопје'
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  source_url  TEXT,

  -- последни кеширани мерења
  aqi         INTEGER,
  pm25        NUMERIC(6,2),
  pm10        NUMERIC(6,2),
  status      TEXT,                        -- 'good' | 'moderate' | 'unhealthy'
  measured_at TIMESTAMPTZ,                 -- време на мерење од изворот
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ПРИЈАВИ (обединети: миризба / депонија / контејнер)
-- Секоја слика е ПОСЕБНА КОЛОНА (photo_1 ... photo_6), макс. 6 по пријава.
-- Сликите се чуваат како BYTEA (бинарно, во база) — се сервираат преку
-- /api/reports/:id/photos/:n.
-- ============================================================================
CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             report_type NOT NULL,

  -- Кој ја поднел (NULL = анонимен граѓанин); reporter_name е денормализирано
  -- прикажано име во моментот на пријавата.
  reporter_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  reporter_name    TEXT,
  -- Уред на анонимен пријавувач („моите пријави" на тој уред, локален кеш).
  reporter_device_id TEXT,

  -- Локација
  location_label   TEXT,
  municipality     TEXT,             -- општина/општински дел (пр. Центар, Карпош)
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,

  description      TEXT,
  status           report_status NOT NULL DEFAULT 'pending',
  visibility       report_visibility NOT NULL DEFAULT 'admin',

  -- Насочување до институција/сектор
  institution_id           TEXT REFERENCES institutions(id),
  forwarded_institution_id TEXT REFERENCES institutions(id),  -- за опцијата „препрати“

  -- Полиња специфични за МИРИЗБА
  intensity        SMALLINT CHECK (intensity BETWEEN 1 AND 5),
  severity         smell_severity,

  -- Полиња специфични за КОНТЕЈНЕР
  container_kind_id TEXT REFERENCES container_kinds(id),
  container_issue   container_issue,
  fill_percent      SMALLINT CHECK (fill_percent BETWEEN 0 AND 100),

  -- Автоматско врзување до најблиска позната точка од OSM (контејнер/корпа),
  -- за да знае надлежната служба точно кој физички објект е пријавен.
  nearest_point_id         TEXT,
  nearest_point_type       TEXT,   -- 'recycling_container' | 'waste_basket'
  nearest_point_distance_m INTEGER,

  -- Фотографии — по една колона за секоја слика (макс. 6), бинарно (BYTEA) во база
  photo_1          BYTEA,
  photo_2          BYTEA,
  photo_3          BYTEA,
  photo_4          BYTEA,
  photo_5          BYTEA,
  photo_6          BYTEA,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX idx_reports_type       ON reports(type);
CREATE INDEX idx_reports_status     ON reports(status);
CREATE INDEX idx_reports_reporter   ON reports(reporter_id);
CREATE INDEX idx_reports_created    ON reports(created_at DESC);
CREATE INDEX idx_reports_institution ON reports(institution_id);

CREATE TRIGGER trg_reports_updated
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Историја на промени на статус (аудит + основа за „препрати“)
CREATE TABLE report_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status   report_status,
  new_status   report_status NOT NULL,
  changed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_history_report ON report_status_history(report_id);

-- ============================================================================
-- ЕКО НАСТАНИ (заедница)
-- ============================================================================
CREATE TABLE events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  event_date         DATE NOT NULL,
  location           TEXT,
  seats              INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'few_left' | 'closed'
  organizer_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  organizer_name     TEXT,
  cover_photo        BYTEA,                           -- една слика по настан (бинарно во база)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_events_updated
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_events_date ON events(event_date ASC);

-- Пријави на граѓани за настани (формата собира име/е-пошта/напомена)
CREATE TABLE event_signups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name     TEXT NOT NULL,
  email         CITEXT,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_signups_event ON event_signups(event_id);

-- ============================================================================
-- ИЗВЕСТУВАЊА
-- user_id = NULL значи општо (broadcast) известување за сите.
-- ============================================================================
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- ТОКЕНИ НА УРЕДИ (за push нотификации преку FCM)
-- Секој телефон што дозволил push има токен. Врзан е за корисник (ако е најавен)
-- или за анониминот уред (device_id). Админ уреди не се регистрираат.
-- ============================================================================
CREATE TABLE device_tokens (
  token        TEXT PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id    TEXT,                        -- анонимен идентитет по уред
  platform     TEXT,                        -- 'android' | 'ios' | 'web'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX idx_device_tokens_device ON device_tokens(device_id);

-- ============================================================================
-- ПОЕНИ / ЛИДЕРБОРД
-- Секоја акција што носи поени е посебен ред; збировите се пресметуваат.
-- ============================================================================
CREATE TABLE points_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points       INTEGER NOT NULL,
  reason       TEXT,                       -- пр. 'report_submitted', 'report_resolved'
  report_id    UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_user ON points_events(user_id);
CREATE INDEX idx_points_user_created ON points_events(user_id, created_at);
CREATE INDEX idx_points_created ON points_events(created_at);

-- Еден корисник добива поени само еднаш по (пријава, причина) — гарантирано на ниво база.
CREATE UNIQUE INDEX uq_points_report_reason
  ON points_events(report_id, reason)
  WHERE report_id IS NOT NULL;

-- Практичен поглед за месечен лидерборд
CREATE VIEW leaderboard_monthly AS
SELECT
  u.id            AS user_id,
  u.display_name,
  u.email,
  COALESCE(SUM(pe.points), 0) AS points
FROM users u
LEFT JOIN points_events pe
  ON pe.user_id = u.id
  AND pe.created_at >= date_trunc('month', now())
GROUP BY u.id, u.display_name, u.email
ORDER BY points DESC;
