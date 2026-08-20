<?php
/*
  Admin-assisted password reset.
  An admin sets a new password for any user (used when a user forgot theirs).
  Also clears any lockout so the user can sign in again.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

// Approver-only: resetting another user's password is effectively taking over
// their account, so it stays with CCAT Admin / Super Admin.
$admin = require_approver($conn); // 403 if not CCAT Admin / Super Admin

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$uid = (int) ($data['user_id'] ?? 0);
$password = trim($data['password'] ?? "");

if ($uid <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "A valid user is required."]);
    exit;
}
// Password policy: min 8, upper, lower, number, special symbol.
if (strlen($password) < 8
    || !preg_match('/[A-Z]/', $password)
    || !preg_match('/[a-z]/', $password)
    || !preg_match('/[0-9]/', $password)
    || !preg_match('/[^A-Za-z0-9]/', $password)) {
    http_response_code(400);
    echo json_encode(["error" => "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special symbol."]);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = mysqli_prepare($conn, "UPDATE users SET password = ?, failed_attempts = 0, lockout_until = NULL WHERE id = ?");
mysqli_stmt_bind_param($stmt, "si", $hash, $uid);
if (mysqli_stmt_execute($stmt)) {
    // audit trail: which account's password was reset (never log the password itself)
    $tn = ""; $r = @mysqli_query($conn, "SELECT username FROM users WHERE id = $uid");
    if ($r && ($row = mysqli_fetch_assoc($r))) $tn = $row['username'];
    log_activity($conn, $admin, "Password Reset", "users", "Reset password for user: " . ($tn ?: "#$uid"));
    echo json_encode(["success" => true, "message" => "Password reset successfully."]);
} else {
    http_response_code(500);
    echo json_encode(["error" => "Could not reset password."]);
}
