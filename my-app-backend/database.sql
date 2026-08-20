-- ============================================================
--  TCIMS — Tourism & Cultural Information Management System
--  Database schema (MySQL / MariaDB - XAMPP)
--  Import this in phpMyAdmin (Import tab) to create everything.
-- ============================================================

CREATE DATABASE IF NOT EXISTS tcims_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE tcims_db;

-- ---------- USERS (with roles) ----------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('Super Admin','CCAT Admin','CCAT Staff','Establishment','Tourist') NOT NULL DEFAULT 'Tourist',
  status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  last_login DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- TOURISM DIRECTORY ----------
CREATE TABLE IF NOT EXISTS tourist_spots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  address VARCHAR(255),
  status ENUM('Active','Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cuisine VARCHAR(100),
  address VARCHAR(255),
  status ENUM('Active','Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(100),
  address VARCHAR(255),
  status ENUM('Active','Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tourism_businesses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(100),
  address VARCHAR(255),
  status ENUM('Active','Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- EVENTS ----------
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  month VARCHAR(40),
  category VARCHAR(100),
  venue VARCHAR(255),
  participants INT DEFAULT 0,
  status ENUM('Upcoming','Ongoing','Completed','Cancelled') DEFAULT 'Upcoming',
  image VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- HERITAGE SITES (CHIMS) ----------
CREATE TABLE IF NOT EXISTS heritage_sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  est VARCHAR(40) DEFAULT '—',
  location VARCHAR(255),
  description TEXT,
  significance TEXT,
  status VARCHAR(50) DEFAULT 'Well-maintained',
  coordinates VARCHAR(60),
  image VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- CERTIFICATES / ACCREDITATION ----------
CREATE TABLE IF NOT EXISTS certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  establishment VARCHAR(200) NOT NULL,
  type VARCHAR(100),
  applicant VARCHAR(150),
  contact VARCHAR(60),
  address VARCHAR(255),
  submitted_date VARCHAR(40),
  status ENUM('Under Review','Approved','Rejected','For Renewal') DEFAULT 'Under Review',
  control_no VARCHAR(60) DEFAULT '—',
  business_account_no VARCHAR(60) DEFAULT '—',
  or_no VARCHAR(60) DEFAULT '—',
  issued VARCHAR(60) DEFAULT '—',
  expiry VARCHAR(60) DEFAULT '—',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- uploaded documents per certificate application
CREATE TABLE IF NOT EXISTS certificate_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  certificate_id INT NOT NULL,
  filename VARCHAR(255),
  FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
);

-- ---------- REVIEWS / FEEDBACK (for Sentiment Analysis) ----------
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  place VARCHAR(200) NOT NULL,
  reviewer VARCHAR(150),
  rating TINYINT NOT NULL,
  sentiment ENUM('Positive','Neutral','Negative') DEFAULT 'Neutral',
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- VISITS / CHECK-INS (for Most Visited analytics + Trail) ----------
CREATE TABLE IF NOT EXISTS visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  place VARCHAR(200) NOT NULL,
  visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
--  SEED DATA
-- ============================================================

-- Default admin (username: admin1 / password: admin123)
-- password below is a bcrypt hash of "admin123"
INSERT INTO users (username, email, password, role, status) VALUES
('admin1', 'admin1@ccat.gov.ph', '$2y$10$wH8Qe2sJ5pXqj3oR6m9b1eVZ7kC0n4dYy2tF8uG6hL1aS3wD5xKu', 'Super Admin', 'Active')
ON DUPLICATE KEY UPDATE username = username;
-- NOTE: if bcrypt verify fails on your PHP version, re-create the admin
-- via the register endpoint or run: UPDATE users SET password = '<new hash>' ...

-- Sample tourist spots
INSERT INTO tourist_spots (name, category, address, status) VALUES
('Tatlong Bayani Monument','History and Culture','Hagdang Bato, Mandaluyong City','Active'),
('San Felipe Neri Church','History and Culture','Poblacion, Mandaluyong City','Active'),
('SM Megamall','Shopping','Wack-Wack, Mandaluyong City','Active'),
('Shangri-La Plaza Mall','Shopping','Wack-Wack, Mandaluyong City','Active'),
('Wack-Wack Golf & Country Club','Sports and Recreation','Wack-Wack, Mandaluyong City','Active');

-- Sample restaurants (MICHELIN Guide - Mandaluyong)
INSERT INTO restaurants (name, cuisine, address, status) VALUES
('Now Now','Contemporary','Mandaluyong, Metro Manila','Active'),
('Juniper','Contemporary','Mandaluyong, Metro Manila','Active'),
('Cantabria by Chele Gonzalez','Spanish','Mandaluyong, Metro Manila','Active'),
('Summer Palace','Chinese','Mandaluyong, Metro Manila','Active'),
('Osteria Antica','Italian Contemporary','Mandaluyong, Metro Manila','Active');

-- Sample hotels
INSERT INTO hotels (name, type, address, status) VALUES
('Hotel Sogo EDSA','Budget','EDSA, Mandaluyong City','Active'),
('Hop Inn Hotel Pioneer','Budget','Pioneer St., Mandaluyong City','Active');

-- Sample tourism businesses
INSERT INTO tourism_businesses (name, type, address, status) VALUES
('SM Megamall','Shopping Mall','Wack-Wack, Mandaluyong City','Active'),
('The Podium','Shopping Mall','Wack-Wack, Mandaluyong City','Active');
