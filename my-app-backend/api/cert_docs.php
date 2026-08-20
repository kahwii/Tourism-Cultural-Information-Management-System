<?php
/*
  List uploaded documents for a certificate application.
  GET ?certificate_id=ID
  Access: the owning Establishment, or any admin.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

$authUser = require_auth($conn);
$isAdmin = is_admin_role($authUser['role']);
$isEstablishment = ($authUser['role'] === 'Establishment');

$certId = isset($_GET['certificate_id']) ? (int)$_GET['certificate_id'] : 0;
if (!$certId) { http_response_code(400); echo json_encode(["error" => "certificate_id is required."]); exit; }

$res = mysqli_query($conn, "SELECT owner_id FROM certificates WHERE id = $certId LIMIT 1");
$cert = mysqli_fetch_assoc($res);
if (!$cert) { http_response_code(404); echo json_encode(["error" => "Application not found."]); exit; }
if (!$isAdmin && (!$isEstablishment || (int)$cert['owner_id'] !== (int)$authUser['id'])) {
    http_response_code(403); echo json_encode(["error" => "Forbidden."]); exit;
}

$res = mysqli_query($conn, "SELECT id, doc_type, original_name, stored_path, uploaded_at
                            FROM certificate_documents WHERE certificate_id = $certId ORDER BY id ASC");
$rows = [];
while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
echo json_encode($rows);
