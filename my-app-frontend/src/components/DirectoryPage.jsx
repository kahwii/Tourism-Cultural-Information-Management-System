import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./ConfirmDialog";
import { apiList, apiCreate, apiUpdate, apiRemove, apiUploadPlaceImage, fileUrl } from "../api/api";
import { toast } from "../utils/toast";
import { isValidPhone, isValidEmail, isValidWebsite, websiteHref, telHref } from "../utils/contact";
import Icon from "./Icon";
import ImageCropper from "./ImageCropper";

// Matches TouristSpots.jsx's photo preview ratio, so photos across every
// directory page (restaurants, hotels, tourism businesses, tourist spots)
// crop and display consistently.
const DIRECTORY_ASPECT = 408 / 140;

/**
 * Reusable directory page (table with CRUD + search + export) — DB-backed.
 * Used by Restaurants, Hotels, and Tourism Businesses.
 *
 * Props:
 *  - title, subtitle, icon, breadcrumb (string)
 *  - table (DB table name, e.g. "restaurants")
 *  - categoryColumn (DB column the "category" maps to, e.g. "cuisine" or "type")
 *  - categoryLabel (e.g. "Cuisine", "Type")
 *  - categoryOptions (string[])
 *  - addLabel (e.g. "+ Add Restaurant")
 *  - exportName (csv filename without extension)
 */
export default function DirectoryPage({
  title, subtitle, icon = "", breadcrumb = "Tourism",
  table, categoryColumn = "category",
  categoryLabel = "Category", categoryOptions = [],
  addLabel = "+ Add New", exportName = "directory"
}) {
  const [confirm, ConfirmUI] = useConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  const emptyForm = { name: "", category: categoryOptions[0] || "", address: "", contact_no: "", email: "", website: "", status: "Active", image: "" };
  const [form, setForm] = useState(emptyForm);

  // map a DB row -> UI row (category comes from categoryColumn)
  const toUi = useCallback((r) => ({
    id: r.id,
    name: r.name ?? "",
    category: r[categoryColumn] ?? "",
    address: r.address ?? "",
    contact_no: r.contact_no ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    status: r.status ?? "Active",
    image: r.image ?? "",
  }), [categoryColumn]);

  // map a UI form -> DB payload (category goes back to categoryColumn)
  const toPayload = (f) => ({
    name: f.name,
    [categoryColumn]: f.category,
    address: f.address,
    contact_no: f.contact_no,
    email: f.email,
    website: f.website,
    status: f.status,
    image: f.image,
  });

  const onImageChosen = (file) => { if (file) setCropFile(file); };
  const onCropApplied = async (blob) => {
    setCropFile(null);
    setImageUploading(true);
    try {
      const croppedFile = new File([blob], "photo.jpg", { type: "image/jpeg" });
      const res = await apiUploadPlaceImage(table, croppedFile, form.image || null);
      setForm(f => ({ ...f, image: res.image }));
    } catch (e) {
      toast.error(e.message || "Failed to upload image.");
    } finally {
      setImageUploading(false);
    }
  };
  const removeImage = () => setForm(f => ({ ...f, image: "" }));

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList(table);
      setRows((Array.isArray(data) ? data : []).map(toUi));
    } catch (e) {
      setErr(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [table, toUi]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r =>
    [r.name, r.category, r.address, r.contact_no, r.email, r.website].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({ name: r.name, category: r.category, address: r.address, contact_no: r.contact_no, email: r.email, website: r.website, status: r.status, image: r.image || "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Please enter a name."); return; }
    // Contact details are optional, but a wrong one is worse than none —
    // a tourist dialling a malformed number just gets a dead end.
    if (!isValidPhone(form.contact_no)) { toast.error("Contact number looks invalid. Use digits, spaces, +, ( ), or - (e.g. 0917 123 4567)."); return; }
    if (!isValidEmail(form.email)) { toast.error("Email address looks invalid."); return; }
    if (!isValidWebsite(form.website)) { toast.error("Website looks invalid. Use something like example.com or https://example.com."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await apiUpdate(table, editingId, toPayload(form));
      } else {
        await apiCreate(table, toPayload(form));
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!(await confirm({
      title: "Delete this entry?",
      message: "This record will be removed from the tourism directory. This cannot be undone.",
      confirmLabel: "Delete entry",
    }))) return;
    try {
      await apiRemove(table, id);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete.");
    }
  };

  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = `Name,${categoryLabel},Address,Contact No.,Email,Website,Status\n`;
    const body = rows.map(r =>
      [r.name, r.category, r.address, r.contact_no, r.email, r.website, r.status].map(esc).join(",")
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${exportName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div style={breadcrumbStyle}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span>{breadcrumb}</span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>{title}</span>
      </div>

      <div style={headerRow}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={headerIcon}>{icon ? <Icon name={icon} size={26} /> : null}</div>
          <div>
            <h1 style={pageTitle}>{title}</h1>
            <p style={pageSub}>{subtitle}</p>
          </div>
        </div>
        <button style={addBtn} onClick={openAdd}>{addLabel}</button>
      </div>

      <div style={card}>
        <div style={cardToolbar}>
          <div style={searchBox}>
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} placeholder={`Search ${title.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button style={exportBtn} onClick={exportCSV}>Export</button>
        </div>

        {loading ? (
          <div style={stateBox}>Loading {title.toLowerCase()}…</div>
        ) : err ? (
          <div style={{ ...stateBox, color: "#dc2626" }}>
             {err}
            <div><button style={retryBtn} onClick={load}>Retry</button></div>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>NAME</th>
                <th style={thStyle}>{categoryLabel.toUpperCase()}</th>
                <th style={thStyle}>ADDRESS</th>
                <th style={thStyle}>CONTACT</th>
                <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    {r.image
                      ? <img src={fileUrl(r.image)} alt="" style={rowThumb} />
                      : <div style={rowThumbPlaceholder}>{icon ? <Icon name={icon} size={15} style={{ color: "#c7d0dc" }} /> : null}</div>}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#111827" }}>{r.name}</td>
                  <td style={tdStyle}>{r.category}</td>
                  <td style={tdStyle}>{r.address}</td>
                  <td style={{ ...tdStyle, maxWidth: 210 }}>
                    {r.contact_no || r.email || r.website ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {r.contact_no && <a href={telHref(r.contact_no)} style={contactLink}>{r.contact_no}</a>}
                        {r.email && <a href={`mailto:${r.email}`} style={contactLink}>{r.email}</a>}
                        {r.website && (
                          <a href={websiteHref(r.website)} target="_blank" rel="noopener noreferrer" style={contactLink}>{r.website}</a>
                        )}
                      </div>
                    ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={r.status === "Active" ? badgeActive : badgeInactive}>{r.status}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <div className="tc-row-actions">
                      <button className="tc-row-btn tc-row-btn-edit" title="Edit" onClick={() => openEdit(r)}><Icon name="edit" size={16} /></button>
                      <button className="tc-row-btn tc-row-btn-danger" title="Delete" onClick={() => remove(r.id)}><Icon name="trash" size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={7}>No entries found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="tc-modal-backdrop tc-form-overlay" onClick={() => setModalOpen(false)}>
          <div className="tc-modal tc-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-form-header">
              <div className="tc-form-header-icon">{icon ? <Icon name={icon} size={20} /> : null}</div>
              <div className="tc-form-header-text">
                <h2 className="tc-form-title">{editingId ? `Edit ${title}` : `Add ${title}`}</h2>
                <p className="tc-form-subtitle">{editingId ? "Update this entry's details." : `Add a new entry to the ${title.toLowerCase()} directory.`}</p>
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
                    <label className="tc-form-label">{categoryLabel}</label>
                    {categoryOptions.length ? (
                      <select className="tc-form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input className="tc-form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                    )}
                  </div>
                  <div className="tc-form-field">
                    <label className="tc-form-label">Status</label>
                    <select className="tc-form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    <p className="tc-form-hint">Inactive entries are hidden from Explore.</p>
                  </div>
                </div>
                <div className="tc-form-field">
                  <label className="tc-form-label">Address</label>
                  <input className="tc-form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
                    <div className="tc-form-dropzone-icon">{icon ? <Icon name={icon} size={16} /> : null}</div>
                    <span>{imageUploading ? "Uploading…" : "Click to upload a photo"}</span>
                    <input
                      type="file" accept="image/*"
                      style={{ display: "none" }} disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                    />
                  </label>
                )}
                {cropFile && (
                  <ImageCropper file={cropFile} aspect={DIRECTORY_ASPECT} onCancel={() => setCropFile(null)} onApply={onCropApplied} />
                )}
              </div>
            </div>

            <div className="tc-form-footer">
              <button className="tc-btn tc-form-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="tc-btn tc-btn-primary tc-form-save" onClick={save} disabled={saving || imageUploading}>
                {saving ? "Saving…" : editingId ? "Save Changes" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    {ConfirmUI}
    </>
  );
}

/* ================= STYLES ================= */
const breadcrumbStyle = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#2563eb", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#111827" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };
const addBtn = { background: "#2563eb", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 20px", fontSize: "15px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const cardToolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" };
const searchBox = { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#f8fafc", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const exportBtn = { background: "#f1f5f9", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", cursor: "pointer", color: "#374151" };

const stateBox = { padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "15px" };
const retryBtn = { marginTop: 12, background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", cursor: "pointer", fontSize: "14px" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "16px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeActive = { background: "#dcfce7", color: "#16a34a", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 };
const badgeInactive = { background: "#fee2e2", color: "#dc2626", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600 };

const contactLink = { color: "#2563eb", textDecoration: "none", fontSize: 13, overflowWrap: "anywhere" };

const rowThumb = { width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0, border: "1px solid #eef2f8" };
const rowThumbPlaceholder = { width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, background: "#f8fafc", border: "1px solid #eef2f8", display: "flex", alignItems: "center", justifyContent: "center" };
