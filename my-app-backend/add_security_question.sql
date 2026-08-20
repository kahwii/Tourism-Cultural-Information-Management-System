-- Self-service password recovery via a security question (no email needed).
-- Run once in phpMyAdmin (InfinityFree + local).
ALTER TABLE users
  ADD COLUMN security_question VARCHAR(255) NULL,
  ADD COLUMN security_answer VARCHAR(255) NULL;
