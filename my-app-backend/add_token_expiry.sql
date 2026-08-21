-- ============================================================
--  Server-side session expiry for api_token
--
--  Until now, api_token never expired server-side — only a client-side JS
--  timer (AuthContext.jsx, 15 min of inactivity) cleared it from the
--  browser. The token itself stayed valid forever: a copied/leaked token
--  (lost laptop still logged in, browser dev tools, malware reading
--  localStorage) worked indefinitely, with no way to revoke it short of
--  changing the password. This adds a real, enforced idle timeout —
--  see config/auth.php's current_user().
--
--  LOCAL (XAMPP): run as-is with `tcims_db` selected in phpMyAdmin.
--  LIVE: replace tcims_db below with if0_42398327_tcims_db, or just
--  select the database in the sidebar first and delete the USE line.
-- ============================================================

USE tcims_db;

ALTER TABLE users
  ADD COLUMN token_last_used_at DATETIME DEFAULT NULL AFTER api_token;
