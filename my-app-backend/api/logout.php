<?php
/*
  Server-side logout — clears api_token so the token a "Logout" click leaves
  behind can't still be used by whoever might have a copy of it.

  Previously "Logout" only cleared localStorage in the browser (see
  AuthContext.jsx); the token itself stayed valid server-side until it
  either went idle (see config/auth.php's TOKEN_IDLE_MINUTES) or the user
  logged in again elsewhere. This makes the button do what it says.

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
    $stmt = mysqli_prepare($conn, "UPDATE users SET api_token = NULL, token_last_used_at = NULL WHERE api_token = ?");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
}

echo json_encode(["success" => true]);
