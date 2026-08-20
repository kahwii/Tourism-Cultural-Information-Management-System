<?php
/*
  Step 1 of email-based password reset.
  Given an email, generate a 6-digit code, store it (hashed, 15-min expiry),
  and email it to the user via Brevo. Always responds generically so we never
  reveal whether an email is registered.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/mailer.php";

$data  = json_decode(file_get_contents("php://input"), true) ?: [];
$email = trim($data['email'] ?? "");

$generic = ["success" => true, "message" => "If that email is registered, a reset code has been sent."];

if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode($generic);
    exit;
}

$stmt = mysqli_prepare($conn, "SELECT id, username, email FROM users WHERE email = ? LIMIT 1");
mysqli_stmt_bind_param($stmt, "s", $email);
mysqli_stmt_execute($stmt);
$user = mysqli_fetch_assoc(mysqli_stmt_get_result($stmt));

if ($user) {
    $code    = str_pad((string) random_int(0, 999999), 6, "0", STR_PAD_LEFT);
    $hash    = password_hash($code, PASSWORD_DEFAULT);
    $expires = date('Y-m-d H:i:s', time() + 15 * 60); // 15 minutes
    $uid     = (int) $user['id'];

    $st = mysqli_prepare($conn, "UPDATE users SET reset_code = ?, reset_expires = ? WHERE id = ?");
    mysqli_stmt_bind_param($st, "ssi", $hash, $expires, $uid);
    mysqli_stmt_execute($st);

    $html = "<div style='font-family:Arial,sans-serif;max-width:480px'>"
          . "<h2 style='color:#2563eb;margin:0 0 8px'>TCIMS Password Reset</h2>"
          . "<p>Hi " . htmlspecialchars($user['username']) . ",</p>"
          . "<p>Use this code to reset your password:</p>"
          . "<div style='font-size:30px;font-weight:bold;letter-spacing:6px;color:#111827;background:#f1f5f9;padding:14px 0;text-align:center;border-radius:10px;margin:10px 0'>"
          . $code . "</div>"
          . "<p style='color:#6b7280'>This code expires in <b>15 minutes</b>. If you didn't request this, you can safely ignore this email.</p>"
          . "<p style='color:#9ca3af;font-size:12px;margin-top:18px'>City of Mandaluyong — CCAT</p></div>";

    send_email($user['email'], $user['username'], "Your TCIMS password reset code", $html);
}

echo json_encode($generic);
