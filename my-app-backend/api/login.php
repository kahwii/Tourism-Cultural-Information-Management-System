<?php
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/activity.php";

$data = json_decode(file_get_contents("php://input"));
$username = isset($data->username) ? trim($data->username) : "";
$password = isset($data->password) ? trim($data->password) : "";

if ($username === "" || $password === "") {
    http_response_code(400);
    echo json_encode(["error" => "Username and password are required."]);
    exit;
}

// ---- brute-force protection ----
$MAX_ATTEMPTS = 5;      // wrong tries before lockout
$LOCK_MINUTES = 15;     // how long the account stays locked

$stmt = mysqli_prepare($conn, "SELECT id, username, email, password, role, status, failed_attempts, lockout_until, admin_pin, avatar FROM users WHERE username = ?");
mysqli_stmt_bind_param($stmt, "s", $username);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($result);

if (!$user) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid username or password."]);
    exit;
}

$uid = (int) $user['id'];

// currently locked?
if (!empty($user['lockout_until']) && strtotime($user['lockout_until']) > time()) {
    $mins = (int) ceil((strtotime($user['lockout_until']) - time()) / 60);
    http_response_code(429);
    echo json_encode(["error" => "Too many failed attempts. This account is temporarily locked. Try again in {$mins} minute(s)."]);
    exit;
}

if ($user['status'] === 'Inactive') {
    http_response_code(403);
    echo json_encode(["error" => "This account is inactive. Please contact the administrator."]);
    exit;
}

// verify (bcrypt; also accept legacy md5 just in case old data exists)
$ok = password_verify($password, $user['password']) || md5($password) === $user['password'];

if (!$ok) {
    $attempts = (int) $user['failed_attempts'] + 1;
    if ($attempts >= $MAX_ATTEMPTS) {
        $until = date('Y-m-d H:i:s', time() + $LOCK_MINUTES * 60);
        $st = mysqli_prepare($conn, "UPDATE users SET failed_attempts = ?, lockout_until = ? WHERE id = ?");
        mysqli_stmt_bind_param($st, "isi", $attempts, $until, $uid);
        mysqli_stmt_execute($st);
        http_response_code(429);
        echo json_encode(["error" => "Too many failed attempts. Account locked for {$LOCK_MINUTES} minutes."]);
    } else {
        $st = mysqli_prepare($conn, "UPDATE users SET failed_attempts = ? WHERE id = ?");
        mysqli_stmt_bind_param($st, "ii", $attempts, $uid);
        mysqli_stmt_execute($st);
        $left = $MAX_ATTEMPTS - $attempts;
        http_response_code(401);
        echo json_encode(["error" => "Invalid username or password. {$left} attempt(s) left before lockout."]);
    }
    exit;
}

// Admin 2-step: if this admin has a PIN set, require it after the password.
$adminRoles = ["Super Admin", "CCAT Admin", "CCAT Staff", "admin"];
if (in_array($user['role'], $adminRoles, true) && !empty($user['admin_pin'])) {
    $pin = isset($data->pin) ? trim($data->pin) : "";
    if ($pin === "") {
        // password is correct, but the PIN is still needed — no token yet
        echo json_encode(["pin_required" => true]);
        exit;
    }
    if (!password_verify($pin, $user['admin_pin'])) {
        http_response_code(401);
        echo json_encode(["error" => "Invalid PIN."]);
        exit;
    }
}

// success — reset counters, update last login, issue a NEW session token.
// This INSERTs a row rather than overwriting a single column, so signing in
// here does not invalidate a session already active on another device.
$token = bin2hex(random_bytes(32));
$st = mysqli_prepare($conn, "UPDATE users SET last_login = NOW(), failed_attempts = 0, lockout_until = NULL WHERE id = ?");
mysqli_stmt_bind_param($st, "i", $uid);
mysqli_stmt_execute($st);

$tokStmt = mysqli_prepare($conn, "INSERT INTO user_tokens (user_id, token, last_used_at) VALUES (?, ?, NOW())");
mysqli_stmt_bind_param($tokStmt, "is", $uid, $token);
mysqli_stmt_execute($tokStmt);

// audit trail: record admin sign-ins
if (in_array($user['role'], $adminRoles, true)) {
    log_activity($conn, $user, "Login", "auth", "Admin signed in" . (!empty($user['admin_pin']) ? " (2-step PIN verified)" : ""));
}

unset($user['password'], $user['failed_attempts'], $user['lockout_until'], $user['admin_pin']);
$user['api_token'] = $token;
echo json_encode(["success" => true, "message" => "Login successful", "user" => $user]);
