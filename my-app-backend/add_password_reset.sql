-- Email-based password reset: store a hashed reset code + expiry.
-- Run once in phpMyAdmin (InfinityFree + local).
ALTER TABLE users
  ADD COLUMN reset_code VARCHAR(255) NULL,
  ADD COLUMN reset_expires DATETIME NULL;
