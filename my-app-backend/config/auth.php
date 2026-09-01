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

// Multi-session: each login (web, phone, ...) gets its own row in
// user_tokens, so signing in on one device no longer invalidates another.
// See add_user_tokens.sql for the table and why this replaced a single
// users.api_token column.
function current_user($conn) {
    $token = bearer_token();
    if ($token === '') return null;
    $stmt = mysqli_prepare($conn, "
        SELECT u.id, u.username, u.email, u.role, u.status, u.avatar,
               t.id AS token_row_id, t.last_used_at
        FROM user_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token = ?
        LIMIT 1
    ");
    mysqli_stmt_bind_param($stmt, "s", $token);
    mysqli_stmt_execute($stmt);
    $res = mysqli_stmt_get_result($stmt);
    $u = mysqli_fetch_assoc($res) ?: null;
    if (!$u) return null;

    if ($u['last_used_at'] !== null) {
        $idleSeconds = time() - strtotime($u['last_used_at']);
        if ($idleSeconds > TOKEN_IDLE_MINUTES * 60) {
            // Only this session went idle — revoke just this row, other
            // devices signed into the same account are unaffected.
            $del = mysqli_prepare($conn, "DELETE FROM user_tokens WHERE id = ?");
            mysqli_stmt_bind_param($del, "i", $u['token_row_id']);
            mysqli_stmt_execute($del);
            return null;
        }
    }

    // Sliding renewal: any authenticated request keeps THIS session alive.
    // Other devices' sessions have their own independent idle clocks.
    $upd = mysqli_prepare($conn, "UPDATE user_tokens SET last_used_at = NOW() WHERE id = ?");
    mysqli_stmt_bind_param($upd, "i", $u['token_row_id']);
    mysqli_stmt_execute($upd);

    unset($u['last_used_at'], $u['token_row_id']);
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
