-- Потсетник 24ч пред настан: еднаш по настан, само до пријавените учесници.
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
