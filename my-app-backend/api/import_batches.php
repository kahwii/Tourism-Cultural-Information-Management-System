<?php
/*
  Manage past CSV import batches (see import_reviews.php). Admin-only.

  GET    -> list every batch: id, row count, place count, when imported, by whom
  DELETE (JSON: { batch }) -> remove every review row that belongs to that
                               batch, in one shot. Live/manual feedback (rows
                               with no import_batch) is never touched.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

$authUser = require_admin($conn);
$esc = fn($v) => mysqli_real_escape_string($conn, (string)$v);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $res = mysqli_query($conn, "
        SELECT import_batch AS batch,
               COUNT(*) AS row_count,
               COUNT(DISTINCT place) AS place_count,
               MIN(created_at) AS imported_at,
               MAX(imported_by) AS imported_by
        FROM reviews
        WHERE import_batch IS NOT NULL AND import_batch <> ''
        GROUP BY import_batch
        ORDER BY imported_at DESC
    ");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode($rows);
    exit;
}

if ($method === 'DELETE') {
    $body = json_decode(file_get_contents("php://input"), true) ?: [];
    $batch = trim((string)($body['batch'] ?? ""));
    if ($batch === "") {
        http_response_code(400);
        echo json_encode(["error" => "Missing batch id."]);
        exit;
    }
    $sql = "DELETE FROM reviews WHERE import_batch = '" . $esc($batch) . "'";
    if (mysqli_query($conn, $sql)) {
        $deleted = mysqli_affected_rows($conn);
        log_activity($conn, $authUser, "Deleted import batch", "reviews", "Batch $batch: $deleted row(s) removed");
        echo json_encode(["success" => true, "deleted" => $deleted]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => mysqli_error($conn)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
