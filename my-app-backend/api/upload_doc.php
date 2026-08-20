<?php
/*
  Upload a single requirement document for a certificate application.
  POST (multipart/form-data):
    - certificate_id  (int)
    - doc_type        (string, e.g. "Business Permit")
    - file            (the uploaded file)
  Access: the owning Establishment, or any admin.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

$authUser = require_auth($conn);
$isAdmin = is_admin_role($authUser['role']);
$isEstablishment = ($authUser['role'] === 'Establishment');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); echo json_encode(["error" => "Method not allowed."]); exit;
}

$certId  = isset($_POST['certificate_id']) ? (int)$_POST['certificate_id'] : 0;
$docType = isset($_POST['doc_type']) ? trim($_POST['doc_type']) : 'Document';

if (!$certId || !isset($_FILES['file'])) {
    http_response_code(400); echo json_encode(["error" => "certificate_id and file are required."]); exit;
}

// the application must exist; establishments may only upload to their OWN application
$res = mysqli_query($conn, "SELECT owner_id FROM certificates WHERE id = " . $certId . " LIMIT 1");
$cert = mysqli_fetch_assoc($res);
if (!$cert) { http_response_code(404); echo json_encode(["error" => "Application not found."]); exit; }
if (!$isAdmin && (!$isEstablishment || (int)$cert['owner_id'] !== (int)$authUser['id'])) {
    http_response_code(403); echo json_encode(["error" => "Forbidden. Not your application."]); exit;
}

$f = $_FILES['file'];
if ($f['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400); echo json_encode(["error" => "Upload failed (code " . $f['error'] . ")."]); exit;
}
if ($f['size'] > 5 * 1024 * 1024) {
    http_response_code(400); echo json_encode(["error" => "File too large (max 5 MB)."]); exit;
}

// validate type by extension + MIME
$allowed = ["pdf" => "application/pdf", "jpg" => "image/jpeg", "jpeg" => "image/jpeg", "png" => "image/png"];
$ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
if (!isset($allowed[$ext])) {
    http_response_code(400); echo json_encode(["error" => "Only PDF, JPG, or PNG files are allowed."]); exit;
}
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $f['tmp_name']);
finfo_close($finfo);
if ($mime !== $allowed[$ext]) {
    http_response_code(400); echo json_encode(["error" => "File content does not match its extension."]); exit;
}

// store under a web-accessible uploads folder
$relDir = "uploads/certificates";
$absDir = realpath(__DIR__ . "/..") . "/" . $relDir;
if (!is_dir($absDir)) { mkdir($absDir, 0775, true); }

$safe = $certId . "_" . bin2hex(random_bytes(8)) . "." . $ext;
$relPath = $relDir . "/" . $safe;
$absPath = $absDir . "/" . $safe;

if (!move_uploaded_file($f['tmp_name'], $absPath)) {
    http_response_code(500); echo json_encode(["error" => "Could not save file."]); exit;
}

$origin = mysqli_real_escape_string($conn, $f['name']);
$dt     = mysqli_real_escape_string($conn, $docType);
$fn     = mysqli_real_escape_string($conn, $safe);
$sp     = mysqli_real_escape_string($conn, $relPath);

$sql = "INSERT INTO certificate_documents (certificate_id, doc_type, filename, original_name, stored_path)
        VALUES ($certId, '$dt', '$fn', '$origin', '$sp')";
if (mysqli_query($conn, $sql)) {
    echo json_encode(["success" => true, "id" => mysqli_insert_id($conn), "stored_path" => $relPath, "doc_type" => $docType, "original_name" => $f['name']]);
} else {
    http_response_code(500); echo json_encode(["error" => mysqli_error($conn)]);
}
