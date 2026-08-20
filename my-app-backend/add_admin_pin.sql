-- Admin 2-step login: an optional 6-digit PIN (hashed) required after password.
-- Run once in phpMyAdmin (InfinityFree + local).
ALTER TABLE users
  ADD COLUMN admin_pin VARCHAR(255) NULL;
