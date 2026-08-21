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

// Server-side idle timeout for api_token. Slightly more forgiving than the
// frontend's 15-minute inactivity timer (AuthContext.jsx) to absorb network
// lag/clock skew — but the important part is that this is enforced here, on
// the server, not just in the browser. Before this existed, a copied or
// leaked token (lost laptop still signed in, browser dev tools, malware
// reading localStorage) worked forever; nothing short of changing the
// password could revoke it. Now an unused token simply stops working.
const TOKEN_IDLE_MINUTES = 30;

function current_user($conn) {
    $token = bearer_token();
    if ($token === '') return null;
    $stmt = mysqli_prepare($conn, "SELECT id, username, email, role, status, avatar, token_last_used_at FROM users WHERE api_token = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $u = mysqli_fetch_assoc($res) ?: null;
    if (!$u) return null;

    if ($u['token_last_used_at'] !== null) {
        $idleSeconds = time() - strtotime($u['token_last_used_at']);
        if ($idleSeconds > TOKEN_IDLE_MINUTES * 60) {
            return null; // token exists but has gone idle too long — treat as signed out
        }
    }

    // Sliding renewal: any authenticated request keeps an active session
    // alive, so someone actually using the app is never cut off mid-work.
    $upd = mysqli_prepare($conn, "UPDATE users SET token_last_used_at = NOW() WHERE id = ?");
    mysqli_stmt_bind_param($upd, "i", $u['id']);
    mysqli_stmt_execute($upd);

    unset($u['token_last_used_at']);
    return $u;
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
