-- ============================================================
--  Adds a real date to events (keeps `month` for calendar grouping).
--  Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_date DATE DEFAULT NULL AFTER name;
