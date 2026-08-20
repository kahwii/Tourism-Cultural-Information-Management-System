-- ============================================================
--  Visitor inquiry reference numbers (INQ-YYYY-NNNN).
--  Given to the visitor in the on-screen confirmation and in the
--  acknowledgment email, so they have something to quote on follow-up.
--
--  Table names are fully qualified for the LIVE database so this runs
--  no matter which phpMyAdmin page you're on. For LOCAL XAMPP, replace
--  `if0_42398327_tcims_db` with `tcims_db` first.
-- ============================================================

ALTER TABLE `if0_42398327_tcims_db`.`inquiries`
  ADD COLUMN ref_no VARCHAR(20) DEFAULT NULL AFTER id,
  ADD COLUMN category VARCHAR(60) DEFAULT NULL AFTER subject;
