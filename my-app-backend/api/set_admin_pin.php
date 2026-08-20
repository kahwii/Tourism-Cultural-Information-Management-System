<?php
/*
  Admin sets / changes / removes their 2-step login PIN.
  When a PIN is set, login requires it after the password.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/activity.php";

$user = require_admin($conn); // admins only
$data = json_decode(file_get_contents("php://input"), true) ?: [];
$action = $data['action'] ?? "set";
$pin    = trim($data['pin'] ?? "");
$uid    = (int) $user['id'];

if ($action === "remove") {
    $st = mysqli_prepare($conn, "UPDATE users SET admin_pin = NULL WHERE id = ?");
    mysqli_stmt_bind_param($st, "i", $uid);
    mysqli_stmt_execute($st);
    log_activity($conn, $user, "Security", "auth", "Turned OFF two-step login PIN");
    echo json_encode(["success" => true, "message" => "PIN removed. Two-step login is now OFF."]);
    exit;
}

if (!preg_match('/^\d{6}$/', $pin)) {
    http_response_code(400);
    echo json_encode(["error" => "PIN must be exactly 6 digits."]);
    exit;
}

$hash = password_hash($pin, PASSWORD_DEFAULT);
$st = mysqli_prepare($conn, "UPDATE users SET admin_pin = ? WHERE id = ?");
mysqli_stmt_bind_param($st, "si", $hash, $uid);
mysqli_stmt_execute($st);
log_activity($conn, $user, "Security", "auth", "Set / updated two-step login PIN");
echo json_encode(["success" => true, "message" => "PIN set. Two-step login is now ON."]);
