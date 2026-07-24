-- Час на одржување + порака за рачен потсетник од организаторот.
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_message TEXT;
