import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./ConfirmDialog";
import { apiList, apiUpdate } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

export default function RewardsAdmin() {
  const [confirm, ConfirmUI] = useConfirm();
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState({}); // id -> username
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rw, us] = await Promise.all([apiList("rewards"), apiList("users").catch(() => [])]);
      setRewards(Array.isArray(rw) ? rw : []);
      const map = {};
      (Array.isArray(us) ? us : []).forEach(u => { map[u.id] = u.username; });
      setUsers(map);
    } catch (e) {
      setErr(e.message || "Failed to load rewards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmt = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).replace(" ", "T"));
    return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const markClaimed = async (r) => {
    if (!(await confirm({
      title: "Mark reward as claimed?",
      message: `Release the Heritage Mug for code "${r.code}" to ${users[r.user_id] || "this tourist"}. This confirms the reward was handed over.`,
      confirmLabel: "Mark as claimed",
      tone: "primary",
    }))) return;
    setBusyId(r.id);
    try {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await apiUpdate("rewards", r.id, { status: "Claimed", claimed_at: now });
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to update.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = rewards.filter(r =>
    [users[r.user_id], r.code, r.status, r.reward].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const counts = {
    total: rewards.length,
    unclaimed: rewards.filter(r => r.status === "Unclaimed").length,
    claimed: rewards.filter(r => r.status === "Claimed").length,
  };

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Rewards</span>
      </div>

      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="gift" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Trail Rewards</h1>
          <p style={pageSub}>Verify and release the Mandaluyong Heritage Mug to tourists who completed the trail.</p>
        </div>
      </div>

      <div style={kpiGrid} className="tc-stagger">
        <div style={kpiCard}><div style={kpiLabel}>Total Rewards</div><div style={kpiValue}>{counts.total}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>To Release</div><div style={{ ...kpiValue, color: "#b45309" }}>{counts.unclaimed}</div></div>
        <div style={kpiCard}><div style={kpiLabel}>Claimed</div><div style={{ ...kpiValue, color: "#16a34a" }}>{counts.claimed}</div></div>
      </div>

      <div style={card}>
        <div style={{ marginBottom: 16 }}>
          <div style={searchBox} className="tc-search">
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} className="tc-input" placeholder="Search by tourist, code, status..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading rewards…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>{err}<div><button style={claimBtn} onClick={load}>Retry</button></div></div>
        ) : (
        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}>TOURIST</th>
              <th style={thStyle}>REWARD</th>
              <th style={thStyle}>CLAIM CODE</th>
              <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
              <th style={thStyle}>EARNED</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>{users[r.user_id] || `User #${r.user_id}`}</td>
                <td style={tdStyle}>{r.reward}</td>
                <td style={{ ...tdStyle, fontFamily: "monospace", fontWeight: 700, color: "#7c2d12" }}>{r.code}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={r.status === "Claimed" ? badgeGreen : badgeAmber}>{r.status}</span>
                </td>
                <td style={tdStyle}>{fmt(r.created_at)}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {r.status === "Unclaimed" ? (
                    <button style={claimBtn} onClick={() => markClaimed(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? "…" : "✓ Mark Claimed"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 13, color: "#16a34a" }}>Released {fmt(r.claimed_at)}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No rewards yet. They will appear here once a tourist completes the entire Heritage Trail.</td></tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    {ConfirmUI}
    </>
  );
}

/* ================= STYLES ================= */
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const pageHeader = { display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#ea580c", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" };
const kpiCard = { background: "#fff", padding: "18px", borderRadius: "14px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const kpiLabel = { fontSize: 13, color: "#6b7280", marginBottom: 6 };
const kpiValue = { fontSize: 24, fontWeight: 700, color: "#0F172A" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const searchBox = { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };
const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const claimBtn = { background: "#ea580c", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
