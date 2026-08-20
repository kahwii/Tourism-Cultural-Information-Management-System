-- ============================================================
--  Adds an optional description to events. Run once (tcims_db).
-- ============================================================
USE tcims_db;
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL AFTER venue;
