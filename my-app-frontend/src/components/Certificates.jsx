import { useState, useEffect, useCallback } from "react";
import { usePagination } from "./Pagination";
import { useConfirm } from "./ConfirmDialog";
import { apiList, apiUpdate, apiRemove, apiCertDocs, apiNotifyPickup, apiCheckPickupReminders, fileUrl } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

// DB row (snake_case) -> UI record (camelCase)
const toUi = (r) => ({
  id: r.id,
  establishment: r.establishment ?? "",
  type: r.type ?? "",
  permitNo: r.business_permit_no || "—",
  applicant: r.applicant ?? "",
  contact: r.contact ?? "",
  address: r.address ?? "",
  submitted: r.submitted_date ?? "",
  status: r.status ?? "Under Review",
  controlNo: r.control_no || "—",
  businessAccountNo: r.business_account_no || "—",
  orNo: r.or_no || "—",
  issued: r.issued || "—",
  expiry: r.expiry || "—",
  pickupDeadline: r.pickup_deadline || null,
  pickedUpAt: r.picked_up_at || null,
  lastReminderSent: r.last_reminder_sent ? Number(r.last_reminder_sent) : 0,
  remarks: r.remarks ?? "",
  documents: (() => { try { return r.documents ? JSON.parse(r.documents) : []; } catch { return []; } })(),
});

export default function Certificates() {
  const [confirm, ConfirmUI] = useConfirm();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [reviewDocs, setReviewDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("certificates");
      setApps((Array.isArray(data) ? data : []).map(toUi));
    } catch (e) {
      setErr(e.message || "Failed to load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Best-effort, silent: send any due 30/60/90-day unclaimed-pickup
    // reminders whenever an admin opens this page. Errors are ignored —
    // this should never block or interrupt normal use of the page.
    apiCheckPickupReminders().then((r) => {
      if (r?.reminders_sent) load();
    }).catch(() => {});
  }, [load]);

  const filtered = apps.filter(a =>
    [a.establishment, a.type, a.applicant, a.status].join(" ").toLowerCase().includes(search.toLowerCase())
  );


  const { pageItems, pagination } = usePagination(filtered, 25);

  const openReview = async (a) => {
    setReviewing(a); setRemarks(a.remarks || "");
    setReviewDocs([]); setDocsLoading(true);
    try {
      const docs = await apiCertDocs(a.id);
      setReviewDocs(Array.isArray(docs) ? docs : []);
    } catch { setReviewDocs([]); }
    finally { setDocsLoading(false); }
  };
  const closeReview = () => { setReviewing(null); setReviewDocs([]); };

  const pad = (n, len) => String(n).padStart(len, "0");
  const genNumbers = () => {
    const year = new Date().getFullYear();
    const seq = apps.filter(a => a.controlNo && a.controlNo !== "—").length + 1;
    return {
      controlNo: `${year}-${pad(seq, 5)}`,
      businessAccountNo: `MC${year}${pad(seq, 5)}`,
      orNo: String(5480000 + Math.floor(Math.random() * 9999)),
      issued: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      expiry: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); })()
    };
  };

  const approve = async () => {
    const nums = reviewing.controlNo !== "—"
      ? { controlNo: reviewing.controlNo, businessAccountNo: reviewing.businessAccountNo, orNo: reviewing.orNo, issued: reviewing.issued, expiry: reviewing.expiry }
      : genNumbers();
    const payload = {
      status: "Approved",
      control_no: nums.controlNo,
      business_account_no: nums.businessAccountNo,
      or_no: nums.orNo,
      issued: nums.issued,
      expiry: nums.expiry,
      remarks,
    };
    setBusy(true);
    try {
      await apiUpdate("certificates", reviewing.id, payload);
      // notify the establishment: certificate is ready for pick up at the office
      let note = "";
      try {
        const n = await apiNotifyPickup(reviewing.id);
        note = n.emailed ? ` Pickup notice emailed to ${n.email}.` : " Pickup notice posted on their dashboard.";
      } catch { note = " Pickup notice posted on their dashboard."; }
      await load();
      toast.success(`Approved! ${reviewing.establishment}'s certificate is ready for pick up.${note}`);
      closeReview();
    } catch (e) {
      toast.error(e.message || "Failed to approve.");
    } finally {
      setBusy(false);
    }
  };

  const deleteApp = async (a) => {
    if (!(await confirm({
      title: "Delete this application?",
      message: `The accreditation application of "${a.establishment}" will be permanently removed, along with its uploaded documents.`,
      confirmLabel: "Delete application",
    }))) return;
    setBusy(true);
    try {
      await apiRemove("certificates", a.id);
      await load();
      toast.success(`Application of ${a.establishment} deleted.`);
    } catch (e) {
      toast.error(e.message || "Failed to delete application.");
    } finally {
      setBusy(false);
    }
  };

  const resendNotice = async (a) => {
    setBusy(true);
    try {
      const n = await apiNotifyPickup(a.id);
      if (n.emailed) toast.success(`Pickup notice emailed to ${n.email}.`);
      else toast.info(n.message || "Notice posted on the establishment's dashboard.");
    } catch (e) {
      toast.error(e.message || "Failed to send notice.");
    } finally {
      setBusy(false);
    }
  };
  const markPickedUp = async (a) => {
    if (!(await confirm({
      title: "Mark certificate as picked up?",
      message: `Confirm that "${a.establishment}" has physically claimed their Certificate of Registration. This stops any further pickup reminders.`,
      confirmLabel: "Mark as picked up",
    }))) return;
    setBusy(true);
    try {
      const now = new Date().toISOString().slice(0, 19).replace("T", " ");
      await apiUpdate("certificates", a.id, { picked_up_at: now });
      await load();
      toast.success(`${a.establishment}'s certificate marked as picked up.`);
      if (reviewing && reviewing.id === a.id) closeReview();
    } catch (e) {
      toast.error(e.message || "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await apiUpdate("certificates", reviewing.id, { status: "Rejected", remarks });
      await load();
      toast.info(`Notification sent to ${reviewing.establishment}: application rejected.`);
      closeReview();
    } catch (e) {
      toast.error(e.message || "Failed to reject.");
    } finally {
      setBusy(false);
    }
  };

  const statusStyle = (s) => s === "Approved" ? badgeGreen : s === "Rejected" ? badgeRed : badgeBlue;
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const pickupStatus = (a) => {
    if (a.status !== "Approved") return null;
    if (a.pickedUpAt) return { label: `Picked up ${fmtDate(a.pickedUpAt)}`, tone: "green" };
    if (a.pickupDeadline && new Date(a.pickupDeadline) < new Date()) return { label: `Overdue — deadline was ${fmtDate(a.pickupDeadline)}`, tone: "red" };
    if (a.lastReminderSent >= 60) return { label: `Awaiting pickup (60-day reminder sent)`, tone: "amber" };
    if (a.lastReminderSent >= 30) return { label: `Awaiting pickup (30-day reminder sent)`, tone: "amber" };
    if (a.pickupDeadline) return { label: `Awaiting pickup — claim by ${fmtDate(a.pickupDeadline)}`, tone: "blue" };
    return { label: "Awaiting pickup", tone: "blue" };
  };

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Certificates</span>
      </div>

      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="file" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Tourism Certificates</h1>
          <p style={pageSub}>Review and manage establishment accreditations.</p>
        </div>
      </div>

      <div style={card}>
        <div style={searchBox} className="tc-search">
          <span style={{ opacity: 0.5 }}></span>
          <input style={searchInput} className="tc-input" placeholder="Search applications..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading applications…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
             {err}
            <div><button style={eyeBtn} className="tc-btn" onClick={load}>Retry</button></div>
          </div>
        ) : (
        <>
        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}>ESTABLISHMENT</th>
              <th style={thStyle}>TYPE</th>
              <th style={thStyle}>APPLICANT</th>
              <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
              <th style={thStyle}>SUBMITTED DATE</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((a) => (
              <tr key={a.id}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>{a.establishment}</td>
                <td style={tdStyle}>{a.type}</td>
                <td style={tdStyle}>{a.applicant}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={statusStyle(a.status)}>{a.status}</span>
                  {pickupStatus(a) && (
                    <div style={{ fontSize: 11, marginTop: 4, color: pickupTone[pickupStatus(a).tone] }}>{pickupStatus(a).label}</div>
                  )}
                </td>
                <td style={tdStyle}>{a.submitted}</td>
                <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button style={eyeBtn} className="tc-btn" title="Review Application" onClick={() => openReview(a)}>Review</button>
                  {a.status === "Approved" && !a.pickedUpAt && (
                    <>
                      <button style={certBtn} className="tc-btn" title="Resend pickup notice" onClick={() => resendNotice(a)} disabled={busy}>Notify</button>
                      <button style={pickedBtn} className="tc-btn" title="Mark as picked up" onClick={() => markPickedUp(a)} disabled={busy}>Picked Up</button>
                    </>
                  )}
                  <button style={delBtn} className="tc-btn" title="Delete Application" onClick={() => deleteApp(a)} disabled={busy}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No applications found.</td></tr>
            )}
          </tbody>
        </table>
        {pagination}
        </>
        )}
      </div>

      {reviewing && (
        <div style={overlay} className="tc-modal-backdrop" onClick={closeReview}>
          <div style={modal} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div style={modalTop}>
              <span style={{ fontWeight: 700, fontSize: 20 }}>Review Application</span>
              <button style={closeBtn} className="tc-btn" onClick={closeReview}>✕</button>
            </div>

            <div style={{ padding: "22px" }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: "#0F172A" }}>{reviewing.establishment}</div>
              <div style={{ color: "#6b7280", marginBottom: 16 }}>{reviewing.type}</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 14 }}>
                <div><div style={infoLabel}>Applicant</div><div style={infoValue}>{reviewing.applicant}</div></div>
                <div><div style={infoLabel}>Contact</div><div style={infoValue}>{reviewing.contact}</div></div>
                <div><div style={infoLabel}>Business/Mayor's Permit No.</div><div style={infoValue}>{reviewing.permitNo}</div></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={infoLabel}>Business Address</div>
                <div style={infoValue}>{reviewing.address}</div>
              </div>

              <div style={infoLabel}>Uploaded Documents</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, marginBottom: 18 }}>
                {docsLoading ? (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>Loading documents…</span>
                ) : reviewDocs.length === 0 ? (
                  <span style={{ fontSize: 13, color: "#9ca3af" }}>No documents uploaded.</span>
                ) : (
                  reviewDocs.map((d) => (
                    <a
                      key={d.id}
                      style={docChip}
                      href={fileUrl(d.stored_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={d.original_name}
                    > {d.doc_type || d.original_name}</a>
                  ))
                )}
              </div>

              {reviewing.status === "Approved" ? (
                <div style={approvedBox}>
                  <div style={{ fontWeight: 600, color: "#16a34a", marginBottom: 6 }}>Approved</div>
                  <div style={infoSm}>Control No.: <b>{reviewing.controlNo}</b></div>
                  <div style={infoSm}>Business Account No.: <b>{reviewing.businessAccountNo}</b></div>
                  <div style={infoSm}>OR No.: <b>{reviewing.orNo}</b></div>
                  <div style={infoSm}>Issued: <b>{reviewing.issued}</b> · Valid Until: <b>{reviewing.expiry}</b></div>
                  {reviewing.pickedUpAt ? (
                    <div style={{ fontSize: 13, color: "#16a34a", marginTop: 6, fontWeight: 600 }}>
                      ✓ Picked up on {fmtDate(reviewing.pickedUpAt)}.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "#16a34a", marginTop: 6, fontWeight: 600 }}>
                        Physical certificate for pick up at the CCAT Office, Mandaluyong City Hall.
                      </div>
                      {reviewing.pickupDeadline && (
                        <div style={{ fontSize: 12.5, color: pickupTone[pickupStatus(reviewing)?.tone || "blue"], marginTop: 4, fontWeight: 600 }}>
                          {pickupStatus(reviewing)?.label}
                        </div>
                      )}
                    </>
                  )}
                  {reviewing.remarks && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Remarks: {reviewing.remarks}</div>}
                </div>
              ) : reviewing.status === "Rejected" ? (
                <div style={{ ...approvedBox, background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <div style={{ fontWeight: 600, color: "#dc2626" }}>✕ Rejected</div>
                  {reviewing.remarks && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>Remarks: {reviewing.remarks}</div>}
                </div>
              ) : (
                <>
                  <div style={infoLabel}>Review Remarks (Optional)</div>
                  <textarea style={textarea} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </>
              )}
            </div>

            <div style={modalFooter}>
              {reviewing.status === "Under Review" ? (
                <>
                  <button style={rejectBtn} className="tc-btn" onClick={reject} disabled={busy}>⊘ Reject</button>
                  <button style={approveBtn} className="tc-btn tc-btn-primary" onClick={approve} disabled={busy}>{busy ? "Saving…" : "✓ Approve"}</button>
                </>
              ) : reviewing.status === "Approved" && !reviewing.pickedUpAt ? (
                <>
                  <button style={rejectBtn} className="tc-btn" onClick={() => resendNotice(reviewing)} disabled={busy}>
                    {busy ? "Sending…" : "Resend Pickup Notice"}
                  </button>
                  <button style={approveBtn} className="tc-btn tc-btn-primary" onClick={() => markPickedUp(reviewing)} disabled={busy}>
                    ✓ Mark as Picked Up
                  </button>
                </>
              ) : (
                <button style={cancelBtn} className="tc-btn" onClick={closeReview}>Close</button>
              )}
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
const pageHeader = { display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", overflowX: "auto" };
const searchBox = { display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8", whiteSpace: "nowrap" };
const tdStyle = { padding: "16px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
const eyeBtn = { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#1D4ED8" };
const certBtn = { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 6, padding: "3px 10px", marginLeft: 8, cursor: "pointer", fontSize: "13px", fontWeight: 700 };
const pickedBtn = { background: "#dbeafe", border: "1px solid #bfdbfe", color: "#1D4ED8", borderRadius: 6, padding: "3px 10px", marginLeft: 8, cursor: "pointer", fontSize: "13px", fontWeight: 700 };
const pickupTone = { green: "#16a34a", amber: "#b45309", red: "#dc2626", blue: "#1D4ED8" };
const delBtn = { background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, padding: "3px 10px", marginLeft: 8, cursor: "pointer", fontSize: "13px", fontWeight: 700 };

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const modal = { background: "#fff", borderRadius: "16px", width: "640px", maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const modalTop = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #eef2f8" };
const closeBtn = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#6b7280" };
const infoLabel = { fontSize: "13px", color: "#6b7280", marginBottom: 4 };
const infoValue = { fontSize: "15px", fontWeight: 600, color: "#0F172A" };
const infoSm = { fontSize: "14px", color: "#374151", padding: "1px 0" };
const docChip = { background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: "#1D4ED8", cursor: "pointer", textDecoration: "none", display: "inline-block" };
const textarea = { width: "100%", minHeight: 110, padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box", marginTop: 6, resize: "vertical", fontFamily: "inherit" };
const approvedBox = { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px" };
const modalFooter = { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px", borderTop: "1px solid #eef2f8" };
const rejectBtn = { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
const approveBtn = { background: "#16a34a", color: "#fff", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" };
const cancelBtn = { background: "#f1f5f9", color: "#374151", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "14px", cursor: "pointer" };
