<?php
/*
  Activity Log helper (audit trail).
  Fails silently if the activity_logs table doesn't exist yet,
  so normal operations are NEVER broken by logging.

  Usage: log_activity($conn, $user, "Created", "events", "Added event: Fiesta 2026");
*/
function log_activity($conn, $user, $action, $target = "", $details = "") {
    try {
        $uid      = isset($user['id']) ? (int)$user['id'] : null;
        $username = isset($user['username']) ? (string)$user['username'] : "system";
        $role     = isset($user['role']) ? (string)$user['role'] : "";
        $ip       = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? "");
        // keep only the first IP if there is a proxy chain
        if (strpos($ip, ",") !== false) $ip = trim(explode(",", $ip)[0]);
        $details  = mb_substr((string)$details, 0, 500);
        $target   = mb_substr((string)$target, 0, 150);

        $st = @mysqli_prepare($conn,
            "INSERT INTO activity_logs (user_id, username, role, action, target, details, ip) VALUES (?,?,?,?,?,?,?)");
        if (!$st) return; // table not created yet -> skip quietly
        mysqli_stmt_bind_param($st, "issssss", $uid, $username, $role, $action, $target, $details, $ip);
        @mysqli_stmt_execute($st);
    } catch (Throwable $e) {
        // never let logging break the request
    }
}
