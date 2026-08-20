-- ============================================================
--  Extends certificate_documents to support real file uploads.
--  Run once in phpMyAdmin (tcims_db).
-- ============================================================
USE tcims_db;
ALTER TABLE certificate_documents
  ADD COLUMN doc_type      VARCHAR(80)  DEFAULT NULL AFTER certificate_id,
  ADD COLUMN original_name VARCHAR(255) DEFAULT NULL AFTER filename,
  ADD COLUMN stored_path   VARCHAR(300) DEFAULT NULL AFTER original_name,
  ADD COLUMN uploaded_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP;
