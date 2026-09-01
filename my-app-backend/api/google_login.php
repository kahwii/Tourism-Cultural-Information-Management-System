<?php
/*
  Google sign-in. The frontend sends the Google ID token (credential);
  we verify it with Google, then find-or-create a Tourist account and
  issue our own API token (same shape as login.php).
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/google.php";

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$credential = trim($data['credential'] ?? "");
if ($credential === "") {
    http_response_code(400);
    echo json_encode(["error" => "Missing Google credential."]);
    exit;
}

// --- verify the ID token with Google ---
$url = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($credential);
$raw = @file_get_contents($url);
if ($raw === false && function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $raw = curl_exec($ch);
    curl_close($ch);
}
$info = $raw ? json_decode($raw, true) : null;

if (!$info || !isset($info['aud'])) {
    http_response_code(401);
    echo json_encode(["error" => "Could not verify Google token."]);
    exit;
}
if ($info['aud'] !== GOOGLE_CLIENT_ID) {
    http_response_code(401);
    echo json_encode(["error" => "Google token was issued for a different app."]);
    exit;
}
$emailVerified = ($info['email_verified'] ?? 'false');
if ($emailVerified !== true && $emailVerified !== 'true') {
    http_response_code(401);
    echo json_encode(["error" => "Google email is not verified."]);
    exit;
}

$email = trim($info['email'] ?? "");
if ($email === "") {
    http_response_code(400);
    echo json_encode(["error" => "Google account has no email."]);
    exit;
}

// --- find or create the user ---
$stmt = mysqli_prepare($conn, "SELECT id, username, email, role, status, avatar FROM users WHERE username = ? OR email = ? LIMIT 1");
mysqli_stmt_bind_param($stmt, "ss", $email, $email);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($res);

if (!$user) {
    // new Google user -> Tourist account with a random (unused) password
    $randHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $stmt = mysqli_prepare($conn, "INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, 'Tourist', 'Active')");
    mysqli_stmt_bind_param($stmt, "sss", $email, $email, $randHash);
    if (!mysqli_stmt_execute($stmt)) {
        http_response_code(500);
        echo json_encode(["error" => "Could not create account: " . mysqli_error($conn)]);
        exit;
    }
    $uid = mysqli_insert_id($conn);
    $user = ["id" => $uid, "username" => $email, "email" => $email, "role" => "Tourist", "status" => "Active"];
}

if (($user['status'] ?? 'Active') === 'Inactive') {
    http_response_code(403);
    echo json_encode(["error" => "This account is inactive. Please contact the administrator."]);
    exit;
}

// --- issue a new session token (multi-session: INSERT, don't overwrite) ---
$token = bin2hex(random_bytes(32));
$uid = (int)$user['id'];
$stmt = mysqli_prepare($conn, "UPDATE users SET last_login = NOW() WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $uid);
mysqli_stmt_execute($stmt);

$tokStmt = mysqli_prepare($conn, "INSERT INTO user_tokens (user_id, token, last_used_at) VALUES (?, ?, NOW())");
mysqli_stmt_bind_param($tokStmt, "is", $uid, $token);
mysqli_stmt_execute($tokStmt);

$user['api_token'] = $token;
echo json_encode(["success" => true, "message" => "Google login successful", "user" => $user]);
