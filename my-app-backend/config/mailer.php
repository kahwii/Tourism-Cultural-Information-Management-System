<?php
require_once __DIR__ . "/brevo.php";

// Send an email via the Brevo HTTP API (works where SMTP is blocked).
// Returns true on success, false otherwise.
function send_email($toEmail, $toName, $subject, $htmlContent) {
    if (BREVO_API_KEY === "PASTE_YOUR_BREVO_API_KEY_HERE" || BREVO_API_KEY === "") {
        return false; // not configured yet
    }
    $payload = json_encode([
        "sender"      => ["name" => BREVO_SENDER_NAME, "email" => BREVO_SENDER_EMAIL],
        "to"          => [["email" => $toEmail, "name" => $toName ?: $toEmail]],
        "subject"     => $subject,
        "htmlContent" => $htmlContent,
    ]);
    $ch = curl_init("https://api.brevo.com/v3/smtp/email");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            "accept: application/json",
            "content-type: application/json",
            "api-key: " . BREVO_API_KEY,
        ],
        CURLOPT_TIMEOUT        => 15,
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}
