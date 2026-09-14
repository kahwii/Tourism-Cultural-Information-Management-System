import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { apiReportsList, apiReportRespond } from "../api/api";
import { toast } from "../utils/toast";
import { usePagination } from "./Pagination";
import Icon from "./Icon";

/*
  Staff operations reports filed from the mobile app.

  Kept separate from Visitor Inquiries on purpose. Inquiries are questions
  from the public that CCAT answers by email; these are internal reports from
  CCAT's own field staff, and the answer has to come back INSIDE the app —
  which is the thing the inquiries route could not do.

  Reading is split along maker-checker rather than "is this an admin": CCAT
  Staff counts as an admin role in this system, so approvers (Super Admin /
  CCAT Admin) see and answer everything, while a staff member sees only their
  own thread. The server enforces this; the page just reflects it.
*/
export default function StaffReports() {
  const { user } = useAuth();
  const isApprover = ["Super Admin", "CCAT Admin", "admin"].includes(user?.role);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All"); // All | New | Read | Replied
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const d = await apiReportsList();
      setRows(Array.isArray(d) ? d : []);
    } catch (e) {
      setErr(e.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).replace(" ", "T") + "Z"); // stored UTC
    return isNaN(dt) ? d : dt.toLocaleString("en-PH", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  const filtered = rows
    .filter(r => filter === "All" ? true : r.status === filter)
    .filter(r => [r.subject, r.body, r.filed_by, r.filed_by_email].join(" ").toLowerCase()
      .includes(search.toLowerCase()));

  const { pageItems, pagination } = usePagination(filtered, 15);

  const counts = {
    total: rows.length,
    unread: rows.filter(r => r.status === "New").length,
    replied: rows.filter(r => r.status === "Replied").length,
  };

  // Opening a report marks it Read, so "New" means genuinely unseen.
  const openReport = async (r) => {
    setOpen(r);
    setReply(r.admin_reply || "");
    if (isApprover && r.status === "New") {
      try {
        const updated = await apiReportRespond(r.id, { status: "Read" });
        if (updated) setRows(list => list.map(x => (x.id === updated.id ? updated : x)));
      } catch { /* cosmetic only — never block reading the report */ }
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) { toast.error("Please write a reply first."); return; }
    setSending(true);
    try {
      const updated = await apiReportRespond(open.id, { admin_reply: reply.trim() });
      setRows(list => list.map(x => (x.id === updated.id ? updated : x)));
      setOpen(updated);
      toast.success("Reply sent — the staff member will see it in the app.");
    } catch (e) {
      toast.error(e.message || "Failed to send the reply.");
    } finally {
      setSending(false);
    }
  };

  const badgeFor = (s) => s === "Replied" ? badgeGreen : s === "Read" ? badgeGray : badgeAmber;

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Staff Reports</span>
      </div>

      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="file" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Staff Reports</h1>
          <p style={pageSub}>
            {isApprover
              ? "Operations reports filed by CCAT staff from the mobile app. Your reply appears in their app."
              : "Reports you have filed from the mobile app, and the office's replies."}
          </p>
        </div>
      </div>

      <div style={kpiGrid} className="tc-stagger">
        <div style={kpiCard}><div style={kpiLabel}>Total Reports</div><div style={kpiValue}>{counts.total}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Unread</div><div style={{ ...kpiValue, color: "#b45309" }}>{counts.unread}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Replied</div><div style={{ ...kpiValue, color: "#16a34a" }}>{counts.replied}</div></div>
      </div>

      <div style={card}>
        <div style={toolbar}>
          <div style={searchBox} className="tc-search">
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} className="tc-input" placeholder="Search by subject, content, or staff..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={chipRow}>
            {["All", "New", "Read", "Replied"].map(s => (
              <button key={s} style={{ ...chip, ...(filter === s ? chipActive : {}) }}
                onClick={() => setFilter(s)}>{s}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={stateBox}>Loading reports…</div>
        ) : err ? (
          <div style={{ ...stateBox, color: "#dc2626" }}>{err}</div>
        ) : (
          <>
            <table style={tableStyle} className="tc-table">
              <thead>
                <tr>
                  <th style={thStyle}>SUBJECT</th>
                  {isApprover && <th style={thStyle}>FILED BY</th>}
                  <th style={thStyle}>RECEIVED</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A", maxWidth: 340 }}>
                      {r.subject}
                      <div style={preview}>{(r.body || "").slice(0, 90)}…</div>
                    </td>
                    {isApprover && (
                      <td style={tdStyle}>{r.filed_by || r.filed_by_email || `User #${r.user_id}`}</td>
                    )}
                    <td style={tdStyle}>{fmt(r.created_at)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={badgeFor(r.status)}>{r.status}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <button style={openBtn} className="tc-btn" onClick={() => openReport(r)}>
                        {isApprover ? (r.status === "Replied" ? "View" : "Open & reply") : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={isApprover ? 5 : 4}>
                    No reports yet. They appear here when CCAT staff file one from the mobile app.
                  </td></tr>
                )}
              </tbody>
            </table>
            {pagination}
          </>
        )}
      </div>

      {open && (
        <div className="tc-modal-backdrop tc-form-overlay" onClick={() => setOpen(null)}>
          <div className="tc-modal tc-form-modal tc-form-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="tc-form-header">
              <div className="tc-form-header-icon"><Icon name="file" size={20} /></div>
              <div className="tc-form-header-text">
                <h2 className="tc-form-title">{open.subject}</h2>
                <p className="tc-form-subtitle">
                  {(open.filed_by || open.filed_by_email || `User #${open.user_id}`)} · {fmt(open.created_at)}
                </p>
              </div>
              <button className="tc-form-close" onClick={() => setOpen(null)} aria-label="Close">✕</button>
            </div>

            <div className="tc-form-body">
              <div className="tc-form-section">
                <div className="tc-form-section-title">Report</div>
                <pre style={bodyBox}>{open.body}</pre>
              </div>

              {open.admin_reply && (
                <div className="tc-form-section">
                  <div className="tc-form-section-title">Reply sent</div>
                  <div style={replyBox}>{open.admin_reply}</div>
                  <p className="tc-form-hint">
                    {open.replied_by_name ? `Answered by ${open.replied_by_name}` : "Answered"} · {fmt(open.replied_at)}
                  </p>
                </div>
              )}

              {isApprover && (
                <div className="tc-form-section">
                  <div className="tc-form-section-title">{open.admin_reply ? "Update reply" : "Reply"}</div>
                  <p className="tc-form-section-hint">
                    This goes back to the staff member inside the app — not by email.
                  </p>
                  <textarea className="tc-form-textarea" style={{ minHeight: 120 }}
                    value={reply} onChange={(e) => setReply(e.target.value)}
                    placeholder="Write your response to this report…" />
                </div>
              )}
            </div>

            <div className="tc-form-footer">
              <button className="tc-btn tc-form-cancel" onClick={() => setOpen(null)}>Close</button>
              {isApprover && (
                <button className="tc-btn tc-btn-primary tc-form-save" onClick={sendReply} disabled={sending}>
                  {sending ? "Sending…" : open.admin_reply ? "Update reply" : "Send reply"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= STYLES ================= */
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const pageHeader = { display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px", maxWidth: 640 };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" };
const kpiCard = { background: "#fff", padding: "18px", borderRadius: "14px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const kpiLabel = { fontSize: 13, color: "#6b7280", marginBottom: 6 };
const kpiValue = { fontSize: 24, fontWeight: 700, color: "#0F172A" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const toolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 };
const searchBox = { flex: 1, minWidth: 240, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const chipRow = { display: "flex", gap: 6, flexWrap: "wrap" };
const chip = { border: "1px solid #e6ecf5", background: "#fff", color: "#475569", borderRadius: 999, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chipActive = { background: "#EFF5FF", color: "#1D4ED8", borderColor: "#bfdbfe" };

const stateBox = { padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "15px" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151", verticalAlign: "top" };
const preview = { fontSize: 12.5, color: "#94a3b8", fontWeight: 400, marginTop: 4, lineHeight: 1.4 };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const badgeGray = { ...badgeBase, background: "#f1f5f9", color: "#64748b" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const openBtn = { background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

const bodyBox = { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6, color: "#334155", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: 12, padding: "14px 16px", maxHeight: 320, overflowY: "auto" };
const replyBox = { whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 13.5, lineHeight: 1.6, color: "#14532d", background: "#F0FDF4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 16px" };
