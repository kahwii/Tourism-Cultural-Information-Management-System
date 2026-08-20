-- ============================================================
--  Adds Business/Mayor's Permit Number capture, plus 30/60/90-day
--  unclaimed-certificate pickup reminders with a 90-day deadline.
--  Run once in phpMyAdmin, with the TCIMS database already selected
--  in the left sidebar (local: tcims_db, live: if0_..._tcims_db).
--  No USE statement here on purpose — the live InfinityFree user has
--  no rights to a database literally named "tcims_db".
-- ============================================================

ALTER TABLE certificates
  ADD COLUMN business_permit_no VARCHAR(60) DEFAULT NULL AFTER type,
  ADD COLUMN approved_at DATETIME DEFAULT NULL AFTER expiry,
  ADD COLUMN pickup_deadline DATETIME DEFAULT NULL AFTER approved_at,
  ADD COLUMN picked_up_at DATETIME DEFAULT NULL AFTER pickup_deadline,
  ADD COLUMN last_reminder_sent INT DEFAULT 0 AFTER picked_up_at;
