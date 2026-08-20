<?php
/*
  Emails a CCAT Staff member when their submitted event is approved or
  rejected (1.2 Events and Visitor Service Module, maker-checker).

  Without this the maker has to log in and notice the badge themselves,
  which in practice means rejected events sit untouched for days.

  Admin-only. Email is best-effort: the approval itself already happened
  in crud.php, so a failed send must never look like a failed approval.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";
require_once "../config/smtp.php";

$admin = require_admin($conn);

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$eventId = (int) ($data['event_id'] ?? 0);
if ($eventId <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "A valid event is required."]);
    exit;
}

// event + the submitting staff member's account
$st = mysqli_prepare($conn,
    "SELECT e.*, u.username AS maker_name, u.email AS maker_email
     FROM events e LEFT JOIN users u ON u.id = e.submitted_by
     WHERE e.id = ?");
mysqli_stmt_bind_param($st, "i", $eventId);
mysqli_stmt_execute($st);
$ev = mysqli_fetch_assoc(mysqli_stmt_get_result($st));

if (!$ev) {
    http_response_code(404);
    echo json_encode(["error" => "Event not found."]);
    exit;
}

$email = trim($ev['maker_email'] ?? "");
$status = $ev['approval_status'] ?? "";

// Nothing to tell anyone if the event has no submitter on record (e.g. it
// predates the maker-checker workflow) or is still awaiting review.
if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => true, "emailed" => false, "message" => "No email on file for the submitter."]);
    exit;
}
if ($status !== 'Approved' && $status !== 'Rejected') {
    echo json_encode(["success" => true, "emailed" => false, "message" => "This event is still pending review."]);
    exit;
}

$who = trim($ev['maker_name'] ?? "");
$greeting = $who !== "" ? "Good day, $who!" : "Good day!";
$when = $ev['event_date'] ? date("F j, Y", strtotime($ev['event_date'])) : "(no date set)";

if ($status === 'Approved') {
    $subject = "Approved: {$ev['name']} is now live on the public events page";
    $body =
        "$greeting\r\n\r\n" .
        "The event you submitted has been APPROVED by the CCAT admin and is now\r\n" .
        "visible on the public events page.\r\n\r\n" .
        "Event: {$ev['name']}\r\n" .
        "Date: $when\r\n" .
        "Venue: " . ($ev['venue'] ?: "—") . "\r\n\r\n" .
        "No further action is needed.\r\n\r\n";
} else {
    $subject = "Sent back for revision: {$ev['name']}";
    $body =
        "$greeting\r\n\r\n" .
        "The event you submitted has been SENT BACK for revision and is not\r\n" .
        "visible on the public events page.\r\n\r\n" .
        "Event: {$ev['name']}\r\n" .
        "Date: $when\r\n" .
        "Venue: " . ($ev['venue'] ?: "—") . "\r\n\r\n" .
        "Reason from the reviewer:\r\n" .
        ($ev['approval_remarks'] ?: "No reason was given.") . "\r\n\r\n" .
        "Please sign in to TCIMS, update the event, and save it again to resubmit\r\n" .
        "it for review.\r\n\r\n";
}

$body .=
    "Thank you,\r\n" .
    "City Cultural Affairs & Tourism Development Department\r\n" .
    "City of Mandaluyong";

$emailed = smtp_send($email, $subject, $body);

log_activity($conn, $admin, "Notified", "events",
    "$status notice for event: {$ev['name']}" .
    ($emailed ? " — emailed to $email" : " — email to $email could not be sent"));

echo json_encode([
    "success" => true,
    "emailed" => (bool) $emailed,
    "email"   => $email,
    "message" => $emailed ? "Notice emailed to $email." : "Email could not be sent.",
]);
