// Roles that belong to the admin panel (TIMS/CHIMS management).
export const ADMIN_ROLES = ["admin", "Super Admin", "CCAT Admin", "CCAT Staff"];

export const isAdmin = (role) => ADMIN_ROLES.includes(role);

// Approver roles — the "checker" half of maker-checker. CCAT Staff are makers:
// they encode content, but account management, the audit trail, and publishing
// approvals stay with these roles.
// Keep in sync with is_approver_role() in my-app-backend/config/auth.php.
export const APPROVER_ROLES = ["Super Admin", "CCAT Admin", "admin"];

export const isApprover = (role) => APPROVER_ROLES.includes(role);

// Establishment accounts (businesses applying for accreditation).
export const isEstablishment = (role) => role === "Establishment";
