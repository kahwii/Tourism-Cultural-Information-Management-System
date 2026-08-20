<?php
/*
  Draws a random sample of REAL visitor reviews for blind manual labelling.

  This produces the only figure in the evaluation that can honestly be called
  accuracy, because these comments were never looked at while the lexicon was
  being tuned.

  Two deliberate design choices, both about avoiding bias:

   1. The engine's prediction is NOT included in the output. If the labeller
      sees what the system guessed, they anchor to it and end up grading the
      engine against itself.

   2. The star rating is NOT included either. The reader's job is to judge the
      SENTIMENT OF THE TEXT. A visible 5-star rating would pull the label
      toward Positive even when the words say otherwise — which is exactly the
      failure mode the engine was fixed for.

  Usage:
    /api/sentiment_sample.php?key=tcims_eval&n=30

  Output is CSV: id,comment,expected
  Fill in the `expected` column with Positive / Neutral / Negative, then paste
  the whole thing into the scoring form at the bottom of sentiment_eval.php.
*/

require_once "../config/cors.php";
require_once "../config/db.php";

const SAMPLE_KEY = "tcims_eval";

if (($_GET['key'] ?? '') !== SAMPLE_KEY) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$n = isset($_GET['n']) ? (int) $_GET['n'] : 30;
if ($n < 5)   $n = 5;
if ($n > 200) $n = 200;

/*
  Only comments with enough substance to be judgeable. A one-word comment is
  not a fair test of a sentiment analyser, and blank ones say nothing at all.
  RAND() is fine at this table size; on a large table it would need a smarter
  sampling strategy.
*/
$sql = "SELECT id, comment
        FROM reviews
        WHERE comment IS NOT NULL
          AND CHAR_LENGTH(TRIM(comment)) >= 12
        ORDER BY RAND()
        LIMIT " . $n;

$res = mysqli_query($conn, $sql);
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => mysqli_error($conn)]);
    exit;
}

header("Content-Type: text/csv; charset=utf-8");
header('Content-Disposition: attachment; filename="tcims_sample_to_label.csv"');

$out = fopen("php://output", "w");
fputcsv($out, ["id", "comment", "expected"]);
while ($r = mysqli_fetch_assoc($res)) {
    // `expected` intentionally left blank — that is the human's job.
    fputcsv($out, [$r['id'], $r['comment'], ""]);
}
fclose($out);
