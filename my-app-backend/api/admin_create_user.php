<?php
/*
  Admin-only: create a staff/admin (or any) account with a password.
  POST (JSON): { username, email, role, status, password }
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

// Approver-only: creating accounts (including other admins) must stay out of
// a CCAT Staff maker's hands, or they could grant themselves approver rights.
$authUser = require_approver($conn); // 401/403 if not CCAT Admin / Super Admin

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$username = trim($data['username'] ?? "");
$email    = trim($data['email'] ?? "");
$role     = trim($data['role'] ?? "");
$status   = trim($data['status'] ?? "Active");
$password = trim($data['password'] ?? "");

$ALLOWED_ROLES = ["Super Admin", "CCAT Admin", "CCAT Staff", "Establishment", "Tourist"];

if ($username === "" || $password === "") {
    http_response_code(400);
    echo json_encode(["error" => "Username and password are required."]);
    exit;
}
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(["error" => "Password must be at least 6 characters."]);
    exit;
}
if (!in_array($role, $ALLOWED_ROLES, true)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid role."]);
    exit;
}
if (!in_array($status, ["Active", "Inactive"], true)) $status = "Active";

// duplicate check (username, or email if provided)
$stmt = mysqli_prepare($conn, "SELECT id FROM users WHERE username = ? OR (email <> '' AND email = ?)");
$emailChk = $email;
mysqli_stmt_bind_param($stmt, "ss", $username, $emailChk);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
if (mysqli_stmt_num_rows($stmt) > 0) {
    http_response_code(409);
    echo json_encode(["error" => "A user with that username or email already exists."]);
    exit;
}
mysqli_stmt_close($stmt);

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = mysqli_prepare($conn, "INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, ?)");
mysqli_stmt_bind_param($stmt, "sssss", $username, $email, $hash, $role, $status);
if (mysqli_stmt_execute($stmt)) {
    echo json_encode(["success" => true, "id" => mysqli_insert_id($conn)]);
} else {
    http_response_code(500);
    echo json_encode(["error" => mysqli_error($conn)]);
}
