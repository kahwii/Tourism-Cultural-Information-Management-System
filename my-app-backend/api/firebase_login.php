<?php
/*
  Firebase sign-in. The frontend signs in with Firebase (Google provider) and
  sends the Firebase ID token. We verify it (RS256, Google's public certs),
  then find-or-create a Tourist account and issue our own API token.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/firebase.php";

function b64url_decode($s) {
    return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

// Verify a Firebase ID token; returns the payload (claims) or null.
function verify_firebase_token($jwt, $projectId) {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) return null;
    list($h64, $p64, $s64) = $parts;
    $header  = json_decode(b64url_decode($h64), true);
    $payload = json_decode(b64url_decode($p64), true);
    $sig     = b64url_decode($s64);
    if (!$header || !$payload) return null;
    if (($header['alg'] ?? '') !== 'RS256' || empty($header['kid'])) return null;

    // Google's public certs for Firebase secure tokens
    $certsRaw = @file_get_contents("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
    if ($certsRaw === false && function_exists('curl_init')) {
        $ch = curl_init("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true); curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        $certsRaw = curl_exec($ch); curl_close($ch);
    }
    $certs = $certsRaw ? json_decode($certsRaw, true) : null;
    if (!$certs || empty($certs[$header['kid']])) return null;

    $pub = openssl_pkey_get_public($certs[$header['kid']]);
    if (!$pub) return null;
    $ok = openssl_verify("$h64.$p64", $sig, $pub, OPENSSL_ALGO_SHA256);
    if ($ok !== 1) return null;

    // validate claims
    $now = time();
    if (($payload['aud'] ?? '') !== $projectId) return null;
    if (($payload['iss'] ?? '') !== "https://securetoken.google.com/$projectId") return null;
    if (($payload['exp'] ?? 0) < $now) return null;
    return $payload;
}

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$idToken = trim($data['idToken'] ?? "");
if ($idToken === "") { http_response_code(400); echo json_encode(["error" => "Missing Firebase token."]); exit; }

// Requested role for NEW accounts only (from the sign-in picker). Whitelisted.
$requestedRole = trim($data['role'] ?? "Tourist");
if (!in_array($requestedRole, ["Tourist", "Establishment"], true)) { $requestedRole = "Tourist"; }

$claims = verify_firebase_token($idToken, FIREBASE_PROJECT_ID);
if (!$claims) { http_response_code(401); echo json_encode(["error" => "Invalid or expired Firebase token."]); exit; }

$email = trim($claims['email'] ?? "");
if ($email === "") { http_response_code(400); echo json_encode(["error" => "Google account has no email."]); exit; }

// find or create the user
$stmt = mysqli_prepare($conn, "SELECT id, username, email, role, status, avatar FROM users WHERE username = ? OR email = ? LIMIT 1");
mysqli_stmt_bind_param($stmt, "ss", $email, $email);
mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$user = mysqli_fetch_assoc($res);

if (!$user) {
    $randHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $stmt = mysqli_prepare($conn, "INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, 'Active')");
    mysqli_stmt_bind_param($stmt, "ssss", $email, $email, $randHash, $requestedRole);
    if (!mysqli_stmt_execute($stmt)) { http_response_code(500); echo json_encode(["error" => "Could not create account: " . mysqli_error($conn)]); exit; }
    $user = ["id" => mysqli_insert_id($conn), "username" => $email, "email" => $email, "role" => $requestedRole, "status" => "Active"];
}
if (($user['status'] ?? 'Active') === 'Inactive') {
    http_response_code(403); echo json_encode(["error" => "This account is inactive."]); exit;
}

// issue our API token
$token = bin2hex(random_bytes(32));
$uid = (int)$user['id'];
$stmt = mysqli_prepare($conn, "UPDATE users SET api_token = ?, last_login = NOW() WHERE id = ?");
mysqli_stmt_bind_param($stmt, "si", $token, $uid);
mysqli_stmt_execute($stmt);

$user['api_token'] = $token;
echo json_encode(["success" => true, "message" => "Firebase login successful", "user" => $user]);
