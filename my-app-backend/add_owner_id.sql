-- ============================================================
--  Adds owner_id to certificates so an Establishment account
--  is linked to the applications it submits.
--  Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
ALTER TABLE certificates
  ADD COLUMN owner_id INT DEFAULT NULL AFTER id;
