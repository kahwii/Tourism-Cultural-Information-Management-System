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
require_once "../config/sentiment.php";
require_once "../config/sentiment_ml.php";

$TABLES = [
  "tourist_spots"      => ["name","category","address","contact_no","email","website","status","coordinates","image"],
  "restaurants"        => ["name","cuisine","address","contact_no","email","website","status","image"],
  "hotels"             => ["name","type","address","contact_no","email","website","status","image"],
  "tourism_businesses" => ["name","type","address","contact_no","email","website","status","image"],
  // `participants` is the ACTUAL attendance recorded after the event, and
  // `post_event_report` the staff member's account of how it went. See
  // add_post_event_report.sql — reported_at is stamped by the server below,
  // so it is deliberately not writable from the request body.
  "events"             => ["name","event_date","start_time","end_time","month","category","venue","description","participants","status","image","approval_status","approval_remarks","post_event_report"],
  "heritage_sites"     => ["name","category","tagline","est","location","description","significance","status","coordinates","image"],
  "certificates"       => ["establishment","type","business_permit_no","applicant","contact","address","submitted_date","status","control_no","business_account_no","or_no","issued","expiry","remarks","owner_id","picked_up_at"],
  "reviews"            => ["place","reviewer","rating","sentiment","ml_sentiment","comment"],
  "visits"             => ["user_id","place"],
  "users"              => ["username","email","role","status","avatar"],
  "rewards"            => ["user_id","reward","code","status","claimed_at"]
];

/*
  READ ACCESS — deny by default.

  This map used to not exist: every table was readable by any signed-in
  account, and only `users` and `rewards` were singled out and gated. That
  meant a tourist who registered a minute ago could read the entire `reviews`
  table — every comment with its `user_id` attached — by opening one URL.
  Hiding the screen in the UI does not close that; the endpoint is the door.

  The failure mode of the old shape is what makes it worth changing: adding a
  new table to $TABLES silently published it, and staying private depended on
  someone remembering to add a gate. Now a table is unreadable unless it is
  listed here on purpose, so forgetting fails closed instead of open.

  READ_PUBLIC — the tourism directory the tourist app legitimately browses.
  READ_ADMIN  — anything carrying personal data or internal state
                (is_admin_role() covers Super Admin, CCAT Admin, CCAT Staff).
  `certificates` is neither: it has its own rule below (admins, or the
  establishment that owns the row).

  Writes are gated separately further down and are unchanged — tourists may
  still POST reviews and visits, they simply cannot read everyone else's.
*/
$READ_PUBLIC = ["tourist_spots", "restaurants", "hotels", "tourism_businesses", "events", "heritage_sites"];
$READ_ADMIN  = ["users", "rewards", "reviews", "visits"];

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
  // ---- Read access, enforced before a single row is fetched ----
  // certificates keeps its own rule (below); everything else must be named
  // in one of the two lists or it is refused.
  if ($table !== 'certificates') {
    if (in_array($table, $READ_ADMIN, true)) {
      if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(["error" => "Forbidden. This data is limited to CCAT staff and administrators."]);
        exit;
      }
    } elseif (!in_array($table, $READ_PUBLIC, true)) {
      // Not listed anywhere: a table added to $TABLES without a deliberate
      // read decision. Refuse rather than guess.
      http_response_code(403);
      echo json_encode(["error" => "Forbidden."]);
      exit;
    }
  }

  // table is whitelisted; id/owner_id are integers -> safe to inline
  $where = $id ? "WHERE id = $id" : "";
  if ($table === 'certificates') {
    // Certificates carry sensitive business info (permit numbers, contact
    // details, internal remarks) — only admins and the owning establishment
    // may read them. Previously any authenticated account (including a
    // self-registered Tourist) could list every business's application.
    if ($isEstablishment) {
      $oid = (int)$authUser['id'];
      $where = $id ? "WHERE id = $id AND owner_id = $oid" : "WHERE owner_id = $oid";
    } elseif (!$isAdmin) {
      http_response_code(403);
      echo json_encode(["error" => "Forbidden."]);
      exit;
    }
  }
  if ($id) {
    // Same rule as the list below: a single unapproved event fetched by id is
    // just as unpublished as one in a listing.
    if ($table === 'events' && !$isAdmin) $where .= " AND approval_status = 'Approved'";
    $res = mysqli_query($conn, "SELECT * FROM `$table` $where ORDER BY id DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode($rows[0] ?? null);
    exit;
  }

  // Pagination safety net for the "list everything" case. An explicit
  // ?limit=&offset= lets a future paginated admin UI ask for one page at a
  // time; with no params at all, a generous default cap still keeps this
  // endpoint from ever returning an unbounded number of rows once a table
  // grows into the thousands. Every table today is well under this cap, so
  // existing frontend calls that don't pass these params see no change.
  /*
    Events awaiting approval are not public.

    A CCAT Staff member's new event is held at approval_status = 'Pending'
    until an approver publishes it (see the POST/PUT handlers below). The
    tourist-facing pages were filtering those out in the browser, which hides
    them from the page but not from the endpoint: any signed-in tourist
    reading this table directly still received every unapproved event, draft
    wording and all. Same shape of problem as the reviews leak — the screen
    was doing the work the server should do.

    Staff and admins still see everything, which is what the admin Events page
    and the approval queue need.
  */
  if ($table === 'events' && !$isAdmin) {
    $where .= ($where === "" ? "WHERE " : " AND ") . "approval_status = 'Approved'";
  }

  $maxLimit = 2000;
  $limit  = isset($_GET['limit'])  ? max(1, min((int)$_GET['limit'], $maxLimit)) : 1000;
  $offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;

  $countRes = mysqli_query($conn, "SELECT COUNT(*) AS c FROM `$table` $where");
  $total = $countRes ? (int)(mysqli_fetch_assoc($countRes)['c'] ?? 0) : 0;

  $res = mysqli_query($conn, "SELECT * FROM `$table` $where ORDER BY id DESC LIMIT $limit OFFSET $offset");
  $rows = [];
  while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
  // Exposed as a header (not wrapped in the JSON body) so existing frontend
  // code that expects a plain array back keeps working unchanged; a future
  // paginated UI can read this to build page controls.
  header("Access-Control-Expose-Headers: X-Total-Count");
  header("X-Total-Count: $total");
  echo json_encode($rows);
  exit;
}

if ($method === 'POST') {
  // Rate limit review submissions here too — reviews can be created either
  // through feedback.php or through this generic endpoint (tourists are
  // whitelisted above to POST to 'reviews'), so both paths need the same
  // spam/flood protection or this one becomes the easy bypass.
  if ($table === 'reviews') {
    $uidRl = (int)$authUser['id'];
    $burst = mysqli_query($conn, "SELECT COUNT(*) AS c FROM reviews
        WHERE user_id = $uidRl AND created_at >= NOW() - INTERVAL 1 MINUTE");
    $burstCount = $burst ? (int)(mysqli_fetch_assoc($burst)['c'] ?? 0) : 0;
    if ($burstCount >= 3) {
      http_response_code(429);
      echo json_encode(["error" => "You're submitting reviews too quickly. Please wait a bit and try again."]);
      exit;
    }
    $daily = mysqli_query($conn, "SELECT COUNT(*) AS c FROM reviews
        WHERE user_id = $uidRl AND created_at >= NOW() - INTERVAL 1 DAY");
    $dailyCount = $daily ? (int)(mysqli_fetch_assoc($daily)['c'] ?? 0) : 0;
    if ($dailyCount >= 30) {
      http_response_code(429);
      echo json_encode(["error" => "You've reached today's review submission limit. Please try again tomorrow."]);
      exit;
    }
  }
  // Reviews: sentiment (both lexicon and ML) is always computed server-side
  // from the actual comment text, never trusted from the client — otherwise
  // a caller could submit a comment with a fabricated "sentiment" value that
  // doesn't match what was actually written, silently corrupting both the
  // live dashboard and any future ML training data pulled from this table.
  if ($table === 'reviews') {
    $comment = (string)($body['comment'] ?? '');
    $rating  = isset($body['rating']) ? (int)$body['rating'] : null;
    $s = tcims_sentiment($comment, $rating);
    $body['sentiment'] = $s['sentiment'];
    $mlResult = tcims_sentiment_ml($comment);
    $body['ml_sentiment'] = $mlResult['sentiment'] ?? null;
  }
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
    // Stamp when a post-event report was actually received. Done here rather
    // than accepting a timestamp from the request so the record reflects when
    // CCAT got the report, not whatever the phone's clock said. Re-saving an
    // existing report refreshes it; clearing the field clears the stamp too,
    // so "reported_at is set" always means "there is a report".
    if ($table === 'events' && array_key_exists('post_event_report', $body)) {
      $hasReport = trim((string)($body['post_event_report'] ?? '')) !== '';
      mysqli_query($conn, "UPDATE events SET reported_at = " . ($hasReport ? "NOW()" : "NULL") . " WHERE id = " . (int)$id);
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
