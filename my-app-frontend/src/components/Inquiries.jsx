import { useState, useEffect, useCallback } from "react";
import { usePagination } from "./Pagination";
import { apiInquiries, apiInquiryReply } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

/*
  Admin view of the visitor inquiries submitted from the public events page.
  Replying emails the visitor and marks the inquiry Answered.
*/

const fmtWhen = (d) => {
  if (!d) return "—";
  const dt = new Date(String(d).replace(" ", "T"));
  return isNaN(dt) ? d : dt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function Inquiries() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Open"); // "Open" | "Answered" | "All"
  const [catFilter, setCatFilter] = useState("All");
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiInquiries();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load inquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows
    .filter((r) => (filter === "All" ? true : r.status === filter))
    .filter((r) => (catFilter === "All" ? true : (r.category || "General Inquiry") === catFilter))
    .filter((r) => [r.name, r.email, r.subject, r.category, r.message].join(" ").toLowerCase().includes(search.toLowerCase()));

  // Which topics visitors actually ask about — the reportable output of
  // categorising inquiries. Counted over everything, not the current filter.
  const byCategory = (() => {
    const map = {};
    rows.forEach((r) => {
      const c = r.category || "General Inquiry";
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  })();

  const { pageItems, pagination } = usePagination(filtered, 25);

  const openInquiry = (r) => { setOpen(r); setReply(r.reply || ""); };
  const closeInquiry = () => { setOpen(null); setReply(""); };

  const sendReply = async () => {
    if (!reply.trim()) { toast.error("Please write a reply."); return; }
    setSending(true);
    try {
      const res = await apiInquiryReply(open.id, reply.trim());
      await load();
      if (res.emailed) toast.success(res.message || "Reply sent.");
      else toast.info(res.message || "Reply saved, but the email could not be sent.");
      closeInquiry();
    } catch (e) {
      toast.error(e.message || "Failed to send the reply.");
    } finally {
      setSending(false);
    }
  };

  const openCount = rows.filter((r) => r.status === "Open").length;

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Visitor Inquiries</span>
      </div>

      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="message" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Visitor Inquiries</h1>
          <p style={pageSub}>
            Questions sent from the public events page.
            {openCount > 0 ? ` ${openCount} awaiting a reply.` : " All caught up."}
          </p>
        </div>
      </div>

      {/* Topic breakdown — doubles as a quick filter */}
      {byCategory.length > 0 && (
        <div style={catStrip}>
          <button
            style={{ ...catChip, ...(catFilter === "All" ? catChipActive : {}) }}
            onClick={() => setCatFilter("All")}
          >All topics <b>{rows.length}</b></button>
          {byCategory.map(([c, n]) => (
            <button
              key={c}
              style={{ ...catChip, ...(catFilter === c ? catChipActive : {}) }}
              onClick={() => setCatFilter(catFilter === c ? "All" : c)}
            >{c} <b>{n}</b></button>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={toolbar}>
          <div style={searchBox} className="tc-search">
            <input style={searchInput} className="tc-input" placeholder="Search inquiries..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={filterWrap}>
            {["Open", "Answered", "All"].map((f) => (
              <button
                key={f}
                style={{ ...filterItem, ...(filter === f ? filterActive : {}) }}
                onClick={() => setFilter(f)}
              >{f}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading inquiries…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
            {err}
            <div><button style={primaryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div>
          </div>
        ) : (
          <>
            <table style={tableStyle} className="tc-table">
              <thead>
                <tr>
                  <th style={thStyle}>FROM</th>
                  <th style={thStyle}>SUBJECT</th>
                  <th style={thStyle}>RECEIVED</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, maxWidth: 230 }}>
                      <div style={{ fontWeight: 600, color: "#0F172A", overflowWrap: "anywhere" }}>{r.name}</div>
                      <div style={{ fontSize: 12.5, color: "#6b7280", overflowWrap: "anywhere" }}>{r.email}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
                        {r.ref_no && <span style={{ fontSize: 11.5, color: "#1D4ED8", fontWeight: 700 }}>{r.ref_no}</span>}
                        {r.category && <span style={catTag}>{r.category}</span>}
                      </div>
                      <div>{r.subject || <span style={{ color: "#9ca3af" }}>(no subject)</span>}</div>
                      <div style={{ fontSize: 12.5, color: "#9ca3af", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.message}
                      </div>
                    </td>
                    <td style={tdStyle}>{fmtWhen(r.created_at)}</td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={r.status === "Answered" ? badgeGreen : badgeAmber}>{r.status}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                      <button style={linkBtn} className="tc-btn" onClick={() => openInquiry(r)}>
                        {r.status === "Answered" ? "View" : "Reply"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={5}>No inquiries found.</td></tr>
                )}
              </tbody>
            </table>
            {pagination}
          </>
        )}
      </div>

      {open && (
        <div style={overlay} className="tc-modal-backdrop" onClick={closeInquiry}>
          <div style={modal} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div style={modalTop}>
              <span style={{ fontWeight: 700, fontSize: 19 }}>
                Visitor Inquiry
                {open.ref_no && <span style={refChip}>{open.ref_no}</span>}
              </span>
              <button style={closeBtn} className="tc-btn" onClick={closeInquiry}>✕</button>
            </div>

            <div style={{ padding: 22 }}>
              {/* Long email addresses used to overrun the next column, so each
                  field gets its own grid cell with wrapping enabled. */}
              <div style={infoGrid}>
                <div style={infoCell}><div style={infoLabel}>From</div><div style={infoValue}>{open.name}</div></div>
                <div style={infoCell}>
                  <div style={infoLabel}>Email</div>
                  <a href={`mailto:${open.email}`} style={{ ...infoValue, color: "#1D4ED8", textDecoration: "none" }}>{open.email}</a>
                </div>
                <div style={infoCell}><div style={infoLabel}>Received</div><div style={infoValue}>{fmtWhen(open.created_at)}</div></div>
                <div style={infoCell}><div style={infoLabel}>Category</div><div style={infoValue}>{open.category || "General Inquiry"}</div></div>
              </div>

              <div style={infoLabel}>Subject</div>
              <div style={{ ...infoValue, marginBottom: 16 }}>{open.subject || <span style={{ color: "#9ca3af", fontWeight: 400 }}>(no subject)</span>}</div>

              <div style={infoLabel}>Message</div>
              <div style={messageBox}>{open.message}</div>

              {open.status === "Answered" ? (
                <>
                  <div style={{ ...infoLabel, marginTop: 16 }}>Your reply · sent {fmtWhen(open.answered_at)}</div>
                  <div style={{ ...messageBox, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>{open.reply}</div>
                </>
              ) : (
                <>
                  <div style={{ ...infoLabel, marginTop: 16 }}>Your Reply</div>
                  <textarea
                    style={textarea}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply — this will be emailed to the visitor…"
                  />
                  <p style={{ fontSize: 12, color: "#9ca3af", margin: "6px 2px 0" }}>
                    The visitor's original message is included automatically in the email.
                  </p>
                </>
              )}
            </div>

            <div style={modalFooter}>
              {open.status === "Answered" ? (
                <button style={cancelBtn} className="tc-btn" onClick={closeInquiry}>Close</button>
              ) : (
                <>
                  <button style={cancelBtn} className="tc-btn" onClick={closeInquiry} disabled={sending}>Cancel</button>
                  <button style={primaryBtn} className="tc-btn tc-btn-primary" onClick={sendReply} disabled={sending}>
                    {sending ? "Sending…" : "Send Reply"}
                  </button>
                </>
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
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };

const catStrip = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 };
const catChip = { background: "#fff", border: "1px solid #e6ecf5", borderRadius: 999, padding: "8px 15px", fontSize: 13, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" };
const catChipActive = { background: "#EFF5FF", borderColor: "#bfdbfe", color: "#1D4ED8", fontWeight: 600 };
const catTag = { background: "#f1f5f9", color: "#475569", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 600 };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", overflowX: "auto" };
const toolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" };
const searchBox = { flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const filterWrap = { display: "inline-flex", background: "#fff", border: "1px solid #e6ecf5", borderRadius: 10, padding: 4, gap: 4 };
const filterItem = { border: "none", background: "transparent", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: "#374151" };
const filterActive = { background: "#EFF5FF", color: "#1D4ED8", fontWeight: 600 };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8", whiteSpace: "nowrap" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151", verticalAlign: "top" };

const badgeBase = { padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, display: "inline-block" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#1D4ED8" };

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const modal = { background: "#fff", borderRadius: 16, width: 640, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const modalTop = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #eef2f8" };
const closeBtn = { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#6b7280" };
const refChip = { marginLeft: 10, background: "#EFF5FF", border: "1px solid #DBE7FF", color: "#1D4ED8", borderRadius: 999, padding: "3px 11px", fontSize: 12, fontWeight: 700, letterSpacing: ".3px", verticalAlign: "middle" };
const infoGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 18 };
const infoCell = { minWidth: 0, background: "#F7FAFF", border: "1px solid #eef2f8", borderRadius: 10, padding: "10px 13px" };
const infoLabel = { fontSize: 12, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".4px", fontWeight: 600 };
// overflowWrap keeps long addresses inside their own cell instead of bleeding
// across the column next to them.
const infoValue = { fontSize: 14.5, fontWeight: 600, color: "#0F172A", overflowWrap: "anywhere", lineHeight: 1.45, display: "block" };
const messageBox = { background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: 10, padding: "13px 15px", fontSize: 14, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
const textarea = { width: "100%", minHeight: 120, padding: "11px 13px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" };
const modalFooter = { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px", borderTop: "1px solid #eef2f8" };
const cancelBtn = { background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" };
const primaryBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" };
