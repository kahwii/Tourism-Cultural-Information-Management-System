<?php
/*
  Exports the currently-known human-confirmed sentiment labels to CSV, for
  training an ML classifier (see ml_training/).

  Sources combined:
    - sentiment_testset.php:    45 hand-labelled comments (balanced 15/15/15),
                                 ported from the mobile app's test set.
    - sentiment_regression.php: only entries with source = "field" — i.e.
                                 real misclassifications the CCAT team
                                 actually adjudicated. The "review" ones are
                                 excluded on purpose: their labels are still
                                 hypotheses, not confirmed truth, and
                                 training on an unconfirmed label would
                                 quietly bake a possible mistake into the model.

  Deliberately text-only (comment + label) — no star rating column. The
  ML model learns from the words themselves, the same way a human reading
  just the comment would judge it. This sidesteps the whole class of bug
  the lexicon engine had (an untouched default rating quietly swaying the
  result) by never giving the model a rating to lean on in the first place.

  Usage: visit /api/export_training_data.php?key=tcims_eval — downloads
  training_data.csv directly.
*/

require_once "../config/sentiment_testset.php";     // $TCIMS_TEST_SET
require_once "../config/sentiment_regression.php";   // $TCIMS_REGRESSION_SET

const EXPORT_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== EXPORT_KEY) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$rows = [];
foreach ($TCIMS_TEST_SET as $r) {
    $rows[] = ["comment" => $r["comment"], "label" => $r["expected"], "source" => "reference"];
}
foreach ($TCIMS_REGRESSION_SET as $r) {
    if (($r["source"] ?? "") !== "field") continue; // skip unconfirmed hypotheses
    $rows[] = ["comment" => $r["comment"], "label" => $r["expected"], "source" => "regression"];
}

header("Content-Type: text/csv; charset=utf-8");
header("Content-Disposition: attachment; filename=\"training_data.csv\"");

$out = fopen("php://output", "w");
fputcsv($out, ["comment", "label", "source"]);
foreach ($rows as $r) fputcsv($out, [$r["comment"], $r["label"], $r["source"]]);
fclose($out);
