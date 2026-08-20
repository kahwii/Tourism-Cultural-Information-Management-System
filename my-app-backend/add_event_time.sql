-- ============================================================
--  Adds start/end time to events. Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_time TIME DEFAULT NULL AFTER event_date,
  ADD COLUMN IF NOT EXISTS end_time   TIME DEFAULT NULL AFTER start_time;
