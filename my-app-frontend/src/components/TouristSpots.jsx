import { useState, useEffect } from "react";
import { useConfirm } from "./ConfirmDialog";
import { apiList, apiCreate, apiUpdate, apiRemove, apiUploadPlaceImage, fileUrl } from "../api/api";
import { toast } from "../utils/toast";
import { isValidPhone, isValidEmail, isValidWebsite, websiteHref, telHref } from "../utils/contact";
import Icon from "./Icon";
import ImageCropper from "./ImageCropper";

const TABLE = "tourist_spots";

// Includes the original admin-authored options plus the categories actually
// used by the places seeded from the old static list (migrate_places.php) —
// so editing one of those doesn't silently blank/change its category because
// the value wasn't in this dropdown.
const CATEGORY_OPTIONS = [
  "Historical/Cultural", "Church", "Park", "Mall", "Sports & Recreation", "Museum", "Special Events", "Others",
  "History and Culture", "Sports and Recreation Facilities", "Shopping",
];

// Matches the photo preview's display ratio (modal content ~408px wide,
// preview box 140px tall) — same convention as Events.jsx's poster cropper.
const SPOT_ASPECT = 408 / 140;

const EMPTY_FORM = { name: "", category: CATEGORY_OPTIONS[0], address: "", contact_no: "", email: "", website: "", status: "Active", coordinates: "", image: "" };

export default function TouristSpots() {
  const [confirm, ConfirmUI] = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList(TABLE);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr("Failed to load from server. Make sure XAMPP (Apache + MySQL) is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = rows.filter(s =>
    [s.name, s.category, s.address, s.contact_no, s.email, s.website].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name, category: s.category || "", address: s.address || "",
      contact_no: s.contact_no || "", email: s.email || "", website: s.website || "",
      status: s.status || "Active", coordinates: s.coordinates || "", image: s.image || "",
    });
    setModalOpen(true);
  };

  const onImageChosen = (file) => { if (file) setCropFile(file); };
  const onCropApplied = async (blob) => {
    setCropFile(null);
    setImageUploading(true);
    try {
      const croppedFile = new File([blob], "spot.jpg", { type: "image/jpeg" });
      const res = await apiUploadPlaceImage("tourist_spots", croppedFile, form.image || null);
      setForm(f => ({ ...f, image: res.image }));
    } catch (e) {
      toast.error(e.message || "Failed to upload image.");
    } finally {
      setImageUploading(false);
    }
  };
  const removeImage = () => setForm(f => ({ ...f, image: "" }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Please enter a name."); return; }
    // Same rule as the other directory pages: optional, but not wrong.
    if (!isValidPhone(form.contact_no)) { toast.error("Contact number looks invalid. Use digits, spaces, +, ( ), or - (e.g. 0917 123 4567)."); return; }
    if (!isValidEmail(form.email)) { toast.error("Email address looks invalid."); return; }
    if (!isValidWebsite(form.website)) { toast.error("Website looks invalid. Use something like example.com or https://example.com."); return; }
    setSaving(true);
    try {
      if (editingId) await apiUpdate(TABLE, editingId, form);
      else await apiCreate(TABLE, form);
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirm({
      title: "Delete this tourist spot?",
      message: "The spot will be removed from the directory and from tourist search results.",
      confirmLabel: "Delete spot",
    }))) return;
    try { await apiRemove(TABLE, id); await load(); }
    catch (e) { toast.error("Delete failed: " + e.message); }
  };

  return (
    <>
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span>Tourism</span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Spots</span>
      </div>

      <div style={headerRow}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={headerIcon} className="tc-page-icon"><Icon name="pin" size={26} /></div>
          <div>
            <h1 style={pageTitle}>Tourist Spots</h1>
            <p style={pageSub}>Manage tourist destinations, parks, and landmarks.</p>
          </div>
        </div>
        <button style={addBtn} className="tc-btn tc-btn-primary" onClick={openAdd}>+ Add New</button>
      </div>

      <div style={card}>
        <div style={cardToolbar}>
          <div style={searchBox} className="tc-search">
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} className="tc-input" placeholder="Search tourist spots..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button style={exportBtn} className="tc-btn tc-btn-primary" onClick={() => exportCSV(rows)}>Export</button>
        </div>

        {err && <div style={errBox}>{err} <button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div>}

        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>NAME</th>
              <th style={thStyle}>CATEGORY</th>
              <th style={thStyle}>ADDRESS</th>
              <th style={thStyle}>CONTACT</th>
              <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={7}>Loading…</td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id}>
                <td style={tdStyle}>
                  {s.image
                    ? <img src={fileUrl(s.image)} alt="" style={rowThumb} />
                    : <div style={rowThumbPlaceholder}><Icon name="pin" size={15} style={{ color: "#c7d0dc" }} /></div>}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>{s.name}</td>
                <td style={tdStyle}>{s.category}</td>
                <td style={tdStyle}>{s.address}</td>
                <td style={{ ...tdStyle, maxWidth: 210 }}>
                  {s.contact_no || s.email || s.website ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {s.contact_no && <a href={telHref(s.contact_no)} style={contactLink}>{s.contact_no}</a>}
                      {s.email && <a href={`mailto:${s.email}`} style={contactLink}>{s.email}</a>}
                      {s.website && <a href={websiteHref(s.website)} target="_blank" rel="noopener noreferrer" style={contactLink}>{s.website}</a>}
                    </div>
                  ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={s.status === "Active" ? badgeActive : badgeInactive}>{s.status}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <div className="tc-row-actions">
                    <button className="tc-row-btn tc-row-btn-edit" title="Edit" onClick={() => openEdit(s)}><Icon name="edit" size={16} /></button>
                    <button className="tc-row-btn tc-row-btn-danger" title="Delete" onClick={() => remove(s.id)}><Icon name="trash" size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={7}>No tourist spots found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="tc-modal-backdrop tc-form-overlay" onClick={() => setModalOpen(false)}>
          <div className="tc-modal tc-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-form-header">
              <div className="tc-form-header-icon"><Icon name="pin" size={20} /></div>
              <div className="tc-form-header-text">
                <h2 className="tc-form-title">{editingId ? "Edit Tourist Spot" : "Add Tourist Spot"}</h2>
                <p className="tc-form-subtitle">{editingId ? "Update this spot's details." : "Add a new destination to the directory."}</p>
              </div>
              <button className="tc-form-close" onClick={() => setModalOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className="tc-form-body">
              <div className="tc-form-section">
                <div className="tc-form-section-title">Basic Information</div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Name</label>
                  <input className="tc-form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="tc-form-grid">
                  <div className="tc-form-field">
                    <label className="tc-form-label">Category</label>
                    <select className="tc-form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="tc-form-field">
                    <label className="tc-form-label">Status</label>
                    <select className="tc-form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <p className="tc-form-hint">Inactive spots are hidden from Explore.</p>
                  </div>
                </div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Address</label>
                  <input className="tc-form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Coordinates <span className="opt">(optional)</span></label>
                  <input className="tc-form-input" value={form.coordinates} onChange={(e) => setForm({ ...form, coordinates: e.target.value })} placeholder="14.5794, 121.0359" />
                </div>
              </div>

              <div className="tc-form-section">
                <div className="tc-form-section-title">Contact Information</div>
                <p className="tc-form-section-hint">Optional, but shown to tourists — leave blank rather than guessing.</p>
                <div className="tc-form-grid">
                  <div className="tc-form-field">
                    <label className="tc-form-label">Contact Number</label>
                    <input className="tc-form-input" value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} placeholder="0917 123 4567" />
                  </div>
                  <div className="tc-form-field">
                    <label className="tc-form-label">Email Address</label>
                    <input className="tc-form-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@example.com" />
                  </div>
                </div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Website</label>
                  <input className="tc-form-input" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="example.com" />
                </div>
              </div>

              <div className="tc-form-section">
                <div className="tc-form-section-title">Photo</div>
                {form.image ? (
                  <div className="tc-form-photo-wrap">
                    <img src={fileUrl(form.image)} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                    <div className="tc-form-photo-actions">
                      <label className="tc-form-photo-btn">
                        Change
                        <input
                          type="file" accept="image/*"
                          style={{ display: "none" }} disabled={imageUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                        />
                      </label>
                      <button type="button" className="tc-form-photo-btn" onClick={removeImage} disabled={imageUploading}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <label className="tc-form-dropzone">
                    <div className="tc-form-dropzone-icon"><Icon name="pin" size={16} /></div>
                    <span>{imageUploading ? "Uploading…" : "Click to upload a photo"}</span>
                    <input
                      type="file" accept="image/*"
                      style={{ display: "none" }} disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                    />
                  </label>
                )}
                {cropFile && (
                  <ImageCropper file={cropFile} aspect={SPOT_ASPECT} onCancel={() => setCropFile(null)} onApply={onCropApplied} />
                )}
              </div>
            </div>

            <div className="tc-form-footer">
              <button className="tc-btn tc-form-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="tc-btn tc-btn-primary tc-form-save" onClick={save} disabled={saving || imageUploading}>
                {saving ? "Saving…" : (editingId ? "Save Changes" : "Add Spot")}
              </button>
            </div>
          </div>
        </div>
      )}
    {ConfirmUI}
    </>
  );
}

function exportCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = "Name,Category,Address,Contact No.,Email,Website,Status\n";
  const body = rows.map(r =>
    [r.name, r.category, r.address, r.contact_no, r.email, r.website, r.status].map(esc).join(",")
  ).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "tourist_spots.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ================= STYLES ================= */
const contactLink = { color: "#2563eb", textDecoration: "none", fontSize: 13, overflowWrap: "anywhere" };
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };
const addBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 20px", fontSize: "15px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const cardToolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" };
const searchBox = { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const exportBtn = { background: "#f1f5f9", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", cursor: "pointer", color: "#374151" };
const errBox = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" };
const retryBtn = { background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "16px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };
const badgeActive = { background: "#dcfce7", color: "#16a34a", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 };
const badgeInactive = { background: "#fee2e2", color: "#dc2626", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 };

const rowThumb = { width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0, border: "1px solid #eef2f8" };
const rowThumbPlaceholder = { width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, background: "#f7faff", border: "1px solid #eef2f8", display: "flex", alignItems: "center", justifyContent: "center" };
