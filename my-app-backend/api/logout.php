<?php
/*
  Server-side logout — deletes THIS session's row from user_tokens so the
  token a "Logout" click leaves behind can't still be used by whoever might
  have a copy of it.

  Multi-session: only the calling device's token is removed. Other devices
  signed into the same account (e.g. the phone app, if the web is what
  logged out) are untouched — see add_user_tokens.sql.

  Previously "Logout" only cleared localStorage in the browser (see
  AuthContext.jsx); the token itself stayed valid server-side until it
  either went idle (see config/auth.php's TOKEN_IDLE_MINUTES) or was
  overwritten by a new login. This makes the button do what it says.

  POST, no body needed — acts on whichever token is in the Authorization
  header. Safe to call even if the token is already invalid/expired.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed."]);
    exit;
}

$token = bearer_token();
if ($token !== '') {
    $stmt = mysqli_prepare($conn, "DELETE FROM user_tokens WHERE token = ?");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
}

echo json_encode(["success" => true]);
