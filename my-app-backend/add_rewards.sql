-- ============================================================
--  Trail completion reward (physical Heritage Mug claim).
--  Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
CREATE TABLE IF NOT EXISTS rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  reward      VARCHAR(150) DEFAULT 'Mandaluyong Heritage Mug',
  code        VARCHAR(40) UNIQUE,
  status      ENUM('Unclaimed','Claimed') DEFAULT 'Unclaimed',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  claimed_at  DATETIME DEFAULT NULL
);
