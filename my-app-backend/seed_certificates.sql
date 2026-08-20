-- ============================================================
--  Seed: certificates (sample accreditation applications)
--  Run once in phpMyAdmin (tcims_db). Safe to re-run.
-- ============================================================
USE tcims_db;
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM certificate_documents;
DELETE FROM certificates;
ALTER TABLE certificates AUTO_INCREMENT = 1;
SET FOREIGN_KEY_CHECKS = 1;
INSERT INTO certificates
  (establishment, type, applicant, contact, address, submitted_date, status,
   control_no, business_account_no, or_no, issued, expiry, remarks)
VALUES
('Mandaluyong City Tours', 'Tourism Business', 'Maria Santos', '0917 123 4567',
 '12 Boni Avenue, Brgy. Plainview, Mandaluyong City', '6/10/2024', 'Under Review',
 '', '', '', '', '', ''),
('Shaw Boutique Hotel', 'Hotel', 'Carlos Reyes', '0918 234 5678',
 '88 Shaw Blvd., Brgy. Highway Hills, Mandaluyong City', '5/15/2024', 'Approved',
 '2024-00101', 'MC202400101', '5481200', 'May 15, 2024', 'May 15, 2025', 'Complete requirements.'),
('SM Megamall', 'Shopping Mall', 'Juan Dela Cruz', '0919 345 6789',
 'EDSA cor. Dona Julia Vargas Ave., Brgy. Wack-Wack, Mandaluyong City', '6/1/2024', 'Under Review',
 '', '', '', '', '', ''),
('Now Now', 'Restaurant', 'Chele Gonzalez', '0920 456 7890',
 'Ground Flr., Shangri-La Plaza, Brgy. Wack-Wack, Mandaluyong City', '6/12/2024', 'Under Review',
 '', '', '', '', '', '');
