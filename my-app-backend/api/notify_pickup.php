<?php
/*
  Certificate pickup notification (admins only).
  Emails the establishment that their Certificate of Registration
  is ready for pick up at the CCAT office.

  Email is BEST-EFFORT on free hosting (may be slow or land in spam),
  so the establishment dashboard also shows the pickup notice in-app.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";
require_once "../config/smtp.php";

$admin = require_admin($conn);

$data = json_decode(file_get_contents("php://input"), true) ?: [];
$certId = (int) ($data['certificate_id'] ?? 0);
if ($certId <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "A valid certificate is required."]);
    exit;
}

// certificate + the owner's account email
$st = mysqli_prepare($conn,
    "SELECT c.*, u.email AS owner_email, u.username AS owner_username
     FROM certificates c LEFT JOIN users u ON u.id = c.owner_id
     WHERE c.id = ?");
mysqli_stmt_bind_param($st, "i", $certId);
mysqli_stmt_execute($st);
$cert = mysqli_fetch_assoc(mysqli_stmt_get_result($st));

if (!$cert) {
    http_response_code(404);
    echo json_encode(["error" => "Certificate not found."]);
    exit;
}
if ($cert['status'] !== 'Approved') {
    http_response_code(400);
    echo json_encode(["error" => "Only approved applications can be notified."]);
    exit;
}

$email = trim($cert['owner_email'] ?? "");
// fallback: the application's contact field if it looks like an email
if ($email === "" && filter_var(trim($cert['contact'] ?? ""), FILTER_VALIDATE_EMAIL)) {
    $email = trim($cert['contact']);
}

$emailed = false;
if ($email !== "" && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $deadline = !empty($cert['pickup_deadline']) ? date("F j, Y", strtotime($cert['pickup_deadline'])) : null;
    $subject = "Your Certificate of Registration is Ready for Pick Up";
    $body =
        "Good day, {$cert['establishment']}!\r\n\r\n" .
        "Congratulations! Your application for accreditation as a Tourism Oriented/Related Enterprise has been APPROVED.\r\n\r\n" .
        "Control No.: {$cert['control_no']}\r\n" .
        "Valid Until: {$cert['expiry']}\r\n\r\n" .
        "Your official Certificate of Registration is now READY FOR PICK UP at:\r\n\r\n" .
        "  City Cultural Affairs & Tourism Development Department (CCAT)\r\n" .
        "  Mandaluyong City Hall\r\n" .
        "  Monday to Friday, 8:00 AM - 5:00 PM\r\n\r\n" .
        "Please bring one (1) valid government-issued ID and your Official Receipt (OR No. {$cert['or_no']}).\r\n\r\n" .
        ($deadline
            ? "Please claim your certificate by $deadline (within 90 days of approval). We'll send reminders at 30 and 60 days if it's still unclaimed — certificates left unclaimed past the deadline may be subject to cancellation.\r\n\r\n"
            : "") .
        "Thank you,\r\n" .
        "City Cultural Affairs & Tourism Development Department\r\n" .
        "City of Mandaluyong";
    // real email via Gmail SMTP (InfinityFree blocks PHP mail())
    $emailed = smtp_send($email, $subject, $body);
}

log_activity($conn, $admin, "Notified", "certificates",
    "Pickup notice for: {$cert['establishment']} (Control No. {$cert['control_no']})" .
    ($emailed ? " — emailed to $email" : ($email ? " — email to $email could not be sent" : " — no email on file")));

echo json_encode([
    "success" => true,
    "emailed" => (bool) $emailed,
    "email"   => $email,
    "message" => $emailed
        ? "Pickup notice emailed to $email."
        : ($email
            ? "Email not sent (check the Gmail App Password in config/smtp.php). The establishment will still see the pickup notice on their dashboard."
            : "No email on file — the establishment will see the pickup notice on their dashboard."),
]);
