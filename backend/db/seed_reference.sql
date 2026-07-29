-- ==========================================================================
-- EkoSkopje — почетни (референтни) податоци
-- Изврши по `schema.sql`.
-- ==========================================================================

-- Институции/сектори за насочување на пријавите
INSERT INTO institutions (id, label) VALUES
  ('komunalna-higiena', 'Комунална хигиена'),
  ('parkovi-zelenilo',  'Паркови и зеленило'),
  ('zivotna-sredina',   'Сектор за животна средина'),
  ('komunalni-raboti',  'Сектор за комунални работи'),
  ('inspektorat',       'Инспекторат'),
  ('drugo',             'Друго / непознато')
ON CONFLICT (id) DO NOTHING;

-- Типови контејнери
INSERT INTO container_kinds (id, label, color) VALUES
  ('mesan',    'Мешан отпад',  'bg-slate-100 text-slate-700'),
  ('hartija',  'Хартија',      'bg-sky-100 text-sky-700'),
  ('plastika', 'Пластика',     'bg-amber-100 text-amber-700'),
  ('staklo',   'Стакло',       'bg-emerald-100 text-emerald-700'),
  ('podzemen', 'Подземен',     'bg-violet-100 text-violet-700'),
  ('kabast',   'Кабаст отпад', 'bg-rose-100 text-rose-700')
ON CONFLICT (id) DO NOTHING;

-- Референтни сензори (МЖСПП, Скопје) — почетни, ажурирани во живо преку WAQI
INSERT INTO sensors (id, name, area, category, source, lat, lng, source_url) VALUES
  ('WAQI-8103', 'Центар',      'Центар',       'referent', 'МЖСПП (WAQI)', 41.992433, 21.423616, 'https://air.moepp.gov.mk/'),
  ('WAQI-8104', 'Гази Баба',   'Гази Баба',    'referent', 'МЖСПП (WAQI)', 42.0036,   21.4636,   'https://air.moepp.gov.mk/'),
  ('WAQI-8105', 'Карпош',      'Карпош',       'referent', 'МЖСПП (WAQI)', 42.006694, 21.387028, 'https://air.moepp.gov.mk/'),
  ('WAQI-8106', 'Лисиче',      'Лисиче',       'referent', 'МЖСПП (WAQI)', 41.977840, 21.464474, 'https://air.moepp.gov.mk/'),
  ('WAQI-8107', 'Ректорат',    'Ректорат',     'referent', 'МЖСПП (WAQI)', 41.999139, 21.440714, 'https://air.moepp.gov.mk/'),
  ('WAQI-8108', 'Миладиновци', 'Миладиновци',  'referent', 'МЖСПП (WAQI)', 41.987456, 21.652478, 'https://air.moepp.gov.mk/')
ON CONFLICT (id) DO NOTHING;

-- Администраторски сметки (лозинката се поставува од backend со bcrypt hash)
INSERT INTO users (email, display_name, role, is_anonymous) VALUES
  ('admin@ekoskopje.mk', 'Супер Админ', 'admin', FALSE),
  ('inspekcija@ekoskopje.mk', 'Комунална Инспекција', 'admin_inspection', FALSE),
  ('sredina@ekoskopje.mk', 'Животна Средина', 'admin_environment', FALSE),
  ('higiena@ekoskopje.mk', 'Комунална Хигиена', 'admin_hygiene', FALSE)
ON CONFLICT (email) DO NOTHING;
