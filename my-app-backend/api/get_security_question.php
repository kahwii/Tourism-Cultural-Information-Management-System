<?php
/*
  Step 1 of security-question password recovery.
  Given a username (or email), return that account's security question.
*/
require_once "../config/cors.php";
require_once "../config/db.php";

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$username = trim($data['username'] ?? "");

if ($username === "") {
    http_response_code(400);
    echo json_encode(["error" => "Username or email is required."]);
    exit;
}

$stmt = mysqli_prepare($conn, "SELECT security_question FROM users WHERE (username = ? OR email = ?) AND security_question IS NOT NULL AND security_question <> '' LIMIT 1");
mysqli_stmt_bind_param($stmt, "ss", $username, $username);
mysqli_stmt_execute($stmt);
$user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if (!$user) {
    http_response_code(404);
    echo json_encode(["error" => "No security question is set for this account. Please contact the CCAT admin to reset your password."]);
    exit;
}
echo json_encode(["success" => true, "question" => $user['security_question']]);
