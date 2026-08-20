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
require_once "../config/activity.php";

$admin = require_admin($conn);

$res = mysqli_query($conn, "SELECT id, rating, comment, sentiment FROM reviews");
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => "Could not read reviews."]);
    exit;
}

$total = 0; $changed = 0;
$upd = mysqli_prepare($conn, "UPDATE reviews SET sentiment = ? WHERE id = ?");

while ($row = mysqli_fetch_assoc($res)) {
    $total++;
    $r = tcims_sentiment($row['comment'], $row['rating']);
    $newLabel = $r['sentiment'];
    if ($newLabel !== $row['sentiment']) {
        mysqli_stmt_bind_param($upd, "si", $newLabel, $row['id']);
        mysqli_stmt_execute($upd);
        $changed++;
    }
}

log_activity($conn, $admin, "Security", "reviews", "Re-analyzed all feedback ({$changed} of {$total} updated)");

echo json_encode([
    "success" => true,
    "total" => $total,
    "changed" => $changed,
    "message" => "Re-analyzed {$total} review(s). {$changed} label(s) updated.",
]);
