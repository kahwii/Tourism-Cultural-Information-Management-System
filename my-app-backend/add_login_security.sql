-- Login security: track failed attempts + temporary lockout.
-- Run once in phpMyAdmin (InfinityFree + local).
ALTER TABLE users
  ADD COLUMN failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN lockout_until DATETIME NULL;
