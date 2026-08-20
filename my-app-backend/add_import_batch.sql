-- Adds batch tracking to `reviews` so a bulk CSV import (historical/manual
-- feedback) can be identified and removed as a whole later, instead of only
-- one row at a time. Existing rows are unaffected (import_batch stays NULL).
-- Run this once in phpMyAdmin, same as the other add_*.sql files.

ALTER TABLE reviews
  ADD COLUMN import_batch VARCHAR(40) DEFAULT NULL AFTER comment,
  ADD COLUMN imported_by VARCHAR(150) DEFAULT NULL AFTER import_batch,
  ADD INDEX idx_reviews_import_batch (import_batch);
