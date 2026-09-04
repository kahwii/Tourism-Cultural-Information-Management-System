<?php
/*
  Heritage Trail check-in WITH photo proof.
  POST (multipart/form-data):
    - place  (string)
    - selfie (image file)   -> a selfie at the site
    - site   (image file)   -> a photo of the heritage site
  Records the visit (if not already) and stores both photos as proof.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

$authUser = require_auth($conn);
$uid = (int)$authUser['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(["error" => "Method not allowed."]); exit;
}

$place = trim($_POST['place'] ?? "");
if ($place === "") { http_response_code(400); echo json_encode(["error" => "place is required."]); exit; }
if (!isset($_FILES['selfie']) || !isset($_FILES['site'])) {
    http_response_code(400); echo json_encode(["error" => "Both a selfie and an on-site photo are required."]); exit;
}

$allowed = ["jpg" => "image/jpeg", "jpeg" => "image/jpeg", "png" => "image/png", "webp" => "image/webp"];
$relDir = "uploads/visits";
$absDir = realpath(__DIR__ . "/..") . "/" . $relDir;
if (!is_dir($absDir)) { mkdir($absDir, 0775, true); }

// validate + move one file; returns [relPath, storedName, originalName] or errors out.
function save_photo($f, $label, $uid, $allowed, $absDir, $relDir) {
    if ($f['error'] !== UPLOAD_ERR_OK) { http_response_code(400); echo json_encode(["error" => "$label upload failed."]); exit; }
    if ($f['size'] > 6 * 1024 * 1024) { http_response_code(400); echo json_encode(["error" => "$label is too large (max 6 MB)."]); exit; }
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!isset($allowed[$ext])) { http_response_code(400); echo json_encode(["error" => "$label must be a JPG, PNG, or WEBP image."]); exit; }
    $finfo = finfo_open(FILEINFO_MIME_TYPE); $mime = finfo_file($finfo, $f['tmp_name']); finfo_close($finfo);
    if ($mime !== $allowed[$ext]) { http_response_code(400); echo json_encode(["error" => "$label content does not match its type."]); exit; }
    $name = $uid . "_" . $label . "_" . bin2hex(random_bytes(6)) . "." . $ext;
    if (!move_uploaded_file($f['tmp_name'], $absDir . "/" . $name)) { http_response_code(500); echo json_encode(["error" => "Could not save $label."]); exit; }
    return [$relDir . "/" . $name, $name, $f['name']];
}

[$selfiePath, $selfieName, $selfieOrig] = save_photo($_FILES['selfie'], "selfie", $uid, $allowed, $absDir, $relDir);
[$sitePath,   $siteName,   $siteOrig]   = save_photo($_FILES['site'],   "site",   $uid, $allowed, $absDir, $relDir);

$esc = fn($v) => mysqli_real_escape_string($conn, (string)$v);
$p = $esc($place);

// Record the visit as VERIFIED (this endpoint is only reached after GPS
// proximity passed and a selfie + site photo were captured — see
// verifyAtLocation() on the frontend and config/heritage_trail.php's
// trail_status(), which only counts verified = 1 rows).
//
// If a row already exists for this (user, place) — e.g. the tourist earlier
// tapped Explore's casual check-in for this same place, which only ever
// writes verified = 0 — it's upgraded to verified = 1 here rather than
// left alone, since this real GPS+photo proof supersedes an earlier
// self-report.
$res = mysqli_query($conn, "SELECT id, verified FROM visits WHERE user_id = $uid AND place = '$p' LIMIT 1");
$existing = $res ? mysqli_fetch_assoc($res) : null;

if (!$existing) {
    $stmt = mysqli_prepare($conn, "INSERT INTO visits (user_id, place, verified) VALUES (?, ?, 1)");
    mysqli_stmt_bind_param($stmt, "is", $uid, $place);
    mysqli_stmt_execute($stmt);
} elseif (!$existing['verified']) {
    mysqli_query($conn, "UPDATE visits SET verified = 1 WHERE id = " . (int)$existing['id']);
}

// store both photos as proof
$ins = "INSERT INTO visit_photos (user_id, place, photo_type, filename, original_name, stored_path) VALUES
        ($uid, '$p', 'selfie', '" . $esc($selfieName) . "', '" . $esc($selfieOrig) . "', '" . $esc($selfiePath) . "'),
        ($uid, '$p', 'site',   '" . $esc($siteName)   . "', '" . $esc($siteOrig)   . "', '" . $esc($sitePath)   . "')";
mysqli_query($conn, $ins);

echo json_encode(["success" => true, "visited" => true, "selfie" => $selfiePath, "site" => $sitePath]);
