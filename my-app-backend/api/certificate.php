<?php
/*
  Heritage Church Trail — Certificate of Completion.

  GET  -> the tourist's own trail-completion status (done/total/date/name/email).
  POST -> email the certificate to the tourist. Body: { "email"?: string }
          "email" is only required if the account has no email on file yet
          (e.g. very old test accounts) — if provided, it is saved to the
          account so future certificate emails don't need to ask again.

  The 9 required churches are hardcoded here (not read from the heritage_sites
  DB table) so completion always matches exactly what the tourist sees as
  9/9 on their Trail page (src/data/tcimsData.js, category === "Church").
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/smtp.php";
require_once "../config/heritage_trail.php"; // $TRAIL_CHURCHES + trail_status()

// Some Tourist accounts sign in with an email as their username (Google/
// Firebase, or .edu accounts) — printing that raw on a certificate looks
// broken, so show a tidied-up version of just the local part instead.
// "markemmanuel.sagarino@my.jru.edu" -> "Markemmanuel Sagarino"
function pretty_name($raw) {
    if ($raw === "" || $raw === null) return "";
    $local = strpos($raw, "@") !== false ? explode("@", $raw)[0] : $raw;
    $words = array_filter(preg_split('/[._\s]+/', $local));
    if (count($words) === 0) return $raw;
    return implode(" ", array_map(fn($w) => mb_convert_case($w, MB_CASE_TITLE), $words));
}

$authUser = require_auth($conn);
$uid = (int) $authUser['id'];

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $st = trail_status($conn, $uid, $TRAIL_CHURCHES);
    echo json_encode([
        "completed" => $st["completed"],
        "done"      => $st["done"],
        "total"     => $st["total"],
        "date"      => $st["date"],
        "name"      => pretty_name($authUser['username']),
        "email"     => $authUser['email'] ?? "",
    ]);
    exit;
}

if ($method === 'POST') {
    $st = trail_status($conn, $uid, $TRAIL_CHURCHES);
    if (!$st["completed"]) {
        http_response_code(400);
        echo json_encode(["error" => "Trail not yet complete.", "done" => $st["done"], "total" => $st["total"]]);
        exit;
    }

    $data = json_decode(file_get_contents("php://input"), true) ?: [];
    $email = trim($authUser['email'] ?? "");

    // no email on file yet -> the one the tourist just typed in; save it
    if ($email === "") {
        $given = trim($data['email'] ?? "");
        if ($given === "" || !filter_var($given, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(["error" => "A valid email address is required."]);
            exit;
        }
        $upd = mysqli_prepare($conn, "UPDATE users SET email = ? WHERE id = ? AND (email IS NULL OR email = '')");
        mysqli_stmt_bind_param($upd, "si", $given, $uid);
        mysqli_stmt_execute($upd);
        $email = $given;
    }

    $dateLabel = $st["date"] ? date("F j, Y", strtotime($st["date"])) : date("F j, Y");
    $name = htmlspecialchars(pretty_name($authUser['username']));

    $html =
        "<div style='font-family:Georgia,serif;max-width:520px;margin:0 auto;border:2px solid #EAA31E;border-radius:14px;padding:32px;text-align:center;background:#FEFDFB'>"
      . "<div style='font-size:12px;letter-spacing:2px;color:#9ca3af;margin-bottom:6px'>CITY OF MANDALUYONG &bull; CCAT</div>"
      . "<h1 style='color:#1D4ED8;font-size:26px;margin:6px 0'>Certificate of Completion</h1>"
      . "<div style='color:#EAA31E;font-weight:700;letter-spacing:2px;font-size:13px;margin-bottom:18px'>HERITAGE CHURCH TRAIL</div>"
      . "<div style='color:#6b7280;font-style:italic;margin-bottom:6px'>This certifies that</div>"
      . "<div style='font-size:28px;font-weight:800;color:#0F172A;margin-bottom:14px'>{$name}</div>"
      . "<p style='color:#374151;font-size:14px;line-height:1.6'>has successfully completed the Heritage Church Trail of Mandaluyong, visiting all 9 historic churches of the city.</p>"
      . "<div style='color:#9ca3af;font-size:12px;margin-top:16px'>Awarded on {$dateLabel}</div>"
      . "<div style='margin-top:24px;color:#6b7280;font-size:12px'>Be@Mandaluyong &bull; City of Mandaluyong</div>"
      . "</div>"
      . "<p style='text-align:center;color:#9ca3af;font-size:11px;margin-top:14px'>Open the Be@Mandaluyong app anytime to view, download, or share this certificate.</p>";

    $emailed = smtp_send($email, "Your Heritage Church Trail Certificate - Be@Mandaluyong", $html, true);

    echo json_encode(["success" => true, "emailed" => (bool) $emailed, "email" => $email]);
    exit;
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed."]);
