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
require_once "../config/sentiment_ml.php";

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

    // ---- rate limiting ----
    // Prevents a single account (or a compromised/scripted one) from flooding
    // the reviews table, which would both degrade the live sentiment
    // dashboard and poison any future ML training data pulled from it.
    // Two independent checks: a short burst limit (catches scripted spam)
    // and a generous daily cap (catches sustained abuse) — both loose enough
    // that no genuine tourist visiting several spots in a day would ever hit them.
    $burst = mysqli_query($conn, "SELECT COUNT(*) AS c FROM reviews
        WHERE user_id = $uid AND created_at >= NOW() - INTERVAL 1 MINUTE");
    $burstCount = $burst ? (int)(mysqli_fetch_assoc($burst)['c'] ?? 0) : 0;
    if ($burstCount >= 3) {
        http_response_code(429);
        echo json_encode(["error" => "You're submitting reviews too quickly. Please wait a bit and try again."]);
        exit;
    }
    $daily = mysqli_query($conn, "SELECT COUNT(*) AS c FROM reviews
        WHERE user_id = $uid AND created_at >= NOW() - INTERVAL 1 DAY");
    $dailyCount = $daily ? (int)(mysqli_fetch_assoc($daily)['c'] ?? 0) : 0;
    if ($dailyCount >= 30) {
        http_response_code(429);
        echo json_encode(["error" => "You've reached today's review submission limit. Please try again tomorrow."]);
        exit;
    }

    // ---- server-side sentiment scoring ----
    // The lexicon result is what's actually shown to users/staff. The ML
    // result (if a model has been trained/deployed) is stored alongside it
    // purely for shadow-mode comparison — see config/sentiment_ml.php.
    $s = tcims_sentiment($comment, $rating);
    $sentiment = $s['sentiment'];
    $mlResult = tcims_sentiment_ml($comment);
    $mlSentiment = $mlResult['sentiment'] ?? null;

    $sql = "INSERT INTO reviews (user_id, place, reviewer, rating, sentiment, ml_sentiment, comment)
            VALUES ($uid, '" . $esc($place) . "', '" . $esc($reviewer) . "', $rating, '" . $esc($sentiment) . "', " .
            ($mlSentiment !== null ? "'" . $esc($mlSentiment) . "'" : "NULL") . ", '" . $esc($comment) . "')";
    if (mysqli_query($conn, $sql)) {
        echo json_encode([
            "success"      => true,
            "id"           => mysqli_insert_id($conn),
            "sentiment"    => $sentiment,
            "score"        => $s['score'],
            "ml_sentiment" => $mlSentiment, // shadow-mode only, not authoritative
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => mysqli_error($conn)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
