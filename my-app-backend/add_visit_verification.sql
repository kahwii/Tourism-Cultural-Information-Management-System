-- ============================================================
--  Heritage Trail — verified check-ins.
--
--  Bug: the `visits` table was written to by TWO different paths that both
--  ended up looking identical once saved:
--    - api/checkin.php  -> the real Heritage Trail check-in: requires GPS
--      proximity to the site AND a selfie + site photo as proof.
--    - api/visits.php   -> the Explore page's casual "check in" button:
--      no location check, no photo, just a self-report used to unlock the
--      feedback form.
--  config/heritage_trail.php's trail_status() (which gates the Heritage Mug
--  claim in claim_reward.php AND the Trail Certificate in certificate.php)
--  counted ANY row in `visits` for a trail church, from either path — so a
--  tourist could "complete" the entire Heritage Trail, and become eligible
--  for the real physical mug, just by tapping Explore's check-in button on
--  each church card. No GPS, no photo, no actually visiting anything.
--
--  Fix: a `verified` flag. checkin.php's real GPS+photo flow sets it to 1;
--  Explore's casual toggle leaves it 0. trail_status() now only counts
--  verified = 1.
--
--  Backfill: any (user_id, place) that already has a row in visit_photos
--  went through the real checkin.php flow at some point, so it's marked
--  verified retroactively. Everything else (including whatever the tester
--  racked up via Explore) stays unverified, which is the correct, honest
--  state — nobody's real, already-earned trail progress is lost, and no
--  fabricated progress is kept.
--
--  LOCAL (XAMPP): run as-is with `tcims_db` selected in phpMyAdmin.
--  LIVE: replace tcims_db below with if0_42398327_tcims_db, or just
--  select the database in the sidebar first and delete the USE line.
-- ============================================================

USE tcims_db;

ALTER TABLE visits
  ADD COLUMN verified TINYINT(1) NOT NULL DEFAULT 0 AFTER place;

UPDATE visits v
SET v.verified = 1
WHERE EXISTS (
  SELECT 1 FROM visit_photos vp
  WHERE vp.user_id = v.user_id AND vp.place = v.place
);
