-- ============================================================
--  TCIMS — run this ONCE in phpMyAdmin (tcims_db > Import).
--  Combines all pending migrations for the accreditation feature.
--  Safe to re-run (uses IF NOT EXISTS — MariaDB / XAMPP).
-- ============================================================
USE tcims_db;

-- 1) link each certificate application to the Establishment that owns it
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS owner_id INT DEFAULT NULL AFTER id;

-- 2) real file uploads for requirement documents
ALTER TABLE certificate_documents
  ADD COLUMN IF NOT EXISTS doc_type      VARCHAR(80)  DEFAULT NULL AFTER certificate_id,
  ADD COLUMN IF NOT EXISTS original_name VARCHAR(255) DEFAULT NULL AFTER filename,
  ADD COLUMN IF NOT EXISTS stored_path   VARCHAR(300) DEFAULT NULL AFTER original_name,
  ADD COLUMN IF NOT EXISTS uploaded_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP;

-- 3) full DOT-style profile captured at establishment registration
CREATE TABLE IF NOT EXISTS establishment_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  first_name        VARCHAR(100),
  middle_name       VARCHAR(100),
  last_name         VARCHAR(100),
  sex               VARCHAR(10),
  account_type      VARCHAR(40),
  business_name     VARCHAR(200),
  establishment_type VARCHAR(80),
  region            VARCHAR(120),
  province          VARCHAR(120),
  city              VARCHAR(120),
  barangay          VARCHAR(120),
  business_address  VARCHAR(300),
  zip_code          VARCHAR(20),
  mobile            VARCHAR(40),
  telephone         VARCHAR(40),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
