-- Adds a poster/banner image to events. Run once (tcims_db).
-- Stores a relative path (e.g. uploads/events/ev_xxxx.jpg), same convention
-- as heritage_sites.image. Served as a static file by Apache.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS image VARCHAR(255) DEFAULT NULL AFTER description;
