<?php
/*
  Re-run the sentiment engine on ALL existing reviews and update their labels.
  Admin only. Useful after the sentiment lexicon is improved (e.g. profanity
  handling) so older feedback reflects the current rules.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/sentiment.php";
require_once "../config/sentiment_ml.php";
require_once "../config/activity.php";

$admin = require_admin($conn);

$res = mysqli_query($conn, "SELECT id, rating, comment, sentiment, ml_sentiment FROM reviews");
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => "Could not read reviews."]);
    exit;
}

$total = 0; $changed = 0; $mlChanged = 0;
$upd = mysqli_prepare($conn, "UPDATE reviews SET sentiment = ?, ml_sentiment = ? WHERE id = ?");

while ($row = mysqli_fetch_assoc($res)) {
    $total++;
    $r = tcims_sentiment($row['comment'], $row['rating']);
    $newLabel = $r['sentiment'];
    // Also (re)computes the ML shadow-mode column — this is what backfills
    // ml_sentiment for reviews that existed before the ml_sentiment column
    // did, and keeps it in sync whenever the model is retrained/redeployed.
    $mlResult = tcims_sentiment_ml($row['comment']);
    $newMl = $mlResult['sentiment'] ?? null;

    if ($newLabel !== $row['sentiment'] || $newMl !== $row['ml_sentiment']) {
        mysqli_stmt_bind_param($upd, "ssi", $newLabel, $newMl, $row['id']);
        mysqli_stmt_execute($upd);
        $changed++;
        if ($newMl !== $row['ml_sentiment']) $mlChanged++;
    }
}

log_activity($conn, $admin, "Security", "reviews", "Re-analyzed all feedback ({$changed} of {$total} updated)");

echo json_encode([
    "success" => true,
    "total" => $total,
    "changed" => $changed,
    "ml_changed" => $mlChanged,
    "message" => "Re-analyzed {$total} review(s). {$changed} label(s) updated ({$mlChanged} ML shadow scores).",
]);
