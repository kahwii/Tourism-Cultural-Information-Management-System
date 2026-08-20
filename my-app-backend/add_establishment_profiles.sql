-- ============================================================
--  Stores the full DOT-style profile captured at establishment
--  registration. Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
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
