-- ============================================================
--  1.4 Tourism Directory Module — photos for restaurants, hotels,
--  and tourism businesses.
--
--  Tourist Spots and Heritage Sites already had an `image` column;
--  this brings Restaurants/Hotels/Tourism Businesses to parity so
--  admins can attach a photo, and so the tourist Explore page can
--  show these places as their own browsable cards (not just as
--  contact info attached to a Tourist Spot with a matching name).
--
--  LOCAL (XAMPP): run as-is with `tcims_db` selected in phpMyAdmin.
--  LIVE: replace tcims_db below with if0_42398327_tcims_db, or just
--  select the database in the sidebar first and delete the USE line.
-- ============================================================

USE tcims_db;

ALTER TABLE restaurants
  ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER website;

ALTER TABLE hotels
  ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER website;

ALTER TABLE tourism_businesses
  ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER website;
