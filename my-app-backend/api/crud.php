<?php
/*
  Generic CRUD endpoint for all TCIMS modules.
  Uses prepared statements for all writes. Only whitelisted
  tables/columns are allowed; table names come from a fixed map.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

$TABLES = [
  "tourist_spots"      => ["name","category","address","contact_no","email","website","status","coordinates","image"],
  "restaurants"        => ["name","cuisine","address","contact_no","email","website","status"],
  "hotels"             => ["name","type","address","contact_no","email","website","status"],
  "tourism_businesses" => ["name","type","address","contact_no","email","website","status"],
  "events"             => ["name","event_date","start_time","end_time","month","category","venue","description","participants","status","image","approval_status","approval_remarks"],
  "heritage_sites"     => ["name","category","tagline","est","location","description","significance","status","coordinates","image"],
  "certificates"       => ["establishment","type","business_permit_no","applicant","contact","address","submitted_date","status","control_no","business_account_no","or_no","issued","expiry","remarks","owner_id","picked_up_at"],
  "reviews"            => ["place","reviewer","rating","sentiment","comment"],
  "visits"             => ["user_id","place"],
  "users"              => ["username","email","role","status","avatar"],
  "rewards"            => ["user_id","reward","code","status","claimed_at"]
];

$table = $_GET['table'] ?? '';
if (!isset($TABLES[$table])) {
  http_response_code(400);
  echo json_encode(["error" => "Unknown or missing table."]);
  exit;
}
$cols = $TABLES[$table];
$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$body = json_decode(file_get_contents("php://input"), true) ?: [];

// ---- prepared-statement helper (dynamic binding by reference) ----
function db_run($conn, $sql, $types = "", $values = []) {
  $stmt = mysqli_prepare($conn, $sql);
  if (!$stmt) return [false, null, mysqli_error($conn)];
  if ($types !== "") {
    $refs = [$types];
    foreach ($values as $k => $v) { $refs[] = &$values[$k]; }
    call_user_func_array([$stmt, "bind_param"], $refs);
  }
  $ok = mysqli_stmt_execute($stmt);
  return [$ok, $stmt, $ok ? "" : mysqli_stmt_error($stmt)];
}

// ---- audit helper: a human-readable label for a record ----
function record_label($table, $body, $id = 0) {
  $label = $body['name'] ?? $body['establishment'] ?? $body['username'] ?? $body['place'] ?? $body['reward'] ?? "";
  return $label !== "" ? $label : ($id ? "#$id" : "record");
}

// ---- Access control ----
$authUser = require_auth($conn);
$isAdmin = is_admin_role($authUser['role']);
$isEstablishment = ($authUser['role'] === 'Establishment');
// Maker-checker: CCAT Staff is the "maker" (their event edits need review);
// Super Admin / CCAT Admin are the "approvers" who can publish.
$isApprover = in_array($authUser['role'], ["Super Admin", "CCAT Admin", "admin"], true);
$isMakerOnly = ($authUser['role'] === 'CCAT Staff');
$writes = ['POST', 'PUT', 'DELETE'];
if (($table === 'users' || $table === 'rewards') && !$isAdmin) {
    http_response_code(403); echo json_encode(["error" => "Forbidden. Admins only."]); exit;
}
// Account management is an approver-only power. CCAT Staff are makers: letting
// them create or edit user accounts (including admins) would let them hand
// themselves approver rights and defeat the whole maker-checker split.
if ($table === 'users' && !$isApprover) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden. Account management is limited to CCAT Admin and Super Admin."]);
    exit;
}
if (in_array($method, $writes, true)) {
    $touristMayCreate      = ($method === 'POST' && in_array($table, ['reviews', 'visits'], true));
    $establishmentMayApply = ($method === 'POST' && $table === 'certificates' && $isEstablishment);
    if (!$touristMayCreate && !$establishmentMayApply && !$isAdmin) {
        http_response_code(403); echo json_encode(["error" => "Forbidden. Admins only."]); exit;
    }
}

if ($method === 'GET') {
  // table is whitelisted; id/owner_id are integers -> safe to inline
  $where = $id ? "WHERE id = $id" : "";
  if ($table === 'certificates' && $isEstablishment) {
    $oid = (int)$authUser['id'];
    $where = $id ? "WHERE id = $id AND owner_id = $oid" : "WHERE owner_id = $oid";
  }
  $res = mysqli_query($conn, "SELECT * FROM `$table` $where ORDER BY id DESC");
  $rows = [];
  while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
  echo json_encode($id ? ($rows[0] ?? null) : $rows);
  exit;
}

if ($method === 'POST') {
  // Events maker-checker: only an approver may set approval_status directly.
  // A CCAT Staff submission always lands as "Pending" for admin review.
  if ($table === 'events') {
    if ($isMakerOnly) {
      $body['approval_status'] = 'Pending';
      unset($body['approval_remarks']);
    } elseif (!$isApprover) {
      unset($body['approval_status'], $body['approval_remarks']);
    }
  }
  // establishment self-application: stamp owner + force "Under Review"
  if ($table === 'certificates' && $isEstablishment) {
    $body['owner_id'] = (int)$authUser['id'];
    $body['status']   = 'Under Review';
    if (empty($body['submitted_date'])) $body['submitted_date'] = date('n/j/Y');
    unset($body['control_no'], $body['business_account_no'], $body['or_no'], $body['issued'], $body['expiry'], $body['remarks']);
  }
  $fields = []; $place = []; $values = [];
  foreach ($cols as $c) {
    if (array_key_exists($c, $body)) {
      $fields[] = "`$c`"; $place[] = "?";
      $v = $body[$c];
      $values[] = ($v === "" || $v === null) ? null : (string)$v; // empty -> NULL (e.g. no end time)
    }
  }
  if (!$fields) { http_response_code(400); echo json_encode(["error" => "No valid fields."]); exit; }
  $types = str_repeat("s", count($values));
  $sql = "INSERT INTO `$table` (" . implode(",", $fields) . ") VALUES (" . implode(",", $place) . ")";
  [$ok, $stmt, $e] = db_run($conn, $sql, $types, $values);
  if ($ok) {
    $newId = mysqli_insert_id($conn);
    if ($table === 'events') {
      mysqli_query($conn, "UPDATE events SET submitted_by = " . (int)$authUser['id'] . " WHERE id = " . (int)$newId);
    }
    if ($isAdmin) log_activity($conn, $authUser, "Created", $table, "Added " . rtrim($table, "s") . ": " . record_label($table, $body, $newId));
    echo json_encode(["success" => true, "id" => $newId]);
  }
  else { http_response_code(500); echo json_encode(["error" => $e]); }
  exit;
}

if ($method === 'PUT') {
  if (!$id) { http_response_code(400); echo json_encode(["error" => "id is required."]); exit; }
  // Events maker-checker: a CCAT Staff edit sends the event back to "Pending"
  // and can never self-approve. Non-approvers cannot touch the field at all.
  if ($table === 'events') {
    if ($isMakerOnly) {
      $body['approval_status'] = 'Pending';
      unset($body['approval_remarks']);
    } elseif (!$isApprover) {
      unset($body['approval_status'], $body['approval_remarks']);
    }
  }
  $sets = []; $values = [];
  foreach ($cols as $c) {
    if (array_key_exists($c, $body)) {
      $sets[] = "`$c` = ?";
      $v = $body[$c];
      $values[] = ($v === "" || $v === null) ? null : (string)$v; // empty -> NULL (e.g. no end time)
    }
  }
  if (!$sets) { http_response_code(400); echo json_encode(["error" => "No valid fields."]); exit; }
  $types = str_repeat("s", count($values)) . "i";
  $values[] = $id;
  $sql = "UPDATE `$table` SET " . implode(",", $sets) . " WHERE id = ?";
  [$ok, $stmt, $e] = db_run($conn, $sql, $types, $values);
  if ($ok) {
    // Record who acted on an event's approval (approver publishes/rejects,
    // a staff edit resets it back to pending review).
    if ($table === 'events' && isset($body['approval_status'])) {
      $by = $isApprover ? (int)$authUser['id'] : 0;
      mysqli_query($conn, "UPDATE events SET approved_by = " . ($by ?: "NULL") . " WHERE id = " . (int)$id);
    }
    // Start the 90-day pickup clock the moment a certificate is first approved.
    // COALESCE keeps re-saving an already-approved record from resetting it.
    if ($table === 'certificates' && ($body['status'] ?? '') === 'Approved') {
      mysqli_query($conn, "UPDATE certificates SET
        approved_at = COALESCE(approved_at, NOW()),
        pickup_deadline = COALESCE(pickup_deadline, DATE_ADD(NOW(), INTERVAL 90 DAY))
        WHERE id = " . (int)$id);
    }
    if ($isAdmin) {
      $extra = "";
      // highlight status changes (e.g. certificate approvals)
      if (isset($body['status'])) $extra = " (status: " . $body['status'] . ")";
      log_activity($conn, $authUser, "Updated", $table, "Updated " . rtrim($table, "s") . ": " . record_label($table, $body, $id) . $extra);
    }
    echo json_encode(["success" => true]);
  }
  else { http_response_code(500); echo json_encode(["error" => $e]); }
  exit;
}

if ($method === 'DELETE') {
  if (!$id) { http_response_code(400); echo json_encode(["error" => "id is required."]); exit; }
  // safety: an admin cannot delete their own account
  if ($table === 'users' && $id === (int)$authUser['id']) {
    http_response_code(400); echo json_encode(["error" => "You cannot delete your own account."]); exit;
  }
  // capture a label BEFORE deleting so the log stays readable
  $delLabel = "#$id";
  if ($isAdmin) {
    $r = @mysqli_query($conn, "SELECT * FROM `$table` WHERE id = $id");
    if ($r && ($row = mysqli_fetch_assoc($r))) $delLabel = record_label($table, $row, $id);
  }
  [$ok, $stmt, $e] = db_run($conn, "DELETE FROM `$table` WHERE id = ?", "i", [$id]);
  if ($ok) {
    if ($isAdmin) log_activity($conn, $authUser, "Deleted", $table, "Deleted " . rtrim($table, "s") . ": " . $delLabel);
    echo json_encode(["success" => true]);
  }
  else { http_response_code(500); echo json_encode(["error" => $e]); }
  exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
