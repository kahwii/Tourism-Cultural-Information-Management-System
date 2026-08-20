<?php
/*
  Step 2 of email-based password reset.
  Verify the emailed code (+ expiry), then set the new password.
*/
require_once "../config/cors.php";
require_once "../config/db.php";

$data     = json_decode(file_get_contents("php://input"), true) ?: [];
$email    = trim($data['email'] ?? "");
$code     = trim($data['code'] ?? "");
$password = trim($data['password'] ?? "");

if ($email === "" || $code === "") {
    http_response_code(400);
    echo json_encode(["error" => "Email and code are required."]);
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

$stmt = mysqli_prepare($conn, "SELECT id, reset_code, reset_expires FROM users WHERE email = ? LIMIT 1");
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if (!$user || empty($user['reset_code']) || empty($user['reset_expires'])) {
    http_response_code(400);
    echo json_encode(["error" => "No active reset request. Please request a new code."]);
    exit;
}
if (strtotime($user['reset_expires']) < time()) {
    http_response_code(400);
    echo json_encode(["error" => "The code has expired. Please request a new one."]);
    exit;
}
if (!password_verify($code, $user['reset_code'])) {
    http_response_code(400);
    echo json_encode(["error" => "Incorrect code. Please check your email and try again."]);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$uid  = (int) $user['id'];
$st = mysqli_prepare($conn, "UPDATE users SET password = ?, reset_code = NULL, reset_expires = NULL, failed_attempts = 0, lockout_until = NULL WHERE id = ?");
mysqli_stmt_bind_param($st, "si", $hash, $uid);
mysqli_stmt_execute($st);

echo json_encode(["success" => true, "message" => "Password reset successfully. You can now sign in."]);
