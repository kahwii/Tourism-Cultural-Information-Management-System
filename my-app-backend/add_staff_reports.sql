-- ============================================================
--  STAFF OPERATIONS REPORTS
--
--  WHY A SEPARATE TABLE
--  --------------------
--  The mobile app's staff operations report was being filed through
--  api/inquiries.php, which is the PUBLIC visitor-question form. That worked,
--  but it was the wrong pipe for two reasons:
--
--   1. Wrong folder. A 2,000-character internal report landed in the same
--      inbox as "what time does the church open", mixed in with the public's
--      questions.
--
--   2. No way back. When an admin answers an inquiry, the reply goes out by
--      EMAIL to the address on the inquiry. A staff member working inside the
--      app never sees it. They file a report and hear nothing — there is no
--      channel for the office to answer them where they are.
--
--  Point 2 is what a category filter could not fix, and is why this exists.
--
--  ACCESS MODEL (enforced in api/reports.php, not here)
--  ----------------------------------------------------
--  Deliberately split along maker-checker, NOT along is_admin_role():
--  CCAT Staff counts as "admin" in this system, so using that as the divide
--  would let every staff member read every other staff member's reports and
--  the distinction would collapse.
--
--    CCAT Staff                  -> files reports, reads ONLY their own
--    Super Admin / CCAT Admin    -> reads all, replies (is_approver_role)
--
--  LOCAL (XAMPP): run with tcims_db selected in phpMyAdmin.
--  LIVE (TiDB Cloud): add `USE tcims_db;` above, or select the database first.
-- ============================================================

CREATE TABLE IF NOT EXISTS reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,                                  -- who filed it (users.id)
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,                                 -- no 2,000-char cap here
  status      ENUM('New','Read','Replied') NOT NULL DEFAULT 'New',
  admin_reply TEXT     DEFAULT NULL,
  replied_at  DATETIME DEFAULT NULL,
  replied_by  INT      DEFAULT NULL,                         -- which approver answered (users.id)
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reports_user (user_id),
  INDEX idx_reports_status (status)
);

-- Verify: should list the columns above.
DESCRIBE reports;
