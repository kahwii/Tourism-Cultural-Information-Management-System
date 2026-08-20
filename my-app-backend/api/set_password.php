<?php
/*
  Set / change the logged-in user's password.
  Lets Google-registered accounts create a password so they can also log in
  with their email (as username) + password, not only via Google.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

$user = require_auth($conn); // 401 if not logged in

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$password = trim($data['password'] ?? "");

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
$uid = (int)$user['id'];
$stmt = mysqli_prepare($conn, "UPDATE users SET password = ? WHERE id = ?");
mysqli_stmt_bind_param($stmt, "si", $hash, $uid);
if (!mysqli_stmt_execute($stmt)) {
    http_response_code(500);
    echo json_encode(["error" => "Could not update password."]);
    exit;
}

echo json_encode([
    "success" => true,
    "message" => "Password updated.",
    "username" => $user['username'],
    "email" => $user['email']
]);
