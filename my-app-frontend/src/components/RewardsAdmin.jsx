import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./ConfirmDialog";
import { apiList, apiUpdate, apiTrailProgress } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

export default function RewardsAdmin() {
  const [confirm, ConfirmUI] = useConfirm();
  const [rewards, setRewards] = useState([]);
  const [users, setUsers] = useState({}); // id -> username
  const [progress, setProgress] = useState(null); // trail_progress.php payload
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [progressSearch, setProgressSearch] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rw, us, pg] = await Promise.all([
        apiList("rewards"),
        apiList("users").catch(() => []),
        // Progress is supplementary — a failure here shouldn't blank out the
        // rewards table, which is the part staff act on.
        apiTrailProgress().catch(() => null),
      ]);
      setRewards(Array.isArray(rw) ? rw : []);
      setProgress(pg);
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

  const trailTotal = progress?.total ?? 0;
  const walkers = (progress?.tourists || []).filter(t =>
    [t.username, t.email, t.status].join(" ").toLowerCase().includes(progressSearch.toLowerCase())
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

      {/* ---------------- WHO IS WALKING THE TRAIL ----------------
          The table above only lists tourists who FINISHED. This one answers
          the question staff actually ask first: is anyone out there walking
          it, and how far have they got? */}
      <div style={{ ...card, marginTop: 24 }}>
        <div style={sectionHead}>
          <div>
            <h2 style={sectionTitle}>Trail Progress</h2>
            <p style={sectionSub}>
              Every tourist who has verified at least one stop, and how far along they are.
              Counted the same way the mug is awarded — GPS + photo check-ins only.
            </p>
          </div>
          {progress && (
            <div style={miniStats}>
              <span><b style={{ color: "#0F172A" }}>{progress.summary.walkers}</b> walking</span>
              <span><b style={{ color: "#16a34a" }}>{progress.summary.completed}</b> completed</span>
              <span><b style={{ color: "#b45309" }}>{progress.summary.in_progress}</b> in progress</span>
            </div>
          )}
        </div>

        {!progress ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
            {loading ? "Loading trail progress…" : "Trail progress is unavailable right now."}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={searchBox} className="tc-search">
                <span style={{ opacity: 0.5 }}></span>
                <input
                  style={searchInput} className="tc-input"
                  placeholder="Search by tourist or status..."
                  value={progressSearch} onChange={(e) => setProgressSearch(e.target.value)}
                />
              </div>
            </div>

            <table style={tableStyle} className="tc-table">
              <thead>
                <tr>
                  <th style={thStyle}>TOURIST</th>
                  <th style={{ ...thStyle, width: 220 }}>PROGRESS</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                  <th style={thStyle}>STARTED</th>
                  <th style={thStyle}>LAST CHECK-IN</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>MUG</th>
                </tr>
              </thead>
              <tbody>
                {walkers.map((t) => (
                  <tr key={t.user_id}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>
                      {t.username || t.email || `User #${t.user_id}`}
                      {/* Explore taps are not trail progress. Showing them
                          plainly stops "9 taps" being read as "9 stops". */}
                      {t.unverified > 0 && (
                        <div style={unverifiedNote}>
                          {t.unverified} unverified tap{t.unverified > 1 ? "s" : ""} (no GPS/photo — not counted)
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={barTrack}>
                          <div style={{
                            ...barFill,
                            width: trailTotal ? `${(t.done / trailTotal) * 100}%` : "0%",
                            background: t.done >= trailTotal ? "#16a34a" : "#1D4ED8",
                          }} />
                        </div>
                        <span style={{ fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>
                          {t.done} / {t.total}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={t.status === "Completed" ? badgeGreen : t.status === "In progress" ? badgeBlue : badgeGray}>
                        {t.status}
                      </span>
                    </td>
                    <td style={tdStyle}>{fmt(t.started)}</td>
                    <td style={tdStyle}>{fmt(t.last_check_in)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      {t.has_reward ? (
                        <span style={t.reward_status === "Claimed" ? badgeGreen : badgeAmber}>
                          {t.reward_status}
                        </span>
                      ) : t.status === "Completed" ? (
                        <span style={{ fontSize: 13, color: "#b45309" }}>Not issued yet</span>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {walkers.length === 0 && (
                  <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>
                    Nobody has verified a trail stop yet.
                  </td></tr>
                )}
              </tbody>
            </table>
          </>
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
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeGray = { ...badgeBase, background: "#f1f5f9", color: "#64748b" };

const sectionHead = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 };
const sectionTitle = { margin: 0, fontSize: 18, color: "#0F172A" };
const sectionSub = { margin: "4px 0 0", color: "#6b7280", fontSize: 13.5, maxWidth: 560 };
const miniStats = { display: "flex", gap: 16, fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" };
const barTrack = { flex: 1, minWidth: 90, height: 8, borderRadius: 999, background: "#eef2f8", overflow: "hidden" };
const barFill = { height: "100%", borderRadius: 999, transition: "width .3s ease" };
const unverifiedNote = { fontSize: 11.5, color: "#b45309", fontWeight: 500, marginTop: 3 };
const claimBtn = { background: "#ea580c", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
