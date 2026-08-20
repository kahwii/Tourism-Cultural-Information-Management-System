-- Nawasa Old Water Tank no longer exists in Mandaluyong.
-- Remove it from the live heritage sites list (and any related records).
-- Run once in phpMyAdmin.

DELETE FROM heritage_sites WHERE name = 'Nawasa Old Water Tank';

-- Clean up any check-ins / reviews that referenced it
DELETE FROM visits  WHERE place = 'Nawasa Old Water Tank';
DELETE FROM reviews WHERE place = 'Nawasa Old Water Tank';
