import { useState, useEffect, useCallback } from "react";
import { usePagination } from "./Pagination";
import { apiActivityLog } from "../api/api";
import Icon from "./Icon";

/* Badge color per action type */
const ACTION_STYLES = {
  "Created":        { background: "#dcfce7", color: "#16a34a" },
  "Updated":        { background: "#dbeafe", color: "#1D4ED8" },
  "Deleted":        { background: "#fee2e2", color: "#dc2626" },
  "Login":          { background: "#f3e8ff", color: "#7c3aed" },
  "Security":       { background: "#fef3c7", color: "#b45309" },
  "Password Reset": { background: "#ffedd5", color: "#c2410c" },
};

const MODULE_LABELS = {
  tourist_spots: "Tourist Spots", restaurants: "Restaurants", hotels: "Hotels",
  tourism_businesses: "Tourism Businesses", events: "Events", heritage_sites: "Heritage Sites",
  certificates: "Certificates", reviews: "Reviews", visits: "Visits",
  users: "User Management", rewards: "Rewards", auth: "Authentication",
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiActivityLog();
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load activity log.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).replace(" ", "T"));
    return isNaN(dt) ? d : dt.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
    });
  };

  const actions = ["All", ...Array.from(new Set(logs.map(l => l.action)))];

  const filtered = logs.filter(l => {
    if (actionFilter !== "All" && l.action !== actionFilter) return false;
    return [l.username, l.role, l.action, l.target, l.details]
      .join(" ").toLowerCase().includes(search.toLowerCase());
  });


  const { pageItems, pagination } = usePagination(filtered, 25);

  const badge = (a) => ({ ...badgeBase, ...(ACTION_STYLES[a] || { background: "#f1f5f9", color: "#475569" }) });

  return (
    <>
      {/* BREADCRUMB */}
      <div style={breadcrumb}>
        <span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Activity Log</span>
      </div>

      {/* HEADER */}
      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="file" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Activity Log</h1>
          <p style={pageSub}>Audit trail of all administrator actions — sign-ins, changes, approvals, and security events.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>Loading activity…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626", padding: 40 }}>
          {err}
          <div><button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div>
        </div>
      ) : (
      <div style={card}>
        {/* FILTERS */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
          <div style={searchBox} className="tc-search">
            <span style={{ color: "#94a3b8", display: "inline-flex" }}><Icon name="search" size={16} /></span>
            <input style={searchInput} className="tc-input" placeholder="Search user, action, details..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select style={select} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            {actions.map(a => <option key={a} value={a}>{a === "All" ? "All actions" : a}</option>)}
          </select>
          <button style={refreshBtn} className="tc-btn tc-btn-primary" onClick={load}>Refresh</button>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px 0" }}>
            No activity recorded yet. Admin actions will appear here automatically.
          </div>
        ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle} className="tc-table">
            <thead>
              <tr>
                <th style={thStyle}>DATE & TIME</th>
                <th style={thStyle}>ADMIN</th>
                <th style={thStyle}>ACTION</th>
                <th style={thStyle}>MODULE</th>
                <th style={thStyle}>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((l) => (
                <tr key={l.id}>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#6b7280" }}>{fmtDate(l.created_at)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>
                    {l.username}
                    <div style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 400 }}>{l.role}</div>
                  </td>
                  <td style={tdStyle}><span style={badge(l.action)}>{l.action}</span></td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{MODULE_LABELS[l.target] || l.target || "—"}</td>
                  <td style={{ ...tdStyle, maxWidth: 420 }}>{l.details}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={5}>No matching entries.</td></tr>
              )}
            </tbody>
          </table>
        {pagination}
        </div>
        )}
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
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };

const card = { background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", marginBottom: "20px" };

const searchBox = { display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px", flex: 1, minWidth: 220, maxWidth: 420 };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const select = { padding: "10px 12px", borderRadius: 10, border: "1px solid #e6ecf5", background: "#F7FAFF", fontSize: 14, color: "#374151", cursor: "pointer" };
const refreshBtn = { padding: "10px 16px", borderRadius: 10, border: "none", background: "#1D4ED8", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const retryBtn = { marginTop: 10, padding: "8px 16px", borderRadius: 8, border: "none", background: "#1D4ED8", color: "#fff", fontSize: 14, cursor: "pointer" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };
const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block", whiteSpace: "nowrap" };
