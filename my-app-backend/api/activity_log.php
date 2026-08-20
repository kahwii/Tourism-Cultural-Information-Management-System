<?php
/*
  Activity Log (audit trail) — admins only.
  GET: latest 500 log entries, newest first.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

// Approver-only: the audit trail records what makers did, so makers
// shouldn't be the ones reading (or relying on) it.
$user = require_approver($conn);

$res = @mysqli_query($conn, "SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500");
if (!$res) {
    // table not created yet — return empty list instead of an error
    echo json_encode([]);
    exit;
}
$rows = [];
while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
echo json_encode($rows);
