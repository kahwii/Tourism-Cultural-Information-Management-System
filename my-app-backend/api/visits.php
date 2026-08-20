<?php
/*
  Tourist check-ins (visits).
  GET               -> array of place names the current user has checked in to.
  POST (JSON){place}-> toggles a check-in for that place; returns { visited: bool }.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

$authUser = require_auth($conn);
$uid = (int)$authUser['id'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = mysqli_prepare($conn, "SELECT place FROM visits WHERE user_id = ? ORDER BY id DESC");
    mysqli_stmt_bind_param($stmt, "i", $uid);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $places = [];
    while ($r = mysqli_fetch_assoc($res)) $places[] = $r['place'];
    echo json_encode($places);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    $place = trim($body['place'] ?? "");
    if ($place === "") { http_response_code(400); echo json_encode(["error" => "place is required."]); exit; }

    // already checked in? -> remove (toggle off)
    $stmt = mysqli_prepare($conn, "SELECT id FROM visits WHERE user_id = ? AND place = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "is", $uid, $place);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    $exists = mysqli_stmt_num_rows($stmt) > 0;
    mysqli_stmt_close($stmt);

    if ($exists) {
        $stmt = mysqli_prepare($conn, "DELETE FROM visits WHERE user_id = ? AND place = ?");
        mysqli_stmt_bind_param($stmt, "is", $uid, $place);
        mysqli_stmt_execute($stmt);
        echo json_encode(["success" => true, "visited" => false]);
    } else {
        $stmt = mysqli_prepare($conn, "INSERT INTO visits (user_id, place) VALUES (?, ?)");
        mysqli_stmt_bind_param($stmt, "is", $uid, $place);
        mysqli_stmt_execute($stmt);
        echo json_encode(["success" => true, "visited" => true]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
