<?php
// ---- Token-based auth helpers ----

// Read the Bearer token from the Authorization header (with Apache fallback).
function bearer_token() {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($h === '' && function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strtolower($k) === 'authorization') { $h = $v; break; }
        }
    }
    if (stripos($h, 'Bearer ') === 0) return trim(substr($h, 7));
    return '';
}

function current_user($conn) {
    $token = bearer_token();
    if ($token === '') return null;
    $stmt = mysqli_prepare($conn, "SELECT id, username, email, role, status, avatar FROM users WHERE api_token = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    return mysqli_fetch_assoc($res) ?: null;
}

function is_admin_role($role) {
    return in_array($role, ["Super Admin", "CCAT Admin", "CCAT Staff", "admin"], true);
}

// Approver roles — the "checker" half of maker-checker.
// CCAT Staff are makers: they encode content, but account management,
// the audit trail, and publishing approvals are deliberately out of reach.
// Keep this list in sync with APPROVER_ROLES in the frontend.
function is_approver_role($role) {
    return in_array($role, ["Super Admin", "CCAT Admin", "admin"], true);
}

// Require any logged-in user.
function require_auth($conn) {
    $u = current_user($conn);
    if (!$u) { http_response_code(401); echo json_encode(["error" => "Unauthorized. Please log in again."]); exit; }
    if (($u['status'] ?? 'Active') === 'Inactive') { http_response_code(403); echo json_encode(["error" => "Account is inactive."]); exit; }
    return $u;
}

// Require an admin-type user.
function require_admin($conn) {
    $u = require_auth($conn);
    if (!is_admin_role($u['role'])) { http_response_code(403); echo json_encode(["error" => "Forbidden. Admins only."]); exit; }
    return $u;
}

// Require an approver (CCAT Admin / Super Admin). Use this instead of
// require_admin() for anything a CCAT Staff member must not be able to do.
function require_approver($conn) {
    $u = require_auth($conn);
    if (!is_approver_role($u['role'])) {
        http_response_code(403);
        echo json_encode(["error" => "Forbidden. This action is limited to CCAT Admin and Super Admin."]);
        exit;
    }
    return $u;
}
