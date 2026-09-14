<?php
/*
  Staff operations reports — filed from the mobile app, answered by CCAT.

  Replaces the previous arrangement where staff reports were pushed through
  api/inquiries.php (the PUBLIC visitor-question form). Two things were wrong
  with that: the reports landed in the same inbox as tourists' questions, and
  an admin's reply went out by email, so a staff member inside the app never
  saw it. This endpoint gives the report its own place and a way back.

    POST   -> file a report              (any CCAT staff or admin)
    GET    -> list reports               (staff: own only; approver: all)
    PUT    -> reply / mark read          (approver only)

  ACCESS — split along maker-checker, deliberately NOT along is_admin_role().
  CCAT Staff counts as "admin" in this system, so gating reads on $isAdmin
  would let every staff member read everyone else's reports and the split
  would mean nothing. Approvers (Super Admin / CCAT Admin) are the office
  side: they see everything and answer. CCAT Staff are the reporting side:
  they file, and see their own thread.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

$me = require_auth($conn);
$uid = (int)$me['id'];
$role = $me['role'] ?? '';
$isStaff    = is_admin_role($role);      // may file reports
$isApprover = is_approver_role($role);   // may read all + reply
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents("php://input"), true) ?: [];

if (!$isStaff) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden. CCAT staff only."]);
    exit;
}

// Shared row shape, with the filer's name resolved so the admin page does not
// have to join against users itself.
function report_rows($conn, $where, $types = "", $values = []) {
    $sql = "SELECT r.id, r.user_id, r.subject, r.body, r.status,
                   r.admin_reply, r.replied_at, r.replied_by, r.created_at,
                   u.username AS filed_by, u.email AS filed_by_email,
                   a.username AS replied_by_name
            FROM reports r
            LEFT JOIN users u ON u.id = r.user_id
            LEFT JOIN users a ON a.id = r.replied_by
            $where
            ORDER BY r.id DESC";
    if ($types === "") {
        $res = mysqli_query($conn, $sql);
    } else {
        $stmt = mysqli_prepare($conn, $sql);
        mysqli_stmt_bind_param($stmt, $types, ...$values);
        mysqli_stmt_execute($stmt);
        $res = mysqli_stmt_get_result($stmt);
    }
    $rows = [];
    if ($res) { while ($r = mysqli_fetch_assoc($res)) $rows[] = $r; }
    return $rows;
}

/* ---------------- FILE A REPORT ---------------- */
if ($method === 'POST') {
    $subject = trim($body['subject'] ?? '');
    $text    = trim($body['body'] ?? '');

    if ($subject === '') { http_response_code(400); echo json_encode(["error" => "A subject is required."]); exit; }
    if (mb_strlen($subject) > 200) $subject = mb_substr($subject, 0, 200);
    if (mb_strlen($text) < 10) {
        http_response_code(400);
        echo json_encode(["error" => "The report is too short — please include some detail."]);
        exit;
    }

    // A generous daily cap. Not aimed at staff: an authenticated account is
    // accountable and no one files 20 reports a shift by hand. It is cheap
    // insurance against an app stuck in a retry loop quietly filling the
    // table, which is the realistic failure here rather than abuse.
    $cap = mysqli_prepare($conn, "SELECT COUNT(*) AS c FROM reports
                                  WHERE user_id = ? AND created_at >= NOW() - INTERVAL 1 DAY");
    mysqli_stmt_bind_param($cap, "i", $uid);
    mysqli_stmt_execute($cap);
    $count = (int)(mysqli_fetch_assoc(mysqli_stmt_get_result($cap))['c'] ?? 0);
    if ($count >= 20) {
        http_response_code(429);
        echo json_encode(["error" => "You've filed a lot of reports today. Please try again tomorrow."]);
        exit;
    }

    $stmt = mysqli_prepare($conn, "INSERT INTO reports (user_id, subject, body, status) VALUES (?, ?, ?, 'New')");
    mysqli_stmt_bind_param($stmt, "iss", $uid, $subject, $text);
    if (!mysqli_stmt_execute($stmt)) {
        http_response_code(500);
        echo json_encode(["error" => "Could not save the report."]);
        exit;
    }
    $newId = mysqli_insert_id($conn);
    @log_activity($conn, $me, "Filed a staff report", "reports #$newId", $subject);

    $rows = report_rows($conn, "WHERE r.id = ?", "i", [$newId]);
    echo json_encode($rows[0] ?? ["success" => true, "id" => $newId]);
    exit;
}

/* ---------------- LIST ---------------- */
if ($method === 'GET') {
    if ($isApprover) {
        echo json_encode(report_rows($conn, ""));
    } else {
        // A CCAT Staff member sees their own thread only — this is what the
        // app's "My reports" screen reads, so they can see the office's answer
        // without leaving the app.
        echo json_encode(report_rows($conn, "WHERE r.user_id = ?", "i", [$uid]));
    }
    exit;
}

/* ---------------- REPLY / MARK READ ---------------- */
if ($method === 'PUT') {
    if (!$isApprover) {
        http_response_code(403);
        echo json_encode(["error" => "Forbidden. Only CCAT Admin and Super Admin can answer reports."]);
        exit;
    }
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
    if ($id <= 0) { http_response_code(400); echo json_encode(["error" => "Missing report id."]); exit; }

    $existing = report_rows($conn, "WHERE r.id = ?", "i", [$id]);
    if (!$existing) { http_response_code(404); echo json_encode(["error" => "Report not found."]); exit; }

    $reply = array_key_exists('admin_reply', $body) ? trim((string)$body['admin_reply']) : null;

    if ($reply !== null && $reply !== '') {
        $stmt = mysqli_prepare($conn, "UPDATE reports
                                       SET admin_reply = ?, status = 'Replied', replied_at = NOW(), replied_by = ?
                                       WHERE id = ?");
        mysqli_stmt_bind_param($stmt, "sii", $reply, $uid, $id);
        mysqli_stmt_execute($stmt);
        @log_activity($conn, $me, "Replied to a staff report", "reports #$id", $existing[0]['subject'] ?? '');
    } else {
        // Opening a report marks it Read — but never downgrades one that has
        // already been answered.
        $status = trim($body['status'] ?? 'Read');
        if (!in_array($status, ['New', 'Read', 'Replied'], true)) $status = 'Read';
        $stmt = mysqli_prepare($conn, "UPDATE reports SET status = ? WHERE id = ? AND status <> 'Replied'");
        mysqli_stmt_bind_param($stmt, "si", $status, $id);
        mysqli_stmt_execute($stmt);
    }

    $rows = report_rows($conn, "WHERE r.id = ?", "i", [$id]);
    echo json_encode($rows[0] ?? null);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
