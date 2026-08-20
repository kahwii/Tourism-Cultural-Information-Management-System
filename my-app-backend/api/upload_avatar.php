<?php
/*
  Upload / remove the signed-in user's profile picture.

  POST (multipart/form-data): avatar=<image file>   -> saves and returns the path
  POST (JSON): {"action":"remove"}                  -> clears the picture

  Images are re-encoded and resized server-side to a 320x320 square JPEG.
  This keeps storage small on free hosting AND strips any hidden payload from
  the uploaded file (an image that also contains PHP cannot survive re-encoding).
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

$user = require_auth($conn);
$uid  = (int) $user['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed."]);
    exit;
}

$relDir = "uploads/avatars";
$absDir = realpath(__DIR__ . "/..") . "/" . $relDir;

/* ---------- remove ---------- */
$raw = file_get_contents("php://input");
if ($raw && strpos($raw, "remove") !== false) {
    $data = json_decode($raw, true) ?: [];
    if (($data['action'] ?? '') === 'remove') {
        // delete the old file if it belongs to this user
        $st = mysqli_prepare($conn, "SELECT avatar FROM users WHERE id = ?");
        mysqli_stmt_bind_param($st, "i", $uid);
        mysqli_stmt_execute($st);
        $row = mysqli_fetch_assoc(mysqli_stmt_get_result($st));
        if (!empty($row['avatar'])) {
            $old = realpath(__DIR__ . "/../" . $row['avatar']);
            if ($old && strpos($old, $absDir) === 0 && is_file($old)) @unlink($old);
        }
        $st = mysqli_prepare($conn, "UPDATE users SET avatar = NULL WHERE id = ?");
        mysqli_stmt_bind_param($st, "i", $uid);
        mysqli_stmt_execute($st);
        log_activity($conn, $user, "Profile", "users", "Removed profile picture");
        echo json_encode(["success" => true, "avatar" => null, "message" => "Profile picture removed."]);
        exit;
    }
}

/* ---------- upload ---------- */
if (!isset($_FILES['avatar'])) {
    http_response_code(400);
    echo json_encode(["error" => "No image was uploaded."]);
    exit;
}

$f = $_FILES['avatar'];
if ($f['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(["error" => "Upload failed (code " . $f['error'] . ")."]);
    exit;
}
if ($f['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(["error" => "Image is too large (max 5 MB)."]);
    exit;
}

// Trust the actual image content, not the filename.
$info = @getimagesize($f['tmp_name']);
if (!$info) {
    http_response_code(400);
    echo json_encode(["error" => "That file is not a valid image."]);
    exit;
}
$mime = $info['mime'];
$readers = [
    "image/jpeg" => "imagecreatefromjpeg",
    "image/png"  => "imagecreatefrompng",
    "image/gif"  => "imagecreatefromgif",
    "image/webp" => "imagecreatefromwebp",
];
if (!isset($readers[$mime]) || !function_exists($readers[$mime])) {
    http_response_code(400);
    echo json_encode(["error" => "Please use a JPG, PNG, GIF, or WEBP image."]);
    exit;
}

$src = @$readers[$mime]($f['tmp_name']);
if (!$src) {
    http_response_code(400);
    echo json_encode(["error" => "The image could not be read."]);
    exit;
}

// Centre-crop to a square, then resize to 320x320.
$w = imagesx($src); $h = imagesy($src);
$side = min($w, $h);
$sx = (int) (($w - $side) / 2);
$sy = (int) (($h - $side) / 2);

$SIZE = 320;
$dst = imagecreatetruecolor($SIZE, $SIZE);
// flatten transparency onto white so JPEG output looks right
$white = imagecolorallocate($dst, 255, 255, 255);
imagefilledrectangle($dst, 0, 0, $SIZE, $SIZE, $white);
imagecopyresampled($dst, $src, 0, 0, $sx, $sy, $SIZE, $SIZE, $side, $side);

if (!is_dir($absDir)) { mkdir($absDir, 0775, true); }

// remove the previous picture so old files don't pile up
$st = mysqli_prepare($conn, "SELECT avatar FROM users WHERE id = ?");
mysqli_stmt_bind_param($st, "i", $uid);
mysqli_stmt_execute($st);
$row = mysqli_fetch_assoc(mysqli_stmt_get_result($st));
if (!empty($row['avatar'])) {
    $old = realpath(__DIR__ . "/../" . $row['avatar']);
    if ($old && strpos($old, $absDir) === 0 && is_file($old)) @unlink($old);
}

$name    = "u" . $uid . "_" . bin2hex(random_bytes(6)) . ".jpg";
$relPath = $relDir . "/" . $name;
$absPath = $absDir . "/" . $name;

$ok = imagejpeg($dst, $absPath, 85);
imagedestroy($src);
imagedestroy($dst);

if (!$ok) {
    http_response_code(500);
    echo json_encode(["error" => "Could not save the image."]);
    exit;
}

$st = mysqli_prepare($conn, "UPDATE users SET avatar = ? WHERE id = ?");
mysqli_stmt_bind_param($st, "si", $relPath, $uid);
mysqli_stmt_execute($st);

log_activity($conn, $user, "Profile", "users", "Updated profile picture");

echo json_encode(["success" => true, "avatar" => $relPath, "message" => "Profile picture updated."]);
