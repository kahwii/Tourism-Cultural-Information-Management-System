-- Admin Activity Log (audit trail). Run once in phpMyAdmin (InfinityFree + local).
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(100) NULL,
  role VARCHAR(50) NULL,
  action VARCHAR(50) NOT NULL,
  target VARCHAR(150) NULL,
  details VARCHAR(500) NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
