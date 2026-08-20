<?php
/*
  Unclaimed-certificate pickup reminders.

  Certificates that have been Approved but not yet picked up get an
  automatic reminder email at 30, 60, and 90 days after approval.
  90 days is the pickup deadline (see pickup_deadline, set alongside
  approved_at in crud.php when a certificate is first approved).

  This is free hosting with no built-in job scheduler, so this endpoint
  is designed to be triggered two ways:
   1) Best-effort, silently, whenever a CCAT admin opens the Certificates
      page (see Certificates.jsx) — works with zero extra setup.
   2) A real InfinityFree Cron Job hitting this URL once a day with
      ?key=<CRON_KEY> below, for reminders that go out even if no admin
      logs in that day. Optional, but recommended before final launch.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";
require_once "../config/smtp.php";

// Change this if you set up a real InfinityFree Cron Job for this endpoint.
const CRON_KEY = "tcims_pickup_cron_2026";

$admin = null;
if (($_GET['key'] ?? '') !== CRON_KEY) {
    $admin = require_admin($conn); // exits with 401/403 if not a logged-in admin
}

function pickup_reminder_email($cert, $milestone) {
    $deadline = $cert['pickup_deadline'] ? date("F j, Y", strtotime($cert['pickup_deadline'])) : "90 days after approval";
    if ($milestone === 30) {
        $subject = "Reminder: Your Certificate of Registration is Waiting for Pick Up";
        $lead = "This is a friendly reminder that your official Certificate of Registration has been ready for pick up for 30 days now.";
    } elseif ($milestone === 60) {
        $subject = "Second Reminder: Please Claim Your Certificate of Registration";
        $lead = "It has now been 60 days since your Certificate of Registration was approved and made ready for pick up.";
    } else {
        $subject = "Final Notice: Certificate Pick-Up Deadline Reached";
        $lead = "It has now been 90 days since approval, and the pick-up deadline for your Certificate of Registration has been reached.";
    }
    $body =
        "Good day, {$cert['establishment']}!\r\n\r\n" .
        "$lead\r\n\r\n" .
        "Control No.: {$cert['control_no']}\r\n" .
        "Deadline to claim: $deadline\r\n\r\n" .
        "Please claim your certificate at:\r\n\r\n" .
        "  City Cultural Affairs & Tourism Development Department (CCAT)\r\n" .
        "  Mandaluyong City Hall\r\n" .
        "  Monday to Friday, 8:00 AM - 5:00 PM\r\n\r\n" .
        "Please bring one (1) valid government-issued ID and your Official Receipt (OR No. {$cert['or_no']}).\r\n\r\n" .
        ($milestone === 90
            ? "Certificates left unclaimed past the deadline may be subject to cancellation. Please coordinate with our office if you need an extension.\r\n\r\n"
            : "") .
        "Thank you,\r\n" .
        "City Cultural Affairs & Tourism Development Department\r\n" .
        "City of Mandaluyong";
    return [$subject, $body];
}

$res = mysqli_query($conn, "
  SELECT * FROM certificates
  WHERE status = 'Approved' AND picked_up_at IS NULL AND approved_at IS NOT NULL
");

$checked = 0; $sent = 0;
while ($cert = mysqli_fetch_assoc($res)) {
    $checked++;
    $approvedAt = strtotime($cert['approved_at']);
    if (!$approvedAt) continue;
    $daysSince = floor((time() - $approvedAt) / 86400);
    $lastSent = (int) ($cert['last_reminder_sent'] ?? 0);

    $milestone = 0;
    if ($daysSince >= 90 && $lastSent < 90) $milestone = 90;
    elseif ($daysSince >= 60 && $lastSent < 60) $milestone = 60;
    elseif ($daysSince >= 30 && $lastSent < 30) $milestone = 30;
    if (!$milestone) continue;

    // owner's account email, falling back to the application's contact field
    $ownerEmail = "";
    $oid = (int) ($cert['owner_id'] ?? 0);
    if ($oid > 0) {
        $st = mysqli_prepare($conn, "SELECT email FROM users WHERE id = ?");
        mysqli_stmt_bind_param($st, "i", $oid);
        mysqli_stmt_execute($st);
        $row = mysqli_fetch_assoc(mysqli_stmt_get_result($st));
        $ownerEmail = trim($row['email'] ?? "");
    }
    if ($ownerEmail === "" && filter_var(trim($cert['contact'] ?? ""), FILTER_VALIDATE_EMAIL)) {
        $ownerEmail = trim($cert['contact']);
    }

    $emailed = false;
    if ($ownerEmail !== "" && filter_var($ownerEmail, FILTER_VALIDATE_EMAIL)) {
        [$subject, $body] = pickup_reminder_email($cert, $milestone);
        $emailed = smtp_send($ownerEmail, $subject, $body);
    }

    mysqli_query($conn, "UPDATE certificates SET last_reminder_sent = $milestone WHERE id = " . (int) $cert['id']);
    if ($admin) {
        log_activity($conn, $admin, "Notified", "certificates",
            "$milestone-day pickup reminder for: {$cert['establishment']}" .
            ($emailed ? " — emailed to $ownerEmail" : " — email not sent"));
    }
    $sent++;
}

echo json_encode(["success" => true, "checked" => $checked, "reminders_sent" => $sent]);
