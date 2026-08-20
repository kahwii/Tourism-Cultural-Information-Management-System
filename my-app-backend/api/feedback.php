<?php
/*
  Tourist feedback endpoint.
  POST (JSON): { place, rating, comment }  -> sentiment computed on the SERVER,
                                              stored in `reviews` with the user's id.
  GET                                       -> the logged-in user's own reviews.
  Any authenticated user may use this.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/sentiment.php";

$authUser = require_auth($conn);
$uid = (int)$authUser['id'];
$method = $_SERVER['REQUEST_METHOD'];
$esc = fn($v) => mysqli_real_escape_string($conn, (string)$v);

if ($method === 'GET') {
    $res = mysqli_query($conn, "SELECT id, place, reviewer, rating, sentiment, comment, created_at
                                FROM reviews WHERE user_id = $uid ORDER BY id DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode($rows);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    $place   = trim($body['place'] ?? "");
    $rating  = isset($body['rating']) ? (int)$body['rating'] : 0;
    $comment = trim($body['comment'] ?? "");
    $reviewer = trim($body['reviewer'] ?? ($authUser['username'] ?? "Anonymous"));

    if ($place === "" || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(["error" => "A place and a rating (1-5) are required."]);
        exit;
    }

    // ---- server-side sentiment scoring ----
    $s = tcims_sentiment($comment, $rating);
    $sentiment = $s['sentiment'];

    $sql = "INSERT INTO reviews (user_id, place, reviewer, rating, sentiment, comment)
            VALUES ($uid, '" . $esc($place) . "', '" . $esc($reviewer) . "', $rating, '" . $esc($sentiment) . "', '" . $esc($comment) . "')";
    if (mysqli_query($conn, $sql)) {
        echo json_encode([
            "success"   => true,
            "id"        => mysqli_insert_id($conn),
            "sentiment" => $sentiment,
            "score"     => $s['score'],
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => mysqli_error($conn)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
