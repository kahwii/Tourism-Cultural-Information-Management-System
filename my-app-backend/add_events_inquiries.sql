-- ============================================================
--  1.2 Events and Visitor Service Module
--   a) Maker-checker on events: CCAT Staff creates/edits -> the record
--      sits as "Pending" until a Super Admin / CCAT Admin approves it.
--      Only Approved events are visible on the public events page.
--   b) Visitor inquiries submitted from the public events page.
--
--  Run once in phpMyAdmin, with the TCIMS database already selected
--  in the left sidebar (local: tcims_db, live: if0_..._tcims_db).
--  No USE statement on purpose — the live InfinityFree user has no
--  rights to a database literally named "tcims_db".
-- ============================================================

-- a) events maker-checker
ALTER TABLE events
  ADD COLUMN approval_status ENUM('Pending','Approved','Rejected') DEFAULT 'Approved' AFTER status,
  ADD COLUMN submitted_by INT DEFAULT NULL AFTER approval_status,
  ADD COLUMN approved_by INT DEFAULT NULL AFTER submitted_by,
  ADD COLUMN approval_remarks TEXT DEFAULT NULL AFTER approved_by;

-- Existing events were created before this workflow existed — treat them
-- as already approved so nothing disappears from the public page.
UPDATE events SET approval_status = 'Approved' WHERE approval_status IS NULL;

-- b) visitor inquiries
CREATE TABLE IF NOT EXISTS inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,   -- for the per-IP submission rate limit
  status ENUM('Open','Answered') DEFAULT 'Open',
  reply TEXT DEFAULT NULL,
  answered_by INT DEFAULT NULL,
  answered_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
