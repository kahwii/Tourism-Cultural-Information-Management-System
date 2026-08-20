-- ============================================================
--  LOCAL CATCH-UP MIGRATION (XAMPP / tcims_db)
--
--  Everything added while we were working against the live server,
--  bundled into one file so the local database matches.
--
--  How to run: phpMyAdmin -> click `tcims_db` in the left sidebar
--  -> SQL tab -> paste this whole file -> Go.
--
--  Safe to re-run? Partly. The CREATE TABLE is guarded with
--  IF NOT EXISTS, but ALTER ... ADD COLUMN is not — if a column
--  already exists you'll get "Duplicate column name", which is
--  harmless. Just skip that block and run the rest.
-- ============================================================

USE tcims_db;

-- ---------- 1.1 Certificate module ----------
-- Business/Mayor's Permit capture + 30/60/90-day pickup reminders
-- with a 90-day claim deadline.
ALTER TABLE certificates
  ADD COLUMN business_permit_no VARCHAR(60) DEFAULT NULL AFTER type,
  ADD COLUMN approved_at DATETIME DEFAULT NULL AFTER expiry,
  ADD COLUMN pickup_deadline DATETIME DEFAULT NULL AFTER approved_at,
  ADD COLUMN picked_up_at DATETIME DEFAULT NULL AFTER pickup_deadline,
  ADD COLUMN last_reminder_sent INT DEFAULT 0 AFTER picked_up_at;

-- ---------- 1.2 Events maker-checker ----------
-- CCAT Staff submits -> Super Admin / CCAT Admin approves.
-- Only Approved events reach the public events page.
ALTER TABLE events
  ADD COLUMN approval_status ENUM('Pending','Approved','Rejected') DEFAULT 'Approved' AFTER status,
  ADD COLUMN submitted_by INT DEFAULT NULL AFTER approval_status,
  ADD COLUMN approved_by INT DEFAULT NULL AFTER submitted_by,
  ADD COLUMN approval_remarks TEXT DEFAULT NULL AFTER approved_by;

-- Events that existed before this workflow are treated as already
-- approved, so nothing silently disappears from the public page.
UPDATE events SET approval_status = 'Approved' WHERE approval_status IS NULL;

-- ---------- 1.2 Visitor inquiries ----------
-- ref_no and category are included directly in the CREATE below, so a
-- fresh local database needs no follow-up ALTER.
CREATE TABLE IF NOT EXISTS inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ref_no VARCHAR(20) DEFAULT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200),
  category VARCHAR(60) DEFAULT NULL,
  message TEXT NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,   -- per-IP submission rate limit
  status ENUM('Open','Answered') DEFAULT 'Open',
  reply TEXT DEFAULT NULL,
  answered_by INT DEFAULT NULL,
  answered_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- If `inquiries` already existed locally without the newer columns,
-- run these two lines instead of the CREATE above:
--   ALTER TABLE inquiries ADD COLUMN ref_no VARCHAR(20) DEFAULT NULL AFTER id;
--   ALTER TABLE inquiries ADD COLUMN category VARCHAR(60) DEFAULT NULL AFTER subject;
