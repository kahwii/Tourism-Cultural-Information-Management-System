<?php
/*
  Upload a photo for a Tourist Spot, Heritage Site, Restaurant, Hotel,
  or Tourism Business (admin only).

  POST (multipart/form-data):
    - image      (the image file, already cropped client-side to the
                   display aspect ratio — see ImageCropper.jsx)
    - folder     ("tourist_spots", "heritage_sites", "restaurants",
                   "hotels", or "tourism_businesses")
    - old_image  (optional, relative path of a previous image to delete)

  Same pattern as upload_event_image.php: this endpoint only turns an
  uploaded file into a stored, web-accessible path. The frontend then
  sends that path along with the rest of the record's fields to
  apiCreate/apiUpdate against crud.php?table=tourist_spots|heritage_sites.

  Images are re-encoded server-side (this also strips any hidden payload
  from the uploaded file — an image that also contains PHP cannot survive
  re-encoding).
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed."]);
    exit;
}

$ALLOWED_FOLDERS = ["tourist_spots", "heritage_sites", "restaurants", "hotels", "tourism_businesses"];
$folder = $_POST['folder'] ?? '';
if (!in_array($folder, $ALLOWED_FOLDERS, true)) {
    http_response_code(400);
    echo json_encode(["error" => "folder must be one of: " . implode(", ", $ALLOWED_FOLDERS)]);
    exit;
}

if (!isset($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(["error" => "No image was uploaded."]);
    exit;
}

$f = $_FILES['image'];
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
    "image/bmp"  => "imagecreatefrombmp",
    "image/x-ms-bmp" => "imagecreatefrombmp",
    "image/avif" => "imagecreatefromavif",
];
if (!isset($readers[$mime]) || !function_exists($readers[$mime])) {
    http_response_code(400);
    $why = isset($readers[$mime]) ? "your server's PHP build lacks support for it" : "that type isn't recognised";
    echo json_encode(["error" => "Please use a JPG, PNG, GIF, WEBP, BMP, or AVIF image. (HEIC/HEIF photos from iPhones aren't supported — export as JPG first.) [Detected: {$mime}, {$why}]"]);
    exit;
}

$src = @$readers[$mime]($f['tmp_name']);
if (!$src) {
    http_response_code(400);
    echo json_encode(["error" => "The image could not be read."]);
    exit;
}

// The file is already cropped client-side to the right aspect ratio
// (ImageCropper.jsx); just cap the resolution so storage stays reasonable.
$w = imagesx($src); $h = imagesy($src);
$MAX_W = 1200; $MAX_H = 1200;
$scale = min(1, $MAX_W / $w, $MAX_H / $h);
$dw = max(1, (int) round($w * $scale));
$dh = max(1, (int) round($h * $scale));

$dst = imagecreatetruecolor($dw, $dh);
$white = imagecolorallocate($dst, 255, 255, 255);
imagefilledrectangle($dst, 0, 0, $dw, $dh, $white); // flatten transparency for JPEG output
imagecopyresampled($dst, $src, 0, 0, 0, 0, $dw, $dh, $w, $h);

$relDir = "uploads/" . $folder;
$absDir = realpath(__DIR__ . "/..") . "/" . $relDir;
if (!is_dir($absDir)) { mkdir($absDir, 0775, true); }

$name    = "p_" . bin2hex(random_bytes(8)) . ".jpg";
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

// best-effort cleanup of the image it's replacing
if (!empty($_POST['old_image'])) {
    $old = realpath(__DIR__ . "/../" . $_POST['old_image']);
    if ($old && strpos($old, $absDir) === 0 && is_file($old)) @unlink($old);
}

echo json_encode(["success" => true, "image" => $relPath]);
