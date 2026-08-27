<?php
/*
  Temporary diagnostic — figures out why tcims_sentiment_ml() is returning
  null for every review. Not meant to stay in the codebase long-term.
  Usage: /api/ml_debug.php?key=tcims_eval
*/
require_once "../config/sentiment_ml.php";

const DEBUG_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== DEBUG_KEY) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

header("Content-Type: application/json");

$path = __DIR__ . '/../ml_training/model_weights.json';
$out = [
    "dir_of_this_file" => __DIR__,
    "resolved_path" => $path,
    "realpath" => realpath($path),
    "file_exists" => file_exists($path),
    "is_readable" => is_readable($path),
];

if (file_exists($path)) {
    $raw = file_get_contents($path);
    $out["raw_bytes"] = strlen($raw);
    $out["raw_first_20_bytes_hex"] = bin2hex(substr($raw, 0, 20));
    $decoded = json_decode($raw, true);
    $out["json_last_error"] = json_last_error();
    $out["json_last_error_msg"] = json_last_error_msg();
    $out["decoded_is_array"] = is_array($decoded);
    if (is_array($decoded)) {
        $out["decoded_keys"] = array_keys($decoded);
        $out["has_vocabulary"] = isset($decoded['vocabulary']);
        $out["has_classes"] = isset($decoded['classes']);
        $out["vocab_size"] = isset($decoded['vocabulary']) ? count($decoded['vocabulary']) : null;
    }
}

$testComment = "Maganda ang lugar, sobrang linis.";
$out["test_comment"] = $testComment;
$out["test_tokens"] = function_exists('tcims_ml_tokenize') ? tcims_ml_tokenize($testComment) : "function missing";
$out["test_result"] = tcims_sentiment_ml($testComment);

echo json_encode($out, JSON_PRETTY_PRINT);
