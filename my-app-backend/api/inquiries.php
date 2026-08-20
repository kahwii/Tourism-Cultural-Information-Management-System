<?php
/*
  Visitor inquiries (1.2 Events and Visitor Service Module).

  POST  — PUBLIC. A visitor submits a question from the public events page.
          No login required, so it carries its own abuse protections:
          a honeypot field, a length cap, and a per-IP rate limit.
  GET   — admin only. Lists all inquiries for the CCAT Inquiries page.
  PUT   — admin only. Records a reply, emails it to the visitor, and
          marks the inquiry Answered.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";
require_once "../config/smtp.php";

$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents("php://input"), true) ?: [];

/* ---------------- PUBLIC: submit an inquiry ---------------- */
if ($method === 'POST') {
    // Honeypot: a hidden field real visitors never fill in. Bots fill
    // everything, so a non-empty value means "silently accept and drop".
    //
    // The key is deliberately meaningless ("tcims_hp"). It must never be an
    // autofill-recognised name like "website"/"url" — Chrome fills those even
    // when hidden, which silently swallowed real inquiries.
    if (trim($body['tcims_hp'] ?? '') !== '') {
        echo json_encode(["success" => true, "message" => "Thank you! Your inquiry has been sent."]);
        exit;
    }

    $name    = trim($body['name'] ?? '');
    $email   = trim($body['email'] ?? '');
    $subject = trim($body['subject'] ?? '');
    $message = trim($body['message'] ?? '');

    // Category is a fixed list, not free text — it feeds the CCAT reports,
    // so anything outside the list falls back to "General Inquiry" rather
    // than polluting the breakdown with arbitrary values.
    $ALLOWED_CATEGORIES = [
        "Events & Festivals",
        "Tourist Spots",
        "Heritage Sites",
        "Business Accreditation",
        "General Inquiry",
    ];
    $category = trim($body['category'] ?? '');
    if (!in_array($category, $ALLOWED_CATEGORIES, true)) $category = "General Inquiry";

    if ($name === '' || mb_strlen($name) > 150) {
        http_response_code(400); echo json_encode(["error" => "Please enter your name."]); exit;
    }
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400); echo json_encode(["error" => "Please enter a valid email address so we can reply."]); exit;
    }
    if (mb_strlen($message) < 10) {
        http_response_code(400); echo json_encode(["error" => "Please describe your inquiry in a little more detail."]); exit;
    }
    if (mb_strlen($message) > 2000) {
        http_response_code(400); echo json_encode(["error" => "Your message is too long (2000 characters max)."]); exit;
    }
    if (mb_strlen($subject) > 200) $subject = mb_substr($subject, 0, 200);

    // Rate limit: max 3 inquiries per IP per hour.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip !== '') {
        $st = mysqli_prepare($conn,
            "SELECT COUNT(*) AS c FROM inquiries
             WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)");
        if ($st) {
            mysqli_stmt_bind_param($st, "s", $ip);
            mysqli_stmt_execute($st);
            $c = (int) (mysqli_fetch_assoc(mysqli_stmt_get_result($st))['c'] ?? 0);
            if ($c >= 3) {
                http_response_code(429);
                echo json_encode(["error" => "You've sent several inquiries recently. Please try again later."]);
                exit;
            }
        }
    }

    $st = mysqli_prepare($conn,
        "INSERT INTO inquiries (name, email, subject, category, message, ip_address, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Open')");
    mysqli_stmt_bind_param($st, "ssssss", $name, $email, $subject, $category, $message, $ip);
    if (!mysqli_stmt_execute($st)) {
        http_response_code(500);
        echo json_encode(["error" => "Could not submit your inquiry. Please try again."]);
        exit;
    }

    // Reference number derived from the auto-increment id, so it's unique
    // without a second counter to keep in sync: INQ-2026-0007.
    $newId = mysqli_insert_id($conn);
    $refNo = sprintf("INQ-%s-%04d", date("Y"), $newId);
    $up = mysqli_prepare($conn, "UPDATE inquiries SET ref_no = ? WHERE id = ?");
    if ($up) {
        mysqli_stmt_bind_param($up, "si", $refNo, $newId);
        mysqli_stmt_execute($up);
    }

    // Acknowledgment email — best-effort. The visitor already sees the
    // reference number on screen, so a failed send is never fatal.
    $ackSubject = "We received your inquiry ($refNo) — CCAT Mandaluyong";
    $ackBody =
        "Good day, $name!\r\n\r\n" .
        "Thank you for contacting the City Cultural Affairs & Tourism Development Department (CCAT).\r\n\r\n" .
        "We have received your inquiry and our staff will review it shortly. Please keep the reference\r\n" .
        "number below in case you need to follow up with our office.\r\n\r\n" .
        "Reference No.: $refNo\r\n" .
        "Category: $category\r\n" .
        ($subject !== "" ? "Subject: $subject\r\n" : "") .
        "\r\nYour message:\r\n$message\r\n\r\n" .
        "You can expect a reply at this email address within three (3) working days.\r\n\r\n" .
        "This is an automated acknowledgment — no reply is needed.\r\n\r\n" .
        "Thank you,\r\n" .
        "City Cultural Affairs & Tourism Development Department\r\n" .
        "City of Mandaluyong";
    @smtp_send($email, $ackSubject, $ackBody);

    echo json_encode([
        "success" => true,
        "ref_no"  => $refNo,
        "message" => "Thank you! Your inquiry has been sent to the CCAT office. We'll reply by email.",
    ]);
    exit;
}

/* ---------------- ADMIN: list ---------------- */
if ($method === 'GET') {
    $admin = require_admin($conn);
    $res = mysqli_query($conn, "SELECT * FROM inquiries ORDER BY (status = 'Open') DESC, created_at DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode($rows);
    exit;
}

/* ---------------- ADMIN: reply ---------------- */
if ($method === 'PUT') {
    $admin = require_admin($conn);
    $id = (int) ($body['id'] ?? 0);
    $reply = trim($body['reply'] ?? '');
    if ($id <= 0) { http_response_code(400); echo json_encode(["error" => "A valid inquiry is required."]); exit; }
    if ($reply === '') { http_response_code(400); echo json_encode(["error" => "Please write a reply."]); exit; }

    $st = mysqli_prepare($conn, "SELECT * FROM inquiries WHERE id = ?");
    mysqli_stmt_bind_param($st, "i", $id);
    mysqli_stmt_execute($st);
    $inq = mysqli_fetch_assoc(mysqli_stmt_get_result($st));
    if (!$inq) { http_response_code(404); echo json_encode(["error" => "Inquiry not found."]); exit; }

    $emailed = false;
    if (filter_var($inq['email'], FILTER_VALIDATE_EMAIL)) {
        $ref = trim($inq['ref_no'] ?? '');
        $subject = "Re: " . ($inq['subject'] !== '' ? $inq['subject'] : "Your inquiry to CCAT Mandaluyong")
                 . ($ref !== '' ? " ($ref)" : "");
        $mail =
            "Good day, {$inq['name']}!\r\n\r\n" .
            "Thank you for reaching out to the City Cultural Affairs & Tourism Development Department.\r\n\r\n" .
            ($ref !== '' ? "Reference No.: $ref\r\n\r\n" : "") .
            "Your inquiry:\r\n{$inq['message']}\r\n\r\n" .
            "Our reply:\r\n$reply\r\n\r\n" .
            "Thank you,\r\n" .
            "City Cultural Affairs & Tourism Development Department\r\n" .
            "City of Mandaluyong";
        $emailed = smtp_send($inq['email'], $subject, $mail);
    }

    $st = mysqli_prepare($conn,
        "UPDATE inquiries SET reply = ?, status = 'Answered', answered_by = ?, answered_at = NOW() WHERE id = ?");
    $aid = (int) $admin['id'];
    mysqli_stmt_bind_param($st, "sii", $reply, $aid, $id);
    mysqli_stmt_execute($st);

    log_activity($conn, $admin, "Replied", "inquiries",
        "Replied to inquiry from {$inq['name']} <{$inq['email']}>" . ($emailed ? " — emailed" : " — email not sent"));

    echo json_encode([
        "success" => true,
        "emailed" => (bool) $emailed,
        "message" => $emailed
            ? "Reply emailed to {$inq['email']}."
            : "Reply saved, but the email could not be sent. Please follow up manually.",
    ]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
