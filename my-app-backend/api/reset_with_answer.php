<?php
/*
  Step 2 of security-question password recovery.
  Verify the answer to the account's security question, then set a new password.
*/
require_once "../config/cors.php";
require_once "../config/db.php";

$data     = json_decode(file_get_contents("php://input"), true) ?: [];
$username = trim($data['username'] ?? "");
$answer   = trim($data['answer'] ?? "");
$password = trim($data['password'] ?? "");

if ($username === "" || $answer === "") {
    http_response_code(400);
    echo json_encode(["error" => "Username and answer are required."]);
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

$stmt = mysqli_prepare($conn, "SELECT id, security_answer FROM users WHERE (username = ? OR email = ?) LIMIT 1");
mysqli_stmt_bind_param($stmt, "ss", $username, $username);
mysqli_stmt_execute($stmt);
$user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if (!$user || empty($user['security_answer'])) {
    http_response_code(400);
    echo json_encode(["error" => "No security question is set for this account."]);
    exit;
}
// answers are stored hashed + lowercased (case-insensitive match)
if (!password_verify(strtolower($answer), $user['security_answer'])) {
    http_response_code(400);
    echo json_encode(["error" => "Incorrect answer. Please try again."]);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$uid  = (int) $user['id'];
$st = mysqli_prepare($conn, "UPDATE users SET password = ?, failed_attempts = 0, lockout_until = NULL WHERE id = ?");
mysqli_stmt_bind_param($st, "si", $hash, $uid);
mysqli_stmt_execute($st);

echo json_encode(["success" => true, "message" => "Password reset successfully. You can now sign in."]);
