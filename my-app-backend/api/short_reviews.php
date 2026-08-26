<?php
/*
  Lists the last remaining real reviews NOT already covered by
  sentiment_sample.php (which only samples comments >= 12 chars).

  These are short (1-11 char) real comments — the last bit of real,
  human-written training material left in the database. Same blind
  design as sentiment_sample.php: no engine prediction, no star rating.

  Usage: /api/short_reviews.php?key=tcims_eval
  Output: CSV, id,comment,expected (expected left blank for you to fill in).
*/

require_once "../config/cors.php";
require_once "../config/db.php";

const SHORT_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== SHORT_KEY) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$sql = "SELECT id, comment
        FROM reviews
        WHERE comment IS NOT NULL
          AND TRIM(comment) <> ''
          AND CHAR_LENGTH(TRIM(comment)) < 12
        ORDER BY CHAR_LENGTH(TRIM(comment)) DESC, id";

$res = mysqli_query($conn, $sql);
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => mysqli_error($conn)]);
    exit;
}

header("Content-Type: text/csv; charset=utf-8");
header('Content-Disposition: attachment; filename="short_reviews_to_label.csv"');

$out = fopen("php://output", "w");
fputcsv($out, ["id", "comment", "expected"]);
while ($r = mysqli_fetch_assoc($res)) {
    fputcsv($out, [$r['id'], $r['comment'], ""]);
}
fclose($out);
