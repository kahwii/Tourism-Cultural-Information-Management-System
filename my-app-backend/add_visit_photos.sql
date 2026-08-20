USE tcims_db;
CREATE TABLE IF NOT EXISTS visit_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT DEFAULT NULL,
  place         VARCHAR(200) NOT NULL,
  photo_type    VARCHAR(20),          
  filename      VARCHAR(255),
  original_name VARCHAR(255),
  stored_path   VARCHAR(300),
  uploaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
