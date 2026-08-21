-- ============================================================
--  Tourist Spots + Heritage Sites — connect admin to the public site
--
--  Until now, the Explore/Trail pages tourists actually see were built
--  from a hardcoded list in the frontend (src/data/tcimsData.js), not
--  from these tables. The admin "Tourist Spots" / "Heritage Sites" CRUD
--  pages edited a database that nothing public ever read — an edit here
--  had zero effect on what a tourist saw. This migration adds the columns
--  needed to fully represent that hardcoded list in the database (GPS
--  coordinates + a real photo for tourist_spots, a tagline for heritage
--  trail cards), so migrate_places.php can seed it and the frontend can
--  be pointed at these tables instead of the static file.
--
--  LOCAL (XAMPP): run as-is with `tcims_db` selected in phpMyAdmin.
--  LIVE: replace tcims_db below with if0_42398327_tcims_db, or just
--  select the database in the sidebar first and delete the USE line.
-- ============================================================

USE tcims_db;

ALTER TABLE tourist_spots
  ADD COLUMN coordinates VARCHAR(60) DEFAULT NULL AFTER website,
  ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER coordinates;

ALTER TABLE heritage_sites
  ADD COLUMN tagline VARCHAR(255) DEFAULT NULL AFTER category;
