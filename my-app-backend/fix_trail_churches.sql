-- ============================================================
--  HERITAGE TRAIL — align the database with the mobile app's 9 churches
--
--  THE PROBLEM
--  -----------
--  heritage_sites held TWELVE rows with category = 'Church', but three of
--  them are the same physical church entered twice under a different name:
--
--    id 10 "Archdiocese of the Divine Mercy"      = id 34 "Archdiocesan Shrine of the Divine Mercy"
--    id  9 "Saint Dominic Savio Parish Church"    = id 33 "St. Dominic Savio Parish Church"
--    id  2 "San Roque de Mandaluyong Church"      = id 32 "San Roque de Barangka Parish Church"
--
--  That is not only a cosmetic duplicate in the tourist Trail list. The
--  completion gate (config/heritage_trail.php -> trail_churches) counts every
--  row with category = 'Church', so the server demanded 12 stops while the
--  mobile app only ever offers 9. NOBODY COULD COMPLETE THE TRAIL: the
--  Heritage Mug and the Trail Certificate could never be issued, on either
--  platform.
--
--  Two more rows had names that differ from what the app posts on check-in:
--
--    id 1 "San Felipe Neri Church"        app sends "San Felipe Neri Parish Church"
--    id 4 "St. Francis of Assisi Church"  app sends "St. Francis of Assisi Parish Church"
--
--  visits.place is matched by NAME, so check-ins done in the app for those
--  two churches would never have counted on the website even after the
--  duplicates were removed.
--
--  THE FIX
--  -------
--  Make the database's 9 church names character-for-character identical to
--  the app's list (lib/heritage.dart, kChurches), so one account sees one
--  trail no matter which platform it checks in from.
--
--  The rows KEPT are the richer ones (they carry taglines, full addresses and
--  photos); the rows removed are the sparse duplicates.
--
--  Existing tourist data is migrated, not discarded: visits, visit_photos and
--  reviews that point at an old name are repointed at the canonical one
--  FIRST, so nobody loses trail progress, photo proof, or feedback history.
--
--  LOCAL (XAMPP): run with tcims_db selected in phpMyAdmin.
--  LIVE (TiDB Cloud): select the production database in the SQL Editor first,
--  then run everything below. Both must be done, or the two environments
--  disagree about what the trail is.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Repoint existing tourist data at the canonical church names.
--    Done before touching heritage_sites so that progress earned under an
--    old name survives the cleanup.
-- ------------------------------------------------------------
UPDATE visits SET place = 'Archdiocesan Shrine of the Divine Mercy' WHERE place = 'Archdiocese of the Divine Mercy';
UPDATE visits SET place = 'St. Dominic Savio Parish Church'        WHERE place = 'Saint Dominic Savio Parish Church';
UPDATE visits SET place = 'San Roque de Barangka Parish Church'    WHERE place = 'San Roque de Mandaluyong Church';
UPDATE visits SET place = 'San Felipe Neri Parish Church'          WHERE place = 'San Felipe Neri Church';
UPDATE visits SET place = 'St. Francis of Assisi Parish Church'    WHERE place = 'St. Francis of Assisi Church';

UPDATE visit_photos SET place = 'Archdiocesan Shrine of the Divine Mercy' WHERE place = 'Archdiocese of the Divine Mercy';
UPDATE visit_photos SET place = 'St. Dominic Savio Parish Church'        WHERE place = 'Saint Dominic Savio Parish Church';
UPDATE visit_photos SET place = 'San Roque de Barangka Parish Church'    WHERE place = 'San Roque de Mandaluyong Church';
UPDATE visit_photos SET place = 'San Felipe Neri Parish Church'          WHERE place = 'San Felipe Neri Church';
UPDATE visit_photos SET place = 'St. Francis of Assisi Parish Church'    WHERE place = 'St. Francis of Assisi Church';

UPDATE reviews SET place = 'Archdiocesan Shrine of the Divine Mercy' WHERE place = 'Archdiocese of the Divine Mercy';
UPDATE reviews SET place = 'St. Dominic Savio Parish Church'        WHERE place = 'Saint Dominic Savio Parish Church';
UPDATE reviews SET place = 'San Roque de Barangka Parish Church'    WHERE place = 'San Roque de Mandaluyong Church';
UPDATE reviews SET place = 'San Felipe Neri Parish Church'          WHERE place = 'San Felipe Neri Church';
UPDATE reviews SET place = 'St. Francis of Assisi Parish Church'    WHERE place = 'St. Francis of Assisi Church';

-- ------------------------------------------------------------
-- 2. Collapse any duplicate check-ins created by step 1.
--    A tourist who checked in under BOTH names now has two rows for the same
--    church. Keep one — and if either of them was the real GPS+photo
--    verified check-in, the survivor keeps that verified status, so no
--    genuine trail progress is downgraded.
-- ------------------------------------------------------------
UPDATE visits v
JOIN (
  SELECT MIN(id) AS keep_id, MAX(verified) AS any_verified
  FROM visits
  GROUP BY user_id, place
  HAVING COUNT(*) > 1
) d ON v.id = d.keep_id
SET v.verified = d.any_verified;

DELETE v FROM visits v
JOIN (
  SELECT user_id, place, MIN(id) AS keep_id
  FROM visits
  GROUP BY user_id, place
  HAVING COUNT(*) > 1
) d ON v.user_id = d.user_id AND v.place = d.place AND v.id <> d.keep_id;

-- ------------------------------------------------------------
-- 3. Rename the two churches whose names didn't match the app.
-- ------------------------------------------------------------
UPDATE heritage_sites SET name = 'San Felipe Neri Parish Church'       WHERE id = 1;
UPDATE heritage_sites SET name = 'St. Francis of Assisi Parish Church' WHERE id = 4;

-- The separator in this tagline was stored as mojibake ("Established 1863 ??
-- Oldest in the city") — a UTF-8 string written through a latin1 connection.
-- Tourists see it on the Trail page, so it is corrected here.
UPDATE heritage_sites
SET tagline = 'Established 1863 · Oldest in the city'
WHERE id = 1;

-- ------------------------------------------------------------
-- 4. Remove the three duplicate church rows.
--    Deleted by id rather than by name so this cannot accidentally match a
--    legitimately-renamed row later.
-- ------------------------------------------------------------
DELETE FROM heritage_sites WHERE id IN (10, 9, 2);

-- ------------------------------------------------------------
-- 5. Verify. Both queries must agree with the app.
-- ------------------------------------------------------------
--   Expect exactly 9 rows, matching lib/heritage.dart's kChurches:
--     Archdiocesan Shrine of the Divine Mercy
--     Our Lady of Fatima Parish Church
--     Our Lady of the Abandoned Parish
--     Sacred Heart of Jesus Parish Church
--     San Felipe Neri Parish Church
--     San Roque de Barangka Parish Church
--     Santuario de San Jose Parish Church
--     St. Dominic Savio Parish Church
--     St. Francis of Assisi Parish Church
SELECT id, name FROM heritage_sites WHERE category = 'Church' ORDER BY name;

--   Expect 9 — this is the number trail_status() will demand for the mug.
SELECT COUNT(*) AS trail_length FROM heritage_sites WHERE category = 'Church';
