-- ============================================================
--  Multi-session support: one user, multiple valid api_tokens
--
--  Until now, users.api_token was a single column — logging in on a second
--  device silently invalidated the first device's session (see
--  MOBILE_APP_INTEGRATION.md, "Known issue to fix before the demo"). That
--  breaks a demo that checks in on the phone app and expects the web admin,
--  signed in with the same account, to keep working.
--
--  This table holds one row per active login session. After this migration,
--  login.php / google_login.php / firebase_login.php INSERT a new row here
--  instead of overwriting users.api_token, and logout.php DELETEs only the
--  calling device's row. The users.api_token / token_last_used_at columns
--  are left in place (unused going forward) so nothing else that references
--  them breaks.
--
--  LOCAL (XAMPP): run as-is with tcims_db selected in phpMyAdmin.
--  TiDB / live: select the target database first, or replace tcims_db below.
-- ============================================================

USE tcims_db;

CREATE TABLE IF NOT EXISTS user_tokens (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_token (token),
  KEY idx_user_id (user_id),
  CONSTRAINT fk_user_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Carry forward anyone currently signed in, so existing sessions survive
-- the migration instead of being silently logged out.
INSERT INTO user_tokens (user_id, token, last_used_at)
SELECT id, api_token, token_last_used_at
FROM users
WHERE api_token IS NOT NULL AND api_token <> '';
