<?php
/*
  Gmail SMTP sender for TCIMS notifications.
  InfinityFree blocks PHP mail(), but allows outbound SMTP —
  so we send real email through your Gmail account.

  SETUP (one time):
  1. Go to your Google Account -> Security -> turn ON 2-Step Verification.
  2. Search "App passwords" -> create one (name it TCIMS) -> copy the 16-character password.
  3. Paste it below in $SMTP_PASS (keep the quotes, spaces optional).
*/
/*
  Credentials come from the environment first, so nothing secret lives in the
  repository. On Render (or any host) set these in the dashboard:

      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_NAME

  For local XAMPP development, copy config/smtp_credentials.example.php to
  config/smtp_credentials.php and fill it in — that file is gitignored.

  A Gmail App Password grants full send access to the mailbox. It must never be
  committed: anyone who reads the repository could send mail as CCAT.
*/
$SMTP_HOST      = getenv('SMTP_HOST') ?: "smtp.gmail.com";
$SMTP_PORT      = (int) (getenv('SMTP_PORT') ?: 587);
$SMTP_USER      = getenv('SMTP_USER') ?: "";
$SMTP_PASS      = getenv('SMTP_PASS') ?: "";
$SMTP_FROM_NAME = getenv('SMTP_FROM_NAME') ?: "TCIMS Mandaluyong CCAT";

// Local fallback — gitignored, so it exists only on a developer machine.
if ($SMTP_USER === "" && file_exists(__DIR__ . "/smtp_credentials.php")) {
    require __DIR__ . "/smtp_credentials.php";
}

/* Minimal SMTP client (STARTTLS + AUTH LOGIN). Returns true if accepted.
   Pass $isHtml = true to send an HTML-formatted message (e.g. the Trail
   completion certificate email) — existing plain-text callers are unaffected. */
function smtp_send($to, $subject, $body, $isHtml = false) {
    global $SMTP_HOST, $SMTP_PORT, $SMTP_USER, $SMTP_PASS, $SMTP_FROM_NAME;
    $pass = str_replace(" ", "", $SMTP_PASS); // app passwords are shown with spaces
    if ($pass === "" || $pass === "PASTE_APP_PASSWORD_HERE") return false;

    // Are we on a developer machine or the live host?
    // XAMPP on Windows ships a stale/empty curl-ca-bundle.crt, so verifying
    // Gmail's certificate fails locally and no mail can ever be sent from a
    // dev machine. Production has a working CA store and must stay strict:
    // trusting any certificate on a public server would let an attacker
    // intercept the mailbox credentials.
    //
    // This has to be decided BEFORE the handshake — once a stream's crypto
    // attempt fails it cannot be retried ("SSL/TLS already set-up for this
    // stream"), so a retry-after-failure fallback silently does nothing.
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $isLocal = $host === ''
        || strpos($host, 'localhost') !== false
        || strpos($host, '127.0.0.1') !== false;

    $ctx = stream_context_create($isLocal ? ["ssl" => [
        "verify_peer"       => false,
        "verify_peer_name"  => false,
        "allow_self_signed" => true,
    ]] : []);

    $fp = @stream_socket_client(
        "tcp://{$SMTP_HOST}:{$SMTP_PORT}",
        $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx
    );
    if (!$fp) return false;
    stream_set_timeout($fp, 15);

    $read = function () use ($fp) {
        $data = "";
        while (($line = fgets($fp, 515)) !== false) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break; // last line of reply
        }
        return $data;
    };
    $cmd = function ($c) use ($fp, $read) { fwrite($fp, $c . "\r\n"); return $read(); };
    $ok  = function ($resp, $code) { return strpos($resp, (string)$code) === 0; };

    try {
        if (!$ok($read(), 220)) { fclose($fp); return false; }
        if (!$ok($cmd("EHLO tcims"), 250)) { fclose($fp); return false; }
        if (!$ok($cmd("STARTTLS"), 220)) { fclose($fp); return false; }

        // STREAM_CRYPTO_METHOD_TLS_CLIENT accepts whatever modern TLS version
        // the server offers, instead of pinning specific ones.
        $crypto = defined('STREAM_CRYPTO_METHOD_TLS_CLIENT')
            ? STREAM_CRYPTO_METHOD_TLS_CLIENT
            : STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;

        // Verification behaviour was already fixed by $ctx above.
        if (!@stream_socket_enable_crypto($fp, true, $crypto)) { fclose($fp); return false; }
        if (!$ok($cmd("EHLO tcims"), 250)) { fclose($fp); return false; }
        if (!$ok($cmd("AUTH LOGIN"), 334)) { fclose($fp); return false; }
        if (!$ok($cmd(base64_encode($SMTP_USER)), 334)) { fclose($fp); return false; }
        if (!$ok($cmd(base64_encode($pass)), 235)) { fclose($fp); return false; }
        if (!$ok($cmd("MAIL FROM:<{$SMTP_USER}>"), 250)) { fclose($fp); return false; }
        if (!$ok($cmd("RCPT TO:<{$to}>"), 250)) { fclose($fp); return false; }
        if (!$ok($cmd("DATA"), 354)) { fclose($fp); return false; }

        $headers =
            "From: {$SMTP_FROM_NAME} <{$SMTP_USER}>\r\n" .
            "To: <{$to}>\r\n" .
            "Subject: {$subject}\r\n" .
            "MIME-Version: 1.0\r\n" .
            "Content-Type: " . ($isHtml ? "text/html" : "text/plain") . "; charset=UTF-8\r\n";
        $body = preg_replace('/^\./m', '..', $body); // SMTP dot-stuffing

        $sent = $ok($cmd($headers . "\r\n" . $body . "\r\n."), 250);
        $cmd("QUIT");
        fclose($fp);
        return $sent;
    } catch (Throwable $e) {
        @fclose($fp);
        return false;
    }
}
