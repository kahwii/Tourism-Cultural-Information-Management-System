<?php
/*
  Trail-completion reward (Heritage Mug).
  GET  -> the tourist's own reward record (or null).
  POST -> claim the reward. The server VERIFIES the tourist has visited
          ALL heritage trail sites before issuing a unique claim code.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/heritage_trail.php"; // $TRAIL_CHURCHES + trail_status()

$authUser = require_auth($conn);
$uid = (int)$authUser['id'];
$method = $_SERVER['REQUEST_METHOD'];

// fetch the user's existing reward, if any
function my_reward($conn, $uid) {
    $stmt = mysqli_prepare($conn, "SELECT id, reward, code, status, created_at, claimed_at FROM rewards WHERE user_id = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "i", $uid);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    return mysqli_fetch_assoc($res) ?: null;
}

if ($method === 'GET') {
    echo json_encode(my_reward($conn, $uid));
    exit;
}

if ($method === 'POST') {
    // Completion criteria = the same canonical 9 churches the tourist sees
    // as their Trail progress (config/heritage_trail.php) — must always
    // match certificate.php so "9/9" on the Trail page means the same
    // thing everywhere (previously this checked a different DB-driven set
    // of categories, which could disagree with what the Trail UI showed).
    $st = trail_status($conn, $uid, $TRAIL_CHURCHES);
    if (!$st["completed"]) {
        http_response_code(400);
        echo json_encode(["error" => "Trail not yet complete.", "remaining" => $st["total"] - $st["done"]]);
        exit;
    }

    // already claimed? return it
    $existing = my_reward($conn, $uid);
    if ($existing) { echo json_encode($existing); exit; }

    // issue a unique claim code
    $code = "MHM-" . strtoupper(bin2hex(random_bytes(3))); // e.g. MHM-1A2B3C
    $stmt = mysqli_prepare($conn, "INSERT INTO rewards (user_id, reward, code, status) VALUES (?, 'Mandaluyong Heritage Mug', ?, 'Unclaimed')");
    mysqli_stmt_bind_param($stmt, "is", $uid, $code);
    if (mysqli_stmt_execute($stmt)) {
        echo json_encode(my_reward($conn, $uid));
    } else {
        http_response_code(500); echo json_encode(["error" => mysqli_error($conn)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
