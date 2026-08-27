<?php
/*
  Bulk import of historical/manual tourist feedback (e.g. past years' paper
  surveys, once digitized into a spreadsheet) into `reviews`. Admin-only.

  Runs every row through the SAME sentiment engine used for live feedback
  (config/sentiment.php) so imported rows are scored identically to normal
  submissions — no separate/duplicate logic to keep in sync.

  POST (JSON): { rows: [ { place, reviewer, rating, comment, date }, ... ] }
    - place, rating required per row (rating 1-5)
    - reviewer, comment, date optional (date falls back to now if missing/unparseable)
  Response: { success, imported, skipped, errors: [ "Row N: reason", ... ] }
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/sentiment.php";
require_once "../config/sentiment_ml.php";
require_once "../config/activity.php";

$authUser = require_admin($conn);
$esc = fn($v) => mysqli_real_escape_string($conn, (string)$v);

$body = json_decode(file_get_contents("php://input"), true) ?: [];
$rows = $body['rows'] ?? [];

if (!is_array($rows) || count($rows) === 0) {
    http_response_code(400);
    echo json_encode(["error" => "No rows to import."]);
    exit;
}
if (count($rows) > 2000) {
    http_response_code(400);
    echo json_encode(["error" => "Too many rows in one batch (max 2000). Split the file and import in parts."]);
    exit;
}

$imported = 0;
$skipped = 0;
$errors = [];

// One id per import (one CSV file = one batch), so it can be found/undone
// later (e.g. "oops, wrong file") without touching any other reviews. Large
// files are sent in chunks by the frontend, which generates and reuses the
// same batch id across chunks; fall back to generating one here if absent.
$batchId = trim((string)($body['batch'] ?? ""));
if ($batchId === "") $batchId = date("Ymd_His") . "_" . substr(bin2hex(random_bytes(3)), 0, 6);
$importedBy = $authUser['username'] ?? "admin";

foreach ($rows as $i => $row) {
    $place    = trim((string)($row['place'] ?? ""));
    $reviewer = trim((string)($row['reviewer'] ?? ""));
    if ($reviewer === "") $reviewer = "Anonymous";
    $rating   = isset($row['rating']) ? (int)$row['rating'] : 0;
    $comment  = trim((string)($row['comment'] ?? ""));
    $dateRaw  = trim((string)($row['date'] ?? ""));

    if ($place === "" || $rating < 1 || $rating > 5) {
        $skipped++;
        $errors[] = "Row " . ($i + 2) . ": missing place or invalid rating (must be 1-5).";
        continue;
    }

    // Historical date from the spreadsheet if given and parseable; otherwise "now".
    $ts = $dateRaw !== "" ? strtotime($dateRaw) : false;
    $createdAt = $ts ? date("Y-m-d H:i:s", $ts) : date("Y-m-d H:i:s");

    // Same scoring engine as live feedback submissions.
    $s = tcims_sentiment($comment, $rating);
    $sentiment = $s['sentiment'];
    // Shadow-mode ML scoring, stored for comparison only (see config/sentiment_ml.php).
    $mlResult = tcims_sentiment_ml($comment);
    $mlSentiment = $mlResult['sentiment'] ?? null;

    $sql = "INSERT INTO reviews (user_id, place, reviewer, rating, sentiment, ml_sentiment, comment, created_at, import_batch, imported_by)
            VALUES (NULL, '" . $esc($place) . "', '" . $esc($reviewer) . "', $rating,
                    '" . $esc($sentiment) . "', " . ($mlSentiment !== null ? "'" . $esc($mlSentiment) . "'" : "NULL") . ",
                    '" . $esc($comment) . "', '" . $esc($createdAt) . "',
                    '" . $esc($batchId) . "', '" . $esc($importedBy) . "')";

    if (mysqli_query($conn, $sql)) {
        $imported++;
    } else {
        $skipped++;
        $errors[] = "Row " . ($i + 2) . ": " . mysqli_error($conn);
    }
}

log_activity($conn, $authUser, "Imported historical feedback", "reviews",
    "Batch $batchId: $imported imported, $skipped skipped");

echo json_encode([
    "success"  => true,
    "imported" => $imported,
    "skipped"  => $skipped,
    "errors"   => array_slice($errors, 0, 20),
    "batch"    => $batchId,
]);
