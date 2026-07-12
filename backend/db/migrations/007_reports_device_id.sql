-- Идентификатор на уредот што ја поднел пријавата (за АНОНИМНИ корисници).
-- Регистрираните се врзани преку reporter_id (UUID во users); анонимните немаат
-- запис во users, па „моите пријави" на нивниот уред се препознаваат по ова поле
-- (истиот device id што апликацијата го чува локално во кешот на уредот).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reporter_device_id TEXT;

-- Брзо филтрирање „мои пријави" по уред.
CREATE INDEX IF NOT EXISTS idx_reports_device ON reports(reporter_device_id)
  WHERE reporter_device_id IS NOT NULL;
