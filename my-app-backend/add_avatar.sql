-- Profile pictures. Run once in phpMyAdmin (InfinityFree + local).
ALTER TABLE users
  ADD COLUMN avatar VARCHAR(255) NULL;
