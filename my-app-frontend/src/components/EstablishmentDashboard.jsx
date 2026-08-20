import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { apiList, apiCreate, apiUploadDoc, apiCertDocs, fileUrl } from "../api/api";
import { toast } from "../utils/toast";

const TYPE_OPTIONS = ["Hotel", "Restaurant", "Shopping Mall", "Tourism Business", "Travel Agency", "Event Venue", "Others"];

// Standard accreditation requirements (Tourism Code of Mandaluyong)
const REQUIREMENTS = [
  { key: "Business/Mayor's Permit", required: true },
  { key: "DTI / SEC Registration", required: true },
  { key: "Sanitary Permit", required: true },
  { key: "Fire Safety Inspection Certificate", required: true },
  { key: "BIR Registration (Form 2303)", required: false },
];

export default function EstablishmentDashboard() {
  const { user } = useAuth();
  const [apps, setApps] = useState([]);
  const [docsByApp, setDocsByApp] = useState({}); // { [appId]: [docs] }
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");

  // fallback create form (only shown when the account has no application yet)
  const [form, setForm] = useState({ establishment: "", type: TYPE_OPTIONS[0], applicant: user?.username || "", contact: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("certificates");
      const list = Array.isArray(data) ? data : [];
      setApps(list);
      // fetch documents for each application
      const entries = await Promise.all(list.map(async (a) => {
        try { return [a.id, await apiCertDocs(a.id)]; } catch { return [a.id, []]; }
      }));
      setDocsByApp(Object.fromEntries(entries));
    } catch (e) {
      setErr(e.message || "Failed to load your applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadFor = async (appId, reqKey, file) => {
    if (!file) return;
    const k = appId + "|" + reqKey;
    setUploadingKey(k);
    try {
      await apiUploadDoc(appId, reqKey, file);
      const docs = await apiCertDocs(appId);
      setDocsByApp((prev) => ({ ...prev, [appId]: docs }));
    } catch (e) {
      toast.error(e.message || "Upload failed.");
    } finally {
      setUploadingKey("");
    }
  };

  const createApplication = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.establishment.trim() || !form.address.trim()) { setMsg("Please fill in the business name and address."); return; }
    setSaving(true);
    try {
      await apiCreate("certificates", { ...form });
      setMsg("Application created! Upload your requirements below.");
      await load();
    } catch (e2) {
      setMsg(e2.message || "Failed to create application.");
    } finally {
      setSaving(false);
    }
  };

  const statusStyle = (s) => s === "Approved" ? badgeGreen : s === "Rejected" ? badgeRed : badgeBlue;
  const docFor = (appId, reqKey) => (docsByApp[appId] || []).find((d) => d.doc_type === reqKey);

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, color: "#0F172A" }}>Welcome, {user?.username}</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 15 }}>
          Track your accreditation application and upload the required documents for CCAT review.
        </p>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280" }}>Loading your application…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626" }}>{err}<div><button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div></div>
      ) : apps.length === 0 ? (
        /* fallback: account has no application yet */
        <div style={card} className="tc-tile">
          <h2 style={cardTitle}>Start your Accreditation Application</h2>
          <p style={cardSub}>You don't have an application yet. Create one to begin.</p>
          <form onSubmit={createApplication}>
            <label style={fieldLabel}>Business / Establishment Name *</label>
            <input style={fieldInput} className="tc-input" value={form.establishment} onChange={(e) => setForm({ ...form, establishment: e.target.value })} />
            <label style={fieldLabel}>Establishment Type</label>
            <select style={fieldInput} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <label style={fieldLabel}>Applicant / Contact Person</label>
            <input style={fieldInput} className="tc-input" value={form.applicant} onChange={(e) => setForm({ ...form, applicant: e.target.value })} />
            <label style={fieldLabel}>Contact Number</label>
            <input style={fieldInput} className="tc-input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
            <label style={fieldLabel}>Business Address *</label>
            <textarea style={{ ...fieldInput, minHeight: 70, resize: "vertical" }} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            {msg && <div style={{ marginTop: 12, fontSize: 14, color: msg.includes("created") ? "#16a34a" : "#dc2626" }}>{msg}</div>}
            <button type="submit" style={submitBtn} disabled={saving}>{saving ? "Creating…" : "Create Application"}</button>
          </form>
        </div>
      ) : (
        /* application(s) with requirement uploads */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {apps.map((a) => (
            <div key={a.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: "#0F172A" }}>{a.establishment}</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>{a.type} · Submitted {a.submitted_date || "—"}</div>
                </div>
                <span style={statusStyle(a.status)}>{a.status}</span>
              </div>

              {a.status === "Approved" && a.control_no && (
                <div style={approvedBox}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Approved — Control No. <b>{a.control_no}</b> · Valid until <b>{a.expiry}</b>
                  </div>
                  {a.picked_up_at ? (
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                      ✓ Picked up on <b>{new Date(a.picked_up_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</b>.
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        Your official <b>Certificate of Registration</b> is now <b>ready for pick up</b> at the
                        City Cultural Affairs &amp; Tourism Development Department (CCAT), Mandaluyong City Hall,
                        Monday–Friday, 8:00 AM–5:00 PM. Please bring one (1) valid government-issued ID and your
                        Official Receipt (OR No. <b>{a.or_no}</b>). A confirmation was also sent to your email.
                      </div>
                      {a.pickup_deadline && (
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#b45309", marginTop: 8 }}>
                          Please claim by {new Date(a.pickup_deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} — unclaimed certificates past this date may be subject to cancellation.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {a.status === "Rejected" && a.remarks && (
                <div style={{ ...approvedBox, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>Remarks: {a.remarks}</div>
              )}

              <div style={{ margin: "16px 0 8px", fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Requirements</div>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>Upload PDF, JPG, or PNG (max 5 MB each). * = required.</p>

              {REQUIREMENTS.map((r) => {
                const doc = docFor(a.id, r.key);
                const k = a.id + "|" + r.key;
                return (
                  <div key={r.key} style={reqRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {r.key} {r.required && <span style={{ color: "#dc2626" }}>*</span>}
                      </div>
                      {doc ? (
                        <a href={fileUrl(doc.stored_path)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#16a34a" }}>
                          ✓ {doc.original_name} (view)
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>Not uploaded yet</div>
                      )}
                    </div>
                    <label style={fileBtn}>
                      {uploadingKey === k ? "Uploading…" : doc ? "Replace" : "Upload"}
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                        disabled={uploadingKey === k}
                        onChange={(e) => uploadFor(a.id, r.key, e.target.files?.[0])} />
                    </label>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= STYLES ================= */
const card = { background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const cardTitle = { margin: "0 0 4px", fontSize: 18, color: "#0F172A" };
const cardSub = { margin: "0 0 16px", fontSize: 13, color: "#6b7280" };
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const fieldInput = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" };
const submitBtn = { width: "100%", marginTop: 18, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "15px", fontWeight: 600, cursor: "pointer" };
const retryBtn = { marginTop: 10, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 };
const reqRow = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #eef2f8", borderRadius: 10, marginBottom: 8, background: "#fafbff" };
const fileBtn = { background: "#1D4ED8", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const approvedBox = { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#166534", marginTop: 8 };
const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block", whiteSpace: "nowrap" };
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
