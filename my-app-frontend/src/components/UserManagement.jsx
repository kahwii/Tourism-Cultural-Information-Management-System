import { useState, useEffect, useCallback } from "react";
import Avatar from "./Avatar";
import { usePagination } from "./Pagination";
import { useConfirm } from "./ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { apiList, apiUpdate, apiRemove, apiAdminCreateUser, apiAdminResetPassword } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";
import { pwChecks, pwValid, pwStrength } from "../utils/password";

const ROLES = ["Super Admin", "CCAT Admin", "CCAT Staff", "Establishment", "Tourist"];

const ROLE_STYLE = {
  "Super Admin":   { background: "#ede9fe", color: "#6d28d9" },
  "CCAT Admin":    { background: "#dbeafe", color: "#1D4ED8" },
  "CCAT Staff":    { background: "#cffafe", color: "#0e7490" },
  "Establishment": { background: "#fef3c7", color: "#b45309" },
  "Tourist":       { background: "#dcfce7", color: "#16a34a" }
};

const EMPTY_FORM = { username: "", email: "", role: "CCAT Staff", status: "Active", password: "" };

export default function UserManagement() {
  const { user: me } = useAuth();
  const [confirm, ConfirmUI] = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetUser, setResetUser] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).replace(" ", "T"));
    return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const filtered = users.filter(u => {
    const matchSearch = [u.username, u.email, u.role].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });


  const { pageItems, pagination } = usePagination(filtered, 25);

  const counts = {
    total: users.length,
    active: users.filter(u => u.status === "Active").length,
    admins: users.filter(u => u.role === "Super Admin" || u.role === "CCAT Admin").length,
    establishments: users.filter(u => u.role === "Establishment").length
  };

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({ username: u.username || "", email: u.email || "", role: u.role, status: u.status, password: "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.username.trim()) { toast.error("Please enter a username."); return; }
    if (!editingId && form.password.length < 6) { toast.error("Please set a password (min 6 characters)."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await apiUpdate("users", editingId, { username: form.username, email: form.email, role: form.role, status: form.status });
      } else {
        await apiAdminCreateUser({ username: form.username, email: form.email, role: form.role, status: form.status, password: form.password });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    try {
      await apiUpdate("users", u.id, { status: u.status === "Active" ? "Inactive" : "Active" });
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to update status.");
    }
  };

  const doReset = async () => {
    if (!pwValid(resetPw)) { toast.error("Password does not meet the security requirements."); return; }
    setResetting(true);
    try {
      await apiAdminResetPassword(resetUser.id, resetPw);
      toast.success(`Password reset for "${resetUser.username}".`);
      setResetUser(null); setResetPw("");
    } catch (e) {
      toast.error(e.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  const remove = async (u) => {
    if (String(u.id) === String(me?.id)) { toast.error("You cannot delete your own account."); return; }
    if (!(await confirm({
      title: "Delete this account?",
      message: `The account "${u.username}" will be permanently removed and will no longer be able to sign in.`,
      confirmLabel: "Delete account",
    }))) return;
    try {
      await apiRemove("users", u.id);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete user.");
    }
  };

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>User Management</span>
      </div>

      <div style={headerRow}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={headerIcon} className="tc-page-icon"><Icon name="users" size={26} /></div>
          <div>
            <h1 style={pageTitle}>User Management</h1>
            <p style={pageSub}>Manage system accounts, roles, and access permissions.</p>
          </div>
        </div>
        <button style={addBtn} className="tc-btn tc-btn-primary" onClick={openAdd}>+ Add User</button>
      </div>

      {/* SUMMARY */}
      <div style={kpiGrid} className="tc-stagger">
        <div style={kpiCard}><div style={kpiLabel}>Total Users</div><div style={kpiValue}>{counts.total}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Active</div><div style={{ ...kpiValue, color: "#16a34a" }}>{counts.active}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Admins</div><div style={kpiValue}>{counts.admins}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Establishments</div><div style={kpiValue}>{counts.establishments}</div></div>
      </div>

      <div style={card}>
        <div style={cardToolbar}>
          <div style={searchBox} className="tc-search">
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} className="tc-input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select style={select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading users…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>{err}<div><button style={addBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div></div>
        ) : (
        <>
        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}>USERNAME</th>
              <th style={thStyle}>EMAIL</th>
              <th style={thStyle}>ROLE</th>
              <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
              <th style={thStyle}>LAST LOGIN</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((u) => (
              <tr key={u.id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar user={u} size={32} />
                    <span>{u.username}{String(u.id) === String(me?.id) && <span style={youTag}>you</span>}</span>
                  </span>
                </td>
                <td style={tdStyle}>{u.email || "—"}</td>
                <td style={tdStyle}><span style={{ ...badgeBase, ...(ROLE_STYLE[u.role] || {}) }}>{u.role}</span></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={u.status === "Active" ? badgeActive : badgeInactive}>{u.status}</span>
                </td>
                <td style={tdStyle}>{fmtDate(u.last_login)}</td>
                <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button style={editBtn} className="tc-btn" title="Edit" onClick={() => openEdit(u)}>Edit</button>
                  <button style={resetBtn} className="tc-btn" title="Reset password" onClick={() => { setResetUser(u); setResetPw(""); }}>Reset PW</button>
                  <button style={u.status === "Active" ? delBtn : editBtn} onClick={() => toggleStatus(u)}>
                    {u.status === "Active" ? "Deactivate" : "Activate"}
                  </button>
                  {String(u.id) !== String(me?.id) && (
                    <button style={delBtn} className="tc-btn" title="Delete" onClick={() => remove(u)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No users found.</td></tr>
            )}
          </tbody>
        </table>
        {pagination}
        </>
        )}
      </div>

      {modalOpen && (
        <div className="tc-modal-backdrop tc-form-overlay" onClick={() => setModalOpen(false)}>
          <div className="tc-modal tc-form-modal tc-form-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="tc-form-header">
              <div className="tc-form-header-icon"><Icon name="users" size={20} /></div>
              <div className="tc-form-header-text">
                <h2 className="tc-form-title">{editingId ? "Edit User" : "Add User"}</h2>
                <p className="tc-form-subtitle">{editingId ? "Update this account's details." : "Create a new system account."}</p>
              </div>
              <button className="tc-form-close" onClick={() => setModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="tc-form-body">
              <div className="tc-form-section">
                <div className="tc-form-field">
                  <label className="tc-form-label">Username <span className="opt">(used for login)</span></label>
                  <input className="tc-form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Email</label>
                  <input className="tc-form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="tc-form-grid">
                  <div className="tc-form-field">
                    <label className="tc-form-label">Role</label>
                    <select className="tc-form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="tc-form-field">
                    <label className="tc-form-label">Status</label>
                    <select className="tc-form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {!editingId && (
                  <div className="tc-form-field">
                    <label className="tc-form-label">Temporary Password</label>
                    <input className="tc-form-input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters — give this to the staff" />
                    <p className="tc-form-hint">The new account signs in with this username + temporary password.</p>
                  </div>
                )}
                {editingId && (
                  <p className="tc-form-hint">Password changes are not done here (use a reset flow).</p>
                )}
              </div>
            </div>

            <div className="tc-form-footer">
              <button className="tc-btn tc-form-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="tc-btn tc-btn-primary tc-form-save" onClick={save} disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add User"}</button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD (admin-assisted) */}
      {resetUser && (
        <div className="tc-modal-backdrop tc-form-overlay" onClick={() => setResetUser(null)}>
          <div className="tc-modal tc-form-modal tc-form-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="tc-form-header">
              <div className="tc-form-header-icon"><Icon name="users" size={20} /></div>
              <div className="tc-form-header-text">
                <h2 className="tc-form-title">Reset Password</h2>
                <p className="tc-form-subtitle">Set a new password for <b>{resetUser.username}</b>. This also unlocks the account if it was locked.</p>
              </div>
              <button className="tc-form-close" onClick={() => setResetUser(null)} aria-label="Close">✕</button>
            </div>

            <div className="tc-form-body">
              <div className="tc-form-section">
                <div className="tc-form-field">
                  <label className="tc-form-label">New Password</label>
                  <input className="tc-form-input" type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Create a strong password" />
                </div>
                {resetPw && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: pwStrength(resetPw).pct + "%", background: pwStrength(resetPw).color, transition: "width .2s ease" }} />
                    </div>
                    {pwStrength(resetPw).label && <div style={{ fontSize: 12, fontWeight: 700, color: pwStrength(resetPw).color, marginBottom: 8 }}>{pwStrength(resetPw).label} password</div>}
                    {pwChecks(resetPw).map((c) => (
                      <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.ok ? "#16a34a" : "#9ca3af", marginBottom: 4 }}>
                        <span style={{ width: 14, textAlign: "center", fontWeight: 700 }}>{c.ok ? "✓" : "•"}</span>{c.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="tc-form-footer">
              <button className="tc-btn tc-form-cancel" onClick={() => setResetUser(null)} disabled={resetting}>Cancel</button>
              <button className="tc-btn tc-btn-primary tc-form-save" onClick={doReset} disabled={resetting}>{resetting ? "Resetting…" : "Reset Password"}</button>
            </div>
          </div>
        </div>
      )}
    {ConfirmUI}
    </>
  );
}

/* ================= STYLES ================= */
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };
const addBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 20px", fontSize: "15px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px", marginBottom: "24px" };
const kpiCard = { background: "#fff", padding: "18px", borderRadius: "14px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const kpiLabel = { fontSize: 13, color: "#6b7280", marginBottom: 6 };
const kpiValue = { fontSize: 24, fontWeight: 700, color: "#0F172A" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const cardToolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px", flexWrap: "wrap" };
const searchBox = { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const select = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "14px", cursor: "pointer", color: "#374151" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeActive = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeInactive = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
const iconAction = { background: "none", border: "none", cursor: "pointer", fontSize: "15px", margin: "0 3px" };
const editBtn = { background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };
const resetBtn = { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };
const delBtn = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };
const youTag = { marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#1D4ED8", background: "#dbeafe", padding: "2px 6px", borderRadius: 6, textTransform: "uppercase" };

