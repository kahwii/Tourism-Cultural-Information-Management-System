import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import { eventStatus } from "../utils/eventStatus";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "./ConfirmDialog";
import { EVENTS_2026 } from "../data/tcimsData";
import { apiList, apiCreate, apiUpdate, apiRemove, apiUploadEventImage, apiNotifyEventDecision, fileUrl } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

const STATUS_OPTIONS = ["Upcoming", "Ongoing", "Completed", "Cancelled"];

const CATEGORY_OPTIONS = [...new Set(EVENTS_2026.map(e => e.category))];
const MONTH_ORDER = ["January","February","March/April","May","June","July","August","September","October","November","December"];

const EMPTY_FORM = {
  name: "", event_date: "", start_time: "", end_time: "", venue: "Mandaluyong City",
  description: "", category: CATEGORY_OPTIONS[0], status: "Upcoming", image: ""
};

// format "YYYY-MM-DD" -> "Mon D, YYYY"
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(String(d) + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
// "13:30" or "13:30:00" -> "1:30 PM"
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10);
  if (isNaN(hh)) return "";
  const ap = hh >= 12 ? "PM" : "AM";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${m ?? "00"} ${ap}`;
};
// "9:00 AM – 12:00 PM" / "9:00 AM" / ""
const timeRange = (e) => {
  const s = fmtTime(e.start_time), en = fmtTime(e.end_time);
  if (s && en) return `${s} – ${en}`;
  if (s) return `${s} onwards`;
  return en || "";
};
// month name from a date (for calendar grouping); auto-saved to the `month` column
const monthName = (d) => {
  if (!d) return "";
  const dt = new Date(String(d) + "T00:00:00");
  return isNaN(dt) ? "" : dt.toLocaleDateString("en-US", { month: "long" });
};

// DB row -> UI row
const toUi = (r) => ({
  id: r.id,
  name: r.name ?? "",
  event_date: r.event_date || "",
  start_time: r.start_time ? String(r.start_time).slice(0, 5) : "",
  end_time: r.end_time ? String(r.end_time).slice(0, 5) : "",
  month: r.month ?? "",
  venue: r.venue ?? "",
  description: r.description ?? "",
  category: r.category ?? "",
  status: r.status ?? "Upcoming",
  image: r.image ?? "",
  approvalStatus: r.approval_status ?? "Approved",
  approvalRemarks: r.approval_remarks ?? "",
});

// Maker-checker: CCAT Staff submit events for review; Super Admin / CCAT Admin publish them.
const APPROVER_ROLES = ["Super Admin", "CCAT Admin", "admin"];

export default function Events() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isApprover = APPROVER_ROLES.includes(user?.role);
  const [confirm, ConfirmUI] = useConfirm();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [view, setView] = useState("list"); // "list" | "calendar"
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("events");
      setEvents((Array.isArray(data) ? data : []).map(toUi));
    } catch (e) {
      setErr(e.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dispDate = (e) => (e.event_date ? fmtDate(e.event_date) : (e.month || "—"));

  const filtered = events.filter(e =>
    [e.name, e.venue, e.category, e.month, fmtDate(e.event_date)].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (ev) => {
    setEditingId(ev.id);
    setForm({ name: ev.name, event_date: ev.event_date, start_time: ev.start_time, end_time: ev.end_time, venue: ev.venue, description: ev.description, category: ev.category, status: ev.status, image: ev.image || "" });
    setModalOpen(true);
  };

  // Uploads immediately on file pick (same pattern as the profile-picture
  // uploader) so Save just persists the resulting path like any other field.
  const onImageChosen = async (file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const res = await apiUploadEventImage(file, form.image || null);
      setForm(f => ({ ...f, image: res.image }));
    } catch (e) {
      toast.error(e.message || "Failed to upload image.");
    } finally {
      setImageUploading(false);
    }
  };
  const removeImage = () => setForm(f => ({ ...f, image: "" }));

  const saveEvent = async () => {
    if (!form.name.trim()) { toast.error("Please enter an event name."); return; }
    if (!form.event_date) { toast.error("Please pick an event date."); return; }
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      toast.error("End time must be after the start time."); return;
    }
    const payload = {
      name: form.name,
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time,
      month: monthName(form.event_date),
      category: form.category,
      venue: form.venue,
      description: form.description,
      status: form.status,
      image: form.image || null,
    };
    setSaving(true);
    try {
      if (editingId) await apiUpdate("events", editingId, payload);
      else await apiCreate("events", payload);
      setModalOpen(false);
      await load();
      // A staff member's save always re-enters the approval queue (enforced server-side).
      if (!isApprover) toast.info("Submitted for CCAT Admin approval.");
    } catch (e) {
      toast.error(e.message || "Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  // Approver-only: publish or send back a staff-submitted event.
  const decide = async (ev, decision) => {
    let remarks = "";
    if (decision === "Rejected") {
      // Ask for a reason — the maker sees this in the Approval column, so a
      // blank rejection leaves them with no idea what to fix.
      const reason = window.prompt(
        `Why is "${ev.name}" being sent back?\n\nThis note is shown to the staff member who submitted it.`,
        ""
      );
      if (reason === null) return; // cancelled
      remarks = reason.trim() || "Sent back for revision.";
    }
    setSaving(true);
    try {
      await apiUpdate("events", ev.id, { approval_status: decision, approval_remarks: remarks });
      // Tell the submitter by email. Best-effort — the decision is already
      // saved, so a mail failure must not read as a failed approval.
      let note = "";
      try {
        const n = await apiNotifyEventDecision(ev.id);
        note = n.emailed ? ` Notice emailed to ${n.email}.` : "";
      } catch { /* leave note empty */ }
      await load();
      toast.success(decision === "Approved"
        ? `"${ev.name}" approved — now live on the public events page.${note}`
        : `"${ev.name}" sent back for revision.${note}`);
    } catch (e) {
      toast.error(e.message || "Failed to update the approval.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id) => {
    if (!(await confirm({
      title: "Delete this event?",
      message: "The event will be removed and will no longer appear to tourists.",
      confirmLabel: "Delete event",
    }))) return;
    try {
      await apiRemove("events", id);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete event.");
    }
  };

  // rows shared by both exporters (uses the LIVE date-derived status)
  const exportRows = () => events.map((e, i) => [
    i + 1, e.name || "", dispDate(e), timeRange(e) || "", e.venue || "", e.category || "", (eventStatus(e).key === "today" ? "Today" : eventStatus(e).label),
  ]);
  const stamp = () => new Date().toLocaleString();

  const loadLogo = async () => {
    try {
      const res = await fetch("/mandaluyong-logo.png?v=2");
      const blob = await res.blob();
      return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(null); fr.readAsDataURL(blob); });
    } catch { return null; }
  };

  // ---- Excel (styled .xls) ----
  const exportExcel = () => {
    const head = ["#", "Event Name", "Date", "Time", "Venue", "Category", "Status"];
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>`;
    html += `<table style="font-family:Calibri,Arial,sans-serif;font-size:11pt;border-collapse:collapse;">`;
    html += `<tr><td colspan="${head.length}" style="font-size:18px;font-weight:bold;color:#1d4ed8;">TCIMS — Events &amp; Activities</td></tr>`;
    html += `<tr><td colspan="${head.length}" style="color:#6b7280;">City of Mandaluyong — CCAT  ·  Generated: ${stamp()}</td></tr>`;
    html += `<tr>${head.map(h => `<th style="background:#1d4ed8;color:#fff;border:1px solid #b6c7e8;padding:7px 9px;text-align:left;">${h}</th>`).join("")}</tr>`;
    exportRows().forEach((row, i) => {
      html += `<tr>${row.map(c => `<td style="border:1px solid #dbe4f2;padding:6px 9px;background:${i % 2 ? "#f5f9ff" : "#ffffff"};">${String(c).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</td>`).join("")}</tr>`;
    });
    html += `</table></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
    const a = document.createElement("a"); a.href = url; a.download = "TCIMS_Events.xls"; a.click(); URL.revokeObjectURL(url);
  };

  // ---- PDF (branded, aligned table) ----
  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const W = 297, H = 210, M = 12;
      const blue = [29, 78, 216], gold = [200, 134, 13], ink = [17, 24, 39], grey = [107, 114, 128];
      const logo = await loadLogo();
      let page = 1;

      const header = () => {
        doc.setFillColor(...blue); doc.rect(0, 0, W, 24, "F");
        if (logo) { try { doc.addImage(logo, "PNG", M, 4, 16, 16); } catch { /* skip */ } }
        doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
        doc.text("TCIMS — Events & Activities", logo ? M + 20 : M, 11);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        doc.text("Tourism & Cultural Information Management System · City of Mandaluyong (CCAT)", logo ? M + 20 : M, 17);
        doc.setDrawColor(...gold); doc.setLineWidth(0.8); doc.line(0, 24, W, 24);
      };
      const footer = () => {
        doc.setFontSize(8); doc.setTextColor(...grey);
        doc.text("Generated: " + stamp(), M, H - 6);
        doc.text("Page " + page, W - M, H - 6, { align: "right" });
      };

      // columns (mm) — sums to W - 2M = 273
      const cols = [
        { t: "#",          w: 10, a: "center" },
        { t: "Event Name", w: 70, a: "left" },
        { t: "Date",       w: 26, a: "left" },
        { t: "Time",       w: 30, a: "left" },
        { t: "Venue",      w: 58, a: "left" },
        { t: "Category",   w: 46, a: "left" },
        { t: "Status",     w: 33, a: "center" },
      ];
      const rowH = 8;
      let y;

      const drawHead = () => {
        header();
        y = 30;
        doc.setFillColor(...blue); doc.rect(M, y, W - 2 * M, rowH, "F");
        doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        let x = M;
        cols.forEach(c => { doc.text(c.t, c.a === "center" ? x + c.w / 2 : x + 2.5, y + 5.4, { align: c.a === "center" ? "center" : "left" }); x += c.w; });
        y += rowH;
      };
      drawHead();

      doc.setFont("helvetica", "normal"); doc.setTextColor(40, 48, 61); doc.setFontSize(8.5);
      exportRows().forEach((row, ri) => {
        // wrap every cell, then size the row to the tallest column
        const cellLines = cols.map((c, ci) => doc.splitTextToSize(String(row[ci]), c.w - 4));
        const lines = Math.max(1, ...cellLines.map(cl => cl.length));
        const rh = Math.max(rowH, lines * 4.4 + 3);
        if (y + rh > H - 12) { footer(); doc.addPage(); page++; drawHead(); doc.setFont("helvetica", "normal"); doc.setTextColor(40, 48, 61); doc.setFontSize(8.5); }
        if (ri % 2) { doc.setFillColor(244, 247, 252); doc.rect(M, y, W - 2 * M, rh, "F"); }
        let x = M;
        cols.forEach((c, ci) => {
          const tx = c.a === "center" ? x + c.w / 2 : x + 2.5;
          doc.text(cellLines[ci], tx, y + 5, { align: c.a === "center" ? "center" : "left" });
          x += c.w;
        });
        y += rh;
      });
      // outer border of the table
      doc.setDrawColor(219, 228, 242); doc.setLineWidth(0.2);
      footer();
      doc.save("TCIMS_Events.pdf");
    } finally { setExporting(false); }
  };

  // Colour by the LIVE (date-derived) status, not the stored field.
  const liveBadge = (ev) => {
    const k = eventStatus(ev).key;
    if (k === "today") return badgeGreen;
    if (k === "ended") return badgeGray;
    if (k === "cancelled") return badgeRed;
    return badgeBlue; // upcoming / scheduled
  };

  const pendingCount = events.filter((e) => e.approvalStatus === "Pending").length;
  const approvalBadge = (s) => s === "Pending" ? badgeAmber : s === "Rejected" ? badgeRed : badgeGreen;

  // group for calendar view (by the event's month/year, from the real date)
  const grouped = (() => {
    const map = {};
    filtered.forEach(e => {
      const dt = e.event_date ? new Date(e.event_date + "T00:00:00") : null;
      const valid = dt && !isNaN(dt);
      const key = valid ? dt.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : (e.month || "Unscheduled");
      const ts = valid ? new Date(dt.getFullYear(), dt.getMonth(), 1).getTime() : Number.MAX_SAFE_INTEGER;
      if (!map[key]) map[key] = { month: key, ts, items: [] };
      map[key].items.push(e);
    });
    return Object.values(map).sort((a, b) => a.ts - b.ts);
  })();

  return (
    <>
      {/* BREADCRUMB */}
      <div style={breadcrumb}>
        <span></span><span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Events</span>
      </div>

      {/* HEADER */}
      <div style={headerRow}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={headerIcon} className="tc-page-icon"><Icon name="calendar" size={26} /></div>
          <div>
            <h1 style={pageTitle}>Events &amp; Visitor Services</h1>
            <p style={pageSub}>Manage city events, festivals, and cultural activities.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={secondaryBtn} className="tc-btn" onClick={() => navigate("/admin/inquiries")}>Visitor Inquiries</button>
          <button style={addBtn} className="tc-btn tc-btn-primary" onClick={openAdd}>+ Add Event</button>
        </div>
      </div>

      {/* Maker-checker notices */}
      {pendingCount > 0 && isApprover && (
        <div style={pendingBanner}>
          <b>{pendingCount}</b> event{pendingCount > 1 ? "s are" : " is"} awaiting your approval. Approved events go
          live on the public events page.
        </div>
      )}
      {!isApprover && (
        <div style={makerBanner}>
          Events you add or edit are submitted for CCAT Admin approval before they appear on the public events page.
        </div>
      )}

      {/* VIEW TOGGLE */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={toggleWrap}>
          <button
            style={{ ...toggleItem, ...(view === "list" ? toggleActive : {}) }}
            onClick={() => setView("list")}
          >☰ List</button>
          <button
            style={{ ...toggleItem, ...(view === "calendar" ? toggleActive : {}) }}
            onClick={() => setView("calendar")}
          >Calendar</button>
        </div>
      </div>

      {/* CARD */}
      <div style={card}>
        <div style={cardToolbar}>
          <div style={searchBox} className="tc-search">
            <span style={{ opacity: 0.5 }}></span>
            <input style={searchInput} className="tc-input" placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ position: "relative" }}>
            <button style={exportBtn} className="tc-btn tc-btn-primary" onClick={() => setExportOpen(o => !o)} disabled={exporting}>
              {exporting ? "Preparing…" : "Export ▾"}
            </button>
            {exportOpen && (
              <>
                <div onClick={() => setExportOpen(false)} style={exportBackdrop} />
                <div style={exportMenu}>
                  <button style={exportItem} onClick={() => { setExportOpen(false); exportPDF(); }}>PDF document (.pdf)</button>
                  <button style={exportItem} onClick={() => { setExportOpen(false); exportExcel(); }}>Excel spreadsheet (.xls)</button>
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading events…</div>
        ) : err ? (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
             {err}
            <div><button style={{ ...addBtn, marginTop: 12 }} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div>
          </div>
        ) : view === "list" ? (
          <table style={tableStyle} className="tc-table">
            <thead>
              <tr>
                <th style={thStyle}>EVENT NAME</th>
                <th style={thStyle}>DATE</th>
                <th style={thStyle}>VENUE</th>
                <th style={{ ...thStyle, textAlign: "center" }}>STATUS</th>
                <th style={{ ...thStyle, textAlign: "center" }}>APPROVAL</th>
                <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0F172A" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {ev.image
                        ? <img src={fileUrl(ev.image)} alt="" style={rowThumb} />
                        : <div style={rowThumbPlaceholder}><Icon name="calendar" size={15} style={{ color: "#c7d0dc" }} /></div>}
                      <span>{ev.name}</span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {dispDate(ev)}
                    {timeRange(ev) && <div style={{ fontSize: 12, color: "#6b7280" }}>{timeRange(ev)}</div>}
                  </td>
                  <td style={tdStyle}>{ev.venue}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={liveBadge(ev)}>{eventStatus(ev).label}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>
                    <span style={approvalBadge(ev.approvalStatus)}>{ev.approvalStatus}</span>
                    {/* Without this, a maker sees "Rejected" but never learns why. */}
                    {ev.approvalStatus === "Rejected" && ev.approvalRemarks && (
                      <div style={remarkNote}>{ev.approvalRemarks}</div>
                    )}
                    {ev.approvalStatus === "Pending" && (
                      <div style={{ ...remarkNote, color: "#92400e" }}>Not yet public</div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "center", whiteSpace: "nowrap" }}>
                    {isApprover && ev.approvalStatus !== "Approved" && (
                      <button style={approveBtn} className="tc-btn" title="Approve and publish" onClick={() => decide(ev, "Approved")} disabled={saving}>Approve</button>
                    )}
                    {isApprover && ev.approvalStatus === "Pending" && (
                      <button style={rejectBtn} className="tc-btn" title="Send back" onClick={() => decide(ev, "Rejected")} disabled={saving}>Reject</button>
                    )}
                    <button style={editBtn} className="tc-btn" title="Edit" onClick={() => openEdit(ev)}>Edit</button>
                    <button style={delBtn} className="tc-btn" title="Delete" onClick={() => deleteEvent(ev.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No events found.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          /* CALENDAR (grouped by month) */
          <div>
            {grouped.map((g) => (
              <div key={g.month} style={{ marginBottom: 22 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#1D4ED8" }}> {g.month}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {g.items.map((ev) => (
                    <div key={ev.id} style={calCard}>
                      {ev.image && <img src={fileUrl(ev.image)} alt="" style={calCardImg} />}
                      <div style={{ fontWeight: 600, color: "#0F172A", marginBottom: 6 }}>{ev.name}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 2 }}>{dispDate(ev)}{timeRange(ev) ? ` · ${timeRange(ev)}` : ""}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{ev.venue}</div>
                      <span style={liveBadge(ev)}>{eventStatus(ev).label}</span>
                      <span style={{ ...badgeGray, marginLeft: 6 }}>{ev.category}</span>
                      {ev.approvalStatus !== "Approved" && (
                        <span style={{ ...approvalBadge(ev.approvalStatus), marginLeft: 6 }}>{ev.approvalStatus}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <div style={{ textAlign: "center", color: "#9ca3af", padding: 20 }}>No events found.</div>}
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div style={modal} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 18px", fontSize: 20, color: "#0F172A" }}>
              {editingId ? "Edit Event" : "Add Event"}
            </h2>

            <label style={fieldLabel}>Event Name</label>
            <input style={fieldInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

            <label style={fieldLabel}>Event Date</label>
            <input type="date" style={fieldInput} value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>Start Time</label>
                <input type="time" style={fieldInput} value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabel}>End Time (optional)</label>
                <input type="time" style={fieldInput} value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>

            <label style={fieldLabel}>Category</label>
            <select style={fieldInput} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <label style={fieldLabel}>Venue</label>
            <input style={fieldInput} value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />

            <label style={fieldLabel}>Description (optional)</label>
            <textarea style={{ ...fieldInput, minHeight: 70, resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short details about the event…" />

            <label style={fieldLabel}>Status</label>
            <select style={fieldInput} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <label style={fieldLabel}>Poster / Banner Image (optional)</label>
            {form.image ? (
              <div style={posterPreviewWrap}>
                <img src={fileUrl(form.image)} alt="Event poster" style={posterPreviewImg} />
                <button type="button" style={posterRemoveBtn} className="tc-btn" onClick={removeImage} disabled={imageUploading}>Remove</button>
              </div>
            ) : (
              <label style={posterDropzone}>
                <Icon name="calendar" size={20} style={{ color: "#9ca3af" }} />
                <span>{imageUploading ? "Uploading…" : "Click to upload an image"}</span>
                <input
                  type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                  style={{ display: "none" }} disabled={imageUploading}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onImageChosen(f); }}
                />
              </label>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button style={cancelBtn} className="tc-btn" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={saveBtn} className="tc-btn tc-btn-primary" onClick={saveEvent} disabled={saving || imageUploading}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Event"}</button>
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
const secondaryBtn = { background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px 18px", fontSize: "15px", cursor: "pointer", whiteSpace: "nowrap" };

const toggleWrap = { display: "inline-flex", background: "#fff", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "4px", gap: "4px" };
const toggleItem = { border: "none", background: "transparent", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", color: "#374151" };
const toggleActive = { background: "#EFF5FF", color: "#1D4ED8", fontWeight: 600 };

const card = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const cardToolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", gap: "16px" };
const searchBox = { flex: 1, maxWidth: 420, display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const exportBtn = { background: "#f1f5f9", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", cursor: "pointer", color: "#374151" };
const exportBackdrop = { position: "fixed", inset: 0, zIndex: 30 };
const exportMenu = { position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: "1px solid #e6ecf5", borderRadius: 12, boxShadow: "0 12px 30px rgba(15,23,42,.15)", padding: 6, zIndex: 40, minWidth: 210 };
const exportItem = { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "10px 12px", borderRadius: 8, fontSize: 13.5, color: "#334155", cursor: "pointer", fontWeight: 600 };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "16px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeGray = { ...badgeBase, background: "#f1f5f9", color: "#6b7280" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const approveBtn = { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", margin: "0 3px" };
const rejectBtn = { background: "#fff", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", margin: "0 3px" };
const remarkNote = { fontSize: 11, color: "#dc2626", marginTop: 4, maxWidth: 150, marginLeft: "auto", marginRight: "auto", lineHeight: 1.35, overflowWrap: "anywhere" };
const pendingBanner = { background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", borderRadius: 12, padding: "12px 16px", fontSize: 14, marginBottom: 16 };
const makerBanner = { background: "#EFF5FF", border: "1px solid #DBE7FF", color: "#123471", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, marginBottom: 16 };
const iconAction = { background: "none", border: "none", cursor: "pointer", fontSize: "16px", margin: "0 4px" };
const editBtn = { background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };
const delBtn = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", margin: "0 3px" };

const calCard = { border: "1px solid #eef2f8", borderRadius: "12px", padding: "16px", background: "#fafbff" };
const calCardImg = { width: "100%", height: "110px", objectFit: "cover", borderRadius: "8px", marginBottom: "10px", display: "block" };

const rowThumb = { width: "40px", height: "40px", borderRadius: "8px", objectFit: "cover", flexShrink: 0, border: "1px solid #eef2f8" };
const rowThumbPlaceholder = { width: "40px", height: "40px", borderRadius: "8px", flexShrink: 0, background: "#f7faff", border: "1px solid #eef2f8", display: "flex", alignItems: "center", justifyContent: "center" };

const posterDropzone = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, height: "100px", borderRadius: "10px", border: "1.5px dashed #d1d5db", background: "#F7FAFF", color: "#6b7280", fontSize: "13px", cursor: "pointer", textAlign: "center" };
const posterPreviewWrap = { position: "relative", borderRadius: "10px", overflow: "hidden", border: "1px solid #e6ecf5" };
const posterPreviewImg = { width: "100%", height: "140px", objectFit: "cover", display: "block" };
const posterRemoveBtn = { position: "absolute", top: 8, right: 8, background: "rgba(15,23,42,0.72)", color: "#fff", border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "12px", cursor: "pointer" };

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal = { background: "#fff", borderRadius: "16px", padding: "26px", width: "460px", maxWidth: "90%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" };
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const fieldInput = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", boxSizing: "border-box" };
const cancelBtn = { background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "14px", color: "#374151" };
const saveBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 18px", cursor: "pointer", fontSize: "14px", fontWeight: 600 };
