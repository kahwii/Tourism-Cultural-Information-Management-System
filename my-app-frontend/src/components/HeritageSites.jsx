import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./ConfirmDialog";
import { HERITAGE_CATEGORIES } from "../data/tcimsData";
import { apiList, apiCreate, apiUpdate, apiRemove, apiUploadPlaceImage, fileUrl } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";
import ImageCropper from "./ImageCropper";

// Matches the detail-view hero's display ratio (modal content ~740px wide,
// hero ~160px tall) so what the admin crops is close to what it looks like
// as the hero background everywhere it's shown.
const SITE_ASPECT = 740 / 160;

const STATUS_OPTIONS = ["Well-maintained", "Active", "Under Restoration", "At Risk"];

// gradient header per category (since we don't have photos yet)
const CATEGORY_GRADIENT = {
  "Church": "linear-gradient(135deg, #1e3a8a, #1D4ED8)",
  "Abbey": "linear-gradient(135deg, #4c1d95, #7c3aed)",
  "Heritage Structure": "linear-gradient(135deg, #334155, #64748b)",
  "Historical Landmark": "linear-gradient(135deg, #7c2d12, #b45309)",
  "Institution": "linear-gradient(135deg, #374151, #6b7280)",
  "School": "linear-gradient(135deg, #0e7490, #06b6d4)",
  "Park": "linear-gradient(135deg, #166534, #22c55e)"
};
const gradientFor = (cat) => CATEGORY_GRADIENT[cat] || "linear-gradient(135deg, #334155, #64748b)";

// solid accent color per category (for the clean, photo-free cards)
const CATEGORY_COLOR = {
  "Church": "#1D4ED8", "Abbey": "#7c3aed", "Heritage Structure": "#64748b",
  "Historical Landmark": "#b45309", "Institution": "#6b7280", "School": "#0891b2", "Park": "#16a34a"
};
const colorFor = (cat) => CATEGORY_COLOR[cat] || "#64748b";

const EMPTY_FORM = {
  name: "", category: HERITAGE_CATEGORIES[0], tagline: "", est: "", location: "",
  description: "", significance: "", status: "Well-maintained", coordinates: "14.5794, 121.0359", image: ""
};

// background for a card/hero: real photo if available, else category gradient
const headerBg = (s) =>
  s.image
    ? "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(" + fileUrl(s.image) + ") center/cover no-repeat"
    : gradientFor(s.category);

export default function HeritageSites() {
  const [confirm, ConfirmUI] = useConfirm();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("explorer"); // "explorer" | "list"
  const [detail, setDetail] = useState(null);    // site shown in explorer modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("heritage_sites");
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load heritage sites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = sites.filter(s =>
    [s.name, s.location, s.category, s.description].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (s) => {
    setEditingId(s.id);
    setForm({ name: s.name, category: s.category, tagline: s.tagline || "", est: s.est, location: s.location, description: s.description, significance: s.significance, status: s.status, coordinates: s.coordinates, image: s.image || "" });
    setDetail(null);
    setModalOpen(true);
  };

  const onImageChosen = (file) => { if (file) setCropFile(file); };
  const onCropApplied = async (blob) => {
    setCropFile(null);
    setImageUploading(true);
    try {
      const croppedFile = new File([blob], "site.jpg", { type: "image/jpeg" });
      const res = await apiUploadPlaceImage("heritage_sites", croppedFile, form.image || null);
      setForm(f => ({ ...f, image: res.image }));
    } catch (e) {
      toast.error(e.message || "Failed to upload image.");
    } finally {
      setImageUploading(false);
    }
  };
  const removeImage = () => setForm(f => ({ ...f, image: "" }));

  const saveSite = async () => {
    if (!form.name.trim()) { toast.error("Please enter a site name."); return; }
    const payload = { ...form, est: (form.est || "").trim() || "—" };
    setSaving(true);
    try {
      if (editingId) await apiUpdate("heritage_sites", editingId, payload);
      else await apiCreate("heritage_sites", payload);
      setModalOpen(false);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to save heritage site.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSite = async (id) => {
    if (!(await confirm({
      title: "Delete this heritage site?",
      message: "The site will be removed from the directory and the Heritage Trail.",
      confirmLabel: "Delete site",
    }))) return;
    try {
      await apiRemove("heritage_sites", id);
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete heritage site.");
    }
  };

  const statusStyle = (s) => {
    if (s === "Under Restoration") return badgeAmber;
    if (s === "At Risk") return badgeRed;
    if (s === "Active") return badgeBlue;
    return badgeGreen; // Well-maintained
  };

  return (
    <>
      {/* BREADCRUMB */}
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Heritage</span>
      </div>

      {/* HEADER */}
      <div style={headerRow}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={headerIcon} className="tc-page-icon"><Icon name="landmark" size={26} /></div>
          <div>
            <h1 style={pageTitle}>Cultural Heritage (CHIMS)</h1>
            <p style={pageSub}>Explore and manage Mandaluyong's historical landmarks and heritage sites.</p>
          </div>
        </div>
        <button style={addBtn} className="tc-btn tc-btn-primary" onClick={openAdd}>+ Add Heritage Site</button>
      </div>

      {/* VIEW TOGGLE */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={toggleWrap}>
          <button style={{ ...toggleItem, ...(view === "explorer" ? toggleActive : {}) }} onClick={() => setView("explorer")}>▦ Explorer</button>
          <button style={{ ...toggleItem, ...(view === "list" ? toggleActive : {}) }} onClick={() => setView("list")}>☰ List</button>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={searchBox} className="tc-search">
          <span style={{ opacity: 0.5 }}></span>
          <input style={searchInput} className="tc-input" placeholder="Search heritage sites..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* LOADING / ERROR */}
      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>Loading heritage sites…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626", padding: 40 }}>
           {err}
          <div><button style={{ ...addBtn, marginTop: 12 }} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div>
        </div>
      ) : view === "explorer" ? (
        <div style={cardGrid}>
          {filtered.map((s) => (
            <div key={s.id} className="card-hover" style={{ ...siteCard, borderTop: `4px solid ${colorFor(s.category)}` }} onClick={() => setDetail(s)}>
              <div style={{ padding: "18px" }}>
                <div style={siteTopRow}>
                  <span style={{ ...siteBadge, background: colorFor(s.category) + "14", color: colorFor(s.category) }}>Est. {s.est}</span>
                  <span style={{ ...siteCatChip, background: colorFor(s.category) + "1a", color: colorFor(s.category) }}>{s.category}</span>
                </div>
                <div style={siteTitleTxt}>{s.name}</div>
                <p style={siteDescTxt}>
                  {s.description && s.description.length > 120 ? s.description.slice(0, 120) + "…" : s.description}
                </p>
                <div style={siteMetaRow}>
                  <Icon name="pin" size={14} style={{ color: "#9ca3af", flexShrink: 0 }} /><span>{s.location}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: "#9ca3af", padding: 20 }}>No heritage sites found.</div>}
        </div>
      ) : (
        /* LIST (table) */
        <div style={card}>
          <table style={tableStyle} className="tc-table">
            <thead>
              <tr>
                <th style={thStyle}>NAME</th>
                <th style={thStyle}>CATEGORY</th>
                <th style={thStyle}>EST.</th>
                <th style={thStyle}>LOCATION</th>
                <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A", cursor: "pointer" }} onClick={() => setDetail(s)}>{s.name}</td>
                  <td style={tdStyle}>{s.category}</td>
                  <td style={tdStyle}>{s.est}</td>
                  <td style={tdStyle}>{s.location}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}><span style={statusStyle(s.status)}>{s.status}</span></td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <button style={editBtn} className="tc-btn" title="Edit" onClick={() => openEdit(s)}>Edit</button>
                    <button style={delBtn} className="tc-btn" title="Delete" onClick={() => deleteSite(s.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No heritage sites found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL MODAL (Heritage Explorer) */}
      {detail && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setDetail(null)}>
          <div style={detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={detailTopBar}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Heritage Explorer</span>
              <button style={closeBtn} className="tc-btn" onClick={() => setDetail(null)}>✕</button>
            </div>

            <div style={{ padding: "20px" }}>
              {/* hero */}
              <div style={{ ...detailHero, background: headerBg(detail) }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>{detail.name}</div>
                  <div style={{ display: "flex", gap: 16, fontSize: 14, opacity: 0.95 }}>
                    <span> Est. {detail.est}</span>
                    <span> {detail.location}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginTop: 20 }}>
                <div>
                  <h3 style={sectionH}>Historical Background</h3>
                  <p style={sectionP}>{detail.description}</p>
                  <h3 style={{ ...sectionH, marginTop: 20 }}>Cultural Significance</h3>
                  <p style={sectionP}>{detail.significance}</p>
                </div>
                <div>
                  <div style={factsBox}>
                    <div style={{ fontWeight: 700, marginBottom: 12, color: "#0F172A" }}>Quick Facts</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>Category</div>
                    <div style={{ fontSize: 14, color: "#0F172A", marginBottom: 10 }}>{detail.category}</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>Status</div>
                    <div style={{ marginBottom: 10 }}><span style={statusStyle(detail.status)}>{detail.status}</span></div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>Coordinates</div>
                    <div style={{ fontSize: 14, color: "#0F172A" }}>{detail.coordinates}</div>
                  </div>
                  <button
                    style={arBtn}
                    onClick={() => window.open(`https://www.google.com/maps?q=${encodeURIComponent(detail.coordinates)}`, "_blank")}
                  >
                     View on Map
                  </button>
                  <button style={editFromDetailBtn} onClick={() => openEdit(detail)}>Edit Site</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div style={modal} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 18px", fontSize: 20, color: "#0F172A" }}>
              {editingId ? "Edit Heritage Site" : "Add Heritage Site"}
            </h2>

            <label style={fieldLabel}>Name</label>
            <input style={fieldInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label style={fieldLabel}>Category</label>
            <select style={fieldInput} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {HERITAGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={fieldLabel}>Tagline (optional)</label>
            <input style={fieldInput} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="e.g. Established 1863 · Oldest in the city" />

            <label style={fieldLabel}>Established (year)</label>
            <input style={fieldInput} value={form.est} onChange={(e) => setForm({ ...form, est: e.target.value })} placeholder="e.g. 1863" />

            <label style={fieldLabel}>Location</label>
            <input style={fieldInput} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />

            <label style={fieldLabel}>Photo (optional)</label>
            {form.image ? (
              <div style={sitePhotoPreviewWrap}>
                <div style={{ ...sitePhotoPreviewImg, backgroundImage: "url(" + fileUrl(form.image) + ")" }} />
                <div style={sitePhotoActions}>
                  <label style={sitePhotoBtn} className="tc-btn">
                    Change
                    <input
                      type="file" accept="image/*"
                      style={{ display: "none" }} disabled={imageUploading}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                    />
                  </label>
                  <button type="button" style={sitePhotoRemoveBtn} className="tc-btn" onClick={removeImage} disabled={imageUploading}>Remove</button>
                </div>
              </div>
            ) : (
              <label style={sitePhotoDropzone}>
                <Icon name="landmark" size={20} style={{ color: "#9ca3af" }} />
                <span>{imageUploading ? "Uploading…" : "Click to upload a photo"}</span>
                <input
                  type="file" accept="image/*"
                  style={{ display: "none" }} disabled={imageUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                />
              </label>
            )}
            {cropFile && (
              <ImageCropper file={cropFile} aspect={SITE_ASPECT} onCancel={() => setCropFile(null)} onApply={onCropApplied} />
            )}

            <label style={fieldLabel}>Historical Background</label>
            <textarea style={{ ...fieldInput, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <label style={fieldLabel}>Cultural Significance</label>
            <textarea style={{ ...fieldInput, minHeight: 60, resize: "vertical" }} value={form.significance} onChange={(e) => setForm({ ...form, significance: e.target.value })} />

            <label style={fieldLabel}>Status</label>
            <select style={fieldInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label style={fieldLabel}>Coordinates</label>
            <input style={fieldInput} value={form.coordinates} onChange={(e) => setForm({ ...form, coordinates: e.target.value })} placeholder="14.5794, 121.0359" />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button style={cancelBtn} className="tc-btn" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={saveBtn} className="tc-btn tc-btn-primary" onClick={saveSite} disabled={saving || imageUploading}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Site"}</button>
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
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "12px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };
const addBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 20px", fontSize: "15px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

const toggleWrap = { display: "inline-flex", background: "#fff", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "4px", gap: "4px" };
const toggleItem = { border: "none", background: "transparent", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", color: "#374151" };
const toggleActive = { background: "#EFF5FF", color: "#1D4ED8", fontWeight: 600 };

const card = { background: "#fff", padding: "16px 20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const searchBox = { display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px", maxWidth: 460 };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };

const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" };
const siteCard = { background: "#fff", borderRadius: "14px", border: "1px solid #eef2f8", boxShadow: "0 1px 3px rgba(15,23,42,0.05)", cursor: "pointer" };
const siteTopRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 };
const siteBadge = { display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" };
const siteCatChip = { display: "inline-block", padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" };
const siteTitleTxt = { fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: "2px 0 10px", lineHeight: 1.35 };
const siteDescTxt = { margin: "0 0 12px", fontSize: 13.5, color: "#4b5563", lineHeight: 1.5 };
const siteMetaRow = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6b7280" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
const iconAction = { background: "none", border: "none", cursor: "pointer", fontSize: "16px", margin: "0 4px" };
const editBtn = { background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };
const delBtn = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const detailModal = { background: "#fff", borderRadius: "16px", width: "780px", maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const detailTopBar = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #eef2f8" };
const closeBtn = { background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#6b7280" };
const detailHero = { borderRadius: "14px", minHeight: "160px", padding: "20px", display: "flex", alignItems: "flex-end", color: "#fff" };
const sectionH = { margin: "0 0 8px", fontSize: "16px", color: "#0F172A", borderBottom: "1px solid #eef2f8", paddingBottom: 6 };
const sectionP = { margin: 0, fontSize: "14px", color: "#4b5563", lineHeight: 1.6 };
const factsBox = { background: "#F7FAFF", border: "1px solid #eef2f8", borderRadius: "12px", padding: "16px", marginBottom: 12 };
const arBtn = { width: "100%", background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", marginBottom: 8 };
const editFromDetailBtn = { width: "100%", background: "#f1f5f9", color: "#374151", border: "none", borderRadius: "10px", padding: "10px", fontSize: "14px", cursor: "pointer" };

const modal = { background: "#fff", borderRadius: "16px", padding: "26px", width: "480px", maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" };
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const fieldInput = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" };
const cancelBtn = { background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "14px", color: "#374151" };
const saveBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "14px", fontWeight: 600 };

const sitePhotoDropzone = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: "100px", borderRadius: "10px", border: "1.5px dashed #d1d5db", background: "#F7FAFF", color: "#6b7280", fontSize: "13px", cursor: "pointer", textAlign: "center" };
const sitePhotoPreviewWrap = { position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid #e6ecf5" };
const sitePhotoPreviewImg = { width: "100%", height: "140px", backgroundSize: "cover", backgroundPosition: "center", display: "block" };
const sitePhotoActions = { position: "absolute", top: 8, right: 8, display: "flex", gap: 6 };
const sitePhotoBtn = { background: "rgba(15,23,42,0.72)", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center" };
const sitePhotoRemoveBtn = { background: "rgba(15,23,42,0.72)", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" };
