<?php
/*
  Quick diagnostic: how many real reviews exist, and how many are actually
  usable as ML training material.

  Used to decide whether it's worth labelling more real reviews before
  retraining the sentiment classifier — see ml_training/README.md.

  Usage: /api/review_stats.php?key=tcims_eval
*/

require_once "../config/cors.php";
require_once "../config/db.php";

const STATS_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== STATS_KEY) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

function scalar($conn, $sql) {
    $res = mysqli_query($conn, $sql);
    if (!$res) return null;
    $row = mysqli_fetch_row($res);
    return $row ? (int)$row[0] : 0;
}

$total          = scalar($conn, "SELECT COUNT(*) FROM reviews");
$withComment    = scalar($conn, "SELECT COUNT(*) FROM reviews WHERE comment IS NOT NULL AND TRIM(comment) <> ''");
$len12plus      = scalar($conn, "SELECT COUNT(*) FROM reviews WHERE comment IS NOT NULL AND CHAR_LENGTH(TRIM(comment)) >= 12");
$len6to11       = scalar($conn, "SELECT COUNT(*) FROM reviews WHERE comment IS NOT NULL AND CHAR_LENGTH(TRIM(comment)) BETWEEN 6 AND 11");
$len1to5        = scalar($conn, "SELECT COUNT(*) FROM reviews WHERE comment IS NOT NULL AND TRIM(comment) <> '' AND CHAR_LENGTH(TRIM(comment)) BETWEEN 1 AND 5");
$noComment      = $total - $withComment;

header("Content-Type: application/json");
echo json_encode([
    "total_reviews"              => $total,
    "with_any_comment"           => $withComment,
    "no_comment"                 => $noComment,
    "comment_12_chars_or_more"   => $len12plus,
    "comment_6_to_11_chars"      => $len6to11,
    "comment_1_to_5_chars"       => $len1to5,
    "note" => "sentiment_sample.php currently only samples the 12-chars-or-more group. " .
              "The 6-to-11 group is short but often still judgeable (e.g. 'maayos malinis'). " .
              "The 1-to-5 group (single words) is generally too short to be a fair label.",
], JSON_PRETTY_PRINT);
