-- ============================================================
--  1.4 Tourism Directory Module — contact information
--
--  Adds contact number, email, and website to every directory
--  listing so tourists can actually reach a place, and so CCAT
--  has a way to contact establishments about accreditation.
--
--  LOCAL (XAMPP): run as-is with `tcims_db` selected in phpMyAdmin.
--  LIVE: replace tcims_db below with if0_42398327_tcims_db, or just
--  select the database in the sidebar first and delete the USE line.
-- ============================================================

USE tcims_db;

ALTER TABLE tourist_spots
  ADD COLUMN contact_no VARCHAR(60) DEFAULT NULL AFTER address,
  ADD COLUMN email VARCHAR(190) DEFAULT NULL AFTER contact_no,
  ADD COLUMN website VARCHAR(255) DEFAULT NULL AFTER email;

ALTER TABLE restaurants
  ADD COLUMN contact_no VARCHAR(60) DEFAULT NULL AFTER address,
  ADD COLUMN email VARCHAR(190) DEFAULT NULL AFTER contact_no,
  ADD COLUMN website VARCHAR(255) DEFAULT NULL AFTER email;

ALTER TABLE hotels
  ADD COLUMN contact_no VARCHAR(60) DEFAULT NULL AFTER address,
  ADD COLUMN email VARCHAR(190) DEFAULT NULL AFTER contact_no,
  ADD COLUMN website VARCHAR(255) DEFAULT NULL AFTER email;

ALTER TABLE tourism_businesses
  ADD COLUMN contact_no VARCHAR(60) DEFAULT NULL AFTER address,
  ADD COLUMN email VARCHAR(190) DEFAULT NULL AFTER contact_no,
  ADD COLUMN website VARCHAR(255) DEFAULT NULL AFTER email;
