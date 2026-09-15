-- ============================================================
--  POST-EVENT REPORT
--
--  CCAT staff file a short account after an event has run — what happened,
--  how many came, anything worth noting. The mobile app collects it, but the
--  events table had nowhere to put the narrative, so migrating events off
--  Firestore would have silently dropped it.
--
--  ATTENDANCE ALREADY HAS A HOME
--  -----------------------------
--  `events.participants` (INT DEFAULT 0) already exists. It is in the crud.php
--  whitelist and in seed_events.sql, but no screen reads or writes it — it has
--  been an orphan column since the original schema. The app's attendance count
--  goes there rather than adding a second numeric column that means the same
--  thing.
--
--  Worth stating plainly, because the name invites the other reading: from now
--  on `participants` means ACTUAL ATTENDANCE recorded after the event, not an
--  expected or target figure. Nothing else uses the column, so it is free to
--  define — but it has to be defined once, on purpose, or the two meanings
--  will drift apart across the app and the website.
--
--  reported_at is set by the server when a report is saved (see crud.php), not
--  by the client, so it records when CCAT actually received the report rather
--  than whatever the phone's clock said.
--
--  LOCAL (XAMPP): run with tcims_db selected in phpMyAdmin.
--  LIVE (TiDB Cloud): add `USE tcims_db;` above, or select the database first.
-- ============================================================

-- Two statements on purpose. Combining them and writing
--   ADD COLUMN reported_at ... AFTER post_event_report
-- in the same ALTER fails on TiDB with "Unknown column 'post_event_report'":
-- MySQL resolves an AFTER clause against columns added earlier in the same
-- statement, TiDB resolves it against the table as it already exists. Split
-- like this, it runs on both.
ALTER TABLE events ADD COLUMN post_event_report TEXT DEFAULT NULL AFTER approval_remarks;

ALTER TABLE events ADD COLUMN reported_at DATETIME DEFAULT NULL AFTER post_event_report;

-- Verify: post_event_report and reported_at should appear, and `participants`
-- should already be there from the base schema.
DESCRIBE events;
