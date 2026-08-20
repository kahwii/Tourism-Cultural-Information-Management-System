import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiPublicEvents, apiInquirySubmit, fileUrl } from "../api/api";
import { eventStatus } from "../utils/eventStatus";
import { toast } from "../utils/toast";
import Icon from "./Icon";

/*
  PUBLIC events page — reachable at /events with NO login.
  Shows only CCAT-approved events, plus the Visitor Inquiry form.
*/

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(String(d) + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10);
  if (isNaN(hh)) return "";
  const ap = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${m ?? "00"} ${ap}`;
};
const timeRange = (e) => {
  const s = fmtTime(e.start_time), en = fmtTime(e.end_time);
  if (s && en) return `${s} – ${en}`;
  if (s) return `${s} onwards`;
  return en || "";
};

// NOTE: the honeypot key must NOT be a name browsers recognise for autofill
// ("website", "url", "company", etc.) — Chrome happily fills those even when
// the input is hidden and autoComplete="off", which made real submissions look
// like bots and get silently dropped. "tcims_hp" is meaningless to autofill.
// Fixed list — kept in sync with $ALLOWED_CATEGORIES in api/inquiries.php.
// Categorising at submission is what lets CCAT see which topics visitors
// ask about most, instead of a shapeless pile of messages.
const INQUIRY_CATEGORIES = [
  "Events & Festivals",
  "Tourist Spots",
  "Heritage Sites",
  "Business Accreditation",
  "General Inquiry",
];

const EMPTY_INQUIRY = { name: "", email: "", subject: "", category: "", message: "", tcims_hp: "" };

export default function PublicEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [showPast, setShowPast] = useState(false);

  const [inq, setInq] = useState(EMPTY_INQUIRY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [refNo, setRefNo] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiPublicEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Could not load events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isPast = (e) => eventStatus(e).key === "ended";
  const filtered = events
    .filter((e) => (showPast ? true : !isPast(e)))
    .filter((e) => [e.name, e.venue, e.category, e.month].join(" ").toLowerCase().includes(search.toLowerCase()));

  // group by month for a calendar-style listing
  const grouped = (() => {
    const map = {};
    filtered.forEach((e) => {
      const dt = e.event_date ? new Date(e.event_date + "T00:00:00") : null;
      const valid = dt && !isNaN(dt);
      const key = valid ? dt.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : (e.month || "Unscheduled");
      const ts = valid ? new Date(dt.getFullYear(), dt.getMonth(), 1).getTime() : Number.MAX_SAFE_INTEGER;
      if (!map[key]) map[key] = { month: key, ts, items: [] };
      map[key].items.push(e);
    });
    return Object.values(map).sort((a, b) => a.ts - b.ts);
  })();

  const badgeFor = (e) => {
    const k = eventStatus(e).key;
    if (k === "today") return badgeGreen;
    if (k === "ended") return badgeGray;
    if (k === "cancelled") return badgeRed;
    return badgeBlue;
  };

  const scrollToInquiry = () => {
    const el = document.getElementById("inquiry");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // focus the first field once the scroll settles, so they can type right away
    setTimeout(() => document.getElementById("inq-name")?.focus(), 450);
  };

  const submitInquiry = async (e) => {
    e.preventDefault();
    if (!inq.name.trim()) return toast.error("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inq.email)) return toast.error("Please enter a valid email address.");
    if (!inq.category) return toast.error("Please choose what your inquiry is about.");
    if (inq.message.trim().length < 10) return toast.error("Please describe your inquiry in a little more detail.");
    setSending(true);
    try {
      const res = await apiInquirySubmit(inq);
      setRefNo(res?.ref_no || "");
      setSent(true);
      setInq(EMPTY_INQUIRY);
    } catch (e2) {
      toast.error(e2.message || "Could not send your inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={page}>
      {/* HEADER */}
      <header style={topBar}>
        <div style={topInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/mandaluyong-logo.png?v=2" alt="City of Mandaluyong" style={{ width: 42, height: 42, objectFit: "contain" }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: ".3px" }}>Be@Mandaluyong</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.72)" }}>Events &amp; Visitor Services</div>
            </div>
          </div>
          <Link to="/login" style={signInLink}>Sign in</Link>
        </div>
      </header>

      <div style={container}>
        {/* HERO */}
        <div style={hero}>
          <h1 style={heroTitle}>City Events &amp; Activities</h1>
          <p style={heroSub}>
            Festivals, cultural programs, and community activities from the City Cultural Affairs &amp;
            Tourism Development Department. Open to everyone — no account needed.
          </p>
          {/* Jump straight to the inquiry form so visitors don't have to scroll
              past the whole events list to ask a question. */}
          <button type="button" style={inquiryCta} onClick={scrollToInquiry}>
            <Icon name="message" size={17} />
            Have a question? Send an inquiry
          </button>
        </div>

        {/* TOOLBAR */}
        <div style={toolbar}>
          <div style={searchBox}>
            <Icon name="calendar" size={16} style={{ color: "#9ca3af", flexShrink: 0 }} />
            <input
              style={searchInput}
              placeholder="Search events, venues, or categories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label style={pastToggle}>
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
            Include past events
          </label>
        </div>

        {/* EVENTS */}
        {loading ? (
          <div style={stateBox}>Loading events…</div>
        ) : err ? (
          <div style={{ ...stateBox, color: "#dc2626" }}>
            {err}
            <div><button style={retryBtn} onClick={load}>Retry</button></div>
          </div>
        ) : grouped.length === 0 ? (
          <div style={stateBox}>
            {search ? "No events match your search." : "No upcoming events posted yet. Please check back soon."}
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.month} style={{ marginBottom: 28 }}>
              <h2 style={monthHead}>{g.month}</h2>
              <div style={eventGrid}>
                {g.items.map((ev) => (
                  <article key={ev.id} style={eventCard}>
                    {ev.image ? (
                      <img src={fileUrl(ev.image)} alt="" style={eventImg} />
                    ) : (
                      <div style={eventImgPlaceholder}><Icon name="calendar" size={26} style={{ color: "#c7d0dc" }} /></div>
                    )}
                    <div style={{ padding: "14px 16px 16px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={badgeFor(ev)}>{eventStatus(ev).label}</span>
                        {ev.category && <span style={badgeGray}>{ev.category}</span>}
                      </div>
                      <h3 style={eventName}>{ev.name}</h3>
                      <div style={eventMeta}>
                        {fmtDate(ev.event_date)}{timeRange(ev) ? ` · ${timeRange(ev)}` : ""}
                      </div>
                      {ev.venue && <div style={eventMeta}>{ev.venue}</div>}
                      {ev.description && <p style={eventDesc}>{ev.description}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        {/* VISITOR INQUIRY */}
        <section style={inquiryCard} id="inquiry">
          <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#0F172A" }}>Visitor Inquiry</h2>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6b7280", lineHeight: 1.55 }}>
            Have a question about an event, a tourist spot, or visiting Mandaluyong?
            Send it to the CCAT office and we'll reply by email.
          </p>

          {sent ? (
            <div style={sentBox}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Inquiry sent</div>
              {refNo && (
                <div style={refBox}>
                  <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".5px", opacity: 0.75, marginBottom: 3 }}>
                    Your reference number
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: ".5px" }}>{refNo}</div>
                </div>
              )}
              <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                Thank you for reaching out. The CCAT office has received your inquiry and will reply to your
                email address within three (3) working days. We've also sent an acknowledgment to your inbox
                {refNo ? " with this reference number" : ""} — please keep it in case you need to follow up.
              </div>
              <button style={{ ...retryBtn, marginTop: 14 }} onClick={() => { setSent(false); setRefNo(""); }}>
                Send another inquiry
              </button>
            </div>
          ) : (
            <form onSubmit={submitInquiry} autoComplete="off">
              <div style={inqRow}>
                <div>
                  <label style={fieldLabel}>Your Name *</label>
                  <input id="inq-name" style={fieldInput} value={inq.name} onChange={(e) => setInq({ ...inq, name: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <label style={fieldLabel}>Email Address *</label>
                  <input style={fieldInput} type="email" value={inq.email} onChange={(e) => setInq({ ...inq, email: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div style={inqRow}>
                <div>
                  <label style={fieldLabel}>What is this about? *</label>
                  <select style={fieldInput} value={inq.category} onChange={(e) => setInq({ ...inq, category: e.target.value })} required>
                    <option value="" disabled>Select…</option>
                    {INQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Subject</label>
                  <input style={fieldInput} value={inq.subject} onChange={(e) => setInq({ ...inq, subject: e.target.value })} placeholder="e.g. Mandaluyong Day parade" autoComplete="off" />
                </div>
              </div>

              <label style={fieldLabel}>Your Inquiry *</label>
              <textarea
                style={{ ...fieldInput, minHeight: 110, resize: "vertical", fontFamily: "inherit" }}
                value={inq.message}
                onChange={(e) => setInq({ ...inq, message: e.target.value })}
                maxLength={2000}
                placeholder="Tell us how we can help…"
              />
              <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>{inq.message.length}/2000</div>

              {/* Honeypot — hidden from real visitors, filled in by bots.
                  autoComplete="new-password" is the one value Chrome reliably
                  refuses to autofill, which keeps real submissions from being
                  mistaken for bot traffic. */}
              <input
                type="text" name="tcims_hp" tabIndex={-1} autoComplete="new-password"
                value={inq.tcims_hp} onChange={(e) => setInq({ ...inq, tcims_hp: e.target.value })}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
                aria-hidden="true"
              />

              <button type="submit" style={sendBtn} disabled={sending}>
                {sending ? "Sending…" : "Send Inquiry"}
              </button>
            </form>
          )}
        </section>

        <footer style={footer}>
          City Cultural Affairs &amp; Tourism Development Department · City of Mandaluyong
          <div style={{ marginTop: 4 }}>© {new Date().getFullYear()} TCIMS</div>
        </footer>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const page = { minHeight: "100vh", background: "#F5F8FC", fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const topBar = { background: "linear-gradient(135deg,#1D4ED8,#123471)", borderBottom: "3px solid #EAA31E" };
const topInner = { maxWidth: 1100, margin: "0 auto", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" };
const signInLink = { background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", borderRadius: 9, padding: "8px 18px", fontSize: 14, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" };

const container = { maxWidth: 1100, margin: "0 auto", padding: "26px 20px 40px" };
const hero = { marginBottom: 22 };
const heroTitle = { margin: "0 0 6px", fontSize: 28, color: "#0F172A", letterSpacing: "-.3px" };
const heroSub = { margin: 0, fontSize: 15, color: "#64748B", lineHeight: 1.6, maxWidth: 680 };

const toolbar = { display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 22 };
const searchBox = { flex: 1, minWidth: 240, display: "flex", alignItems: "center", gap: 9, background: "#fff", border: "1px solid #e6ecf5", borderRadius: 11, padding: "11px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14, color: "#374151" };
const pastToggle = { display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "#374151", whiteSpace: "nowrap", cursor: "pointer" };

const stateBox = { background: "#fff", border: "1px solid #eef2f8", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#6b7280", fontSize: 15 };
const retryBtn = { marginTop: 12, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" };

const monthHead = { margin: "0 0 12px", fontSize: 17, color: "#1D4ED8", fontWeight: 700 };
const eventGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 };
const eventCard = { background: "#fff", border: "1px solid #eef2f8", borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const eventImg = { width: "100%", height: 150, objectFit: "cover", display: "block" };
const eventImgPlaceholder = { width: "100%", height: 150, background: "#F7FAFF", display: "flex", alignItems: "center", justifyContent: "center" };
const eventName = { margin: "0 0 8px", fontSize: 16, color: "#0F172A", lineHeight: 1.35 };
const eventMeta = { fontSize: 13, color: "#6b7280", marginBottom: 3 };
const eventDesc = { margin: "9px 0 0", fontSize: 13, color: "#64748B", lineHeight: 1.55 };

const badgeBase = { padding: "3px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, display: "inline-block" };
const badgeBlue = { ...badgeBase, background: "#dbeafe", color: "#1D4ED8" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeGray = { ...badgeBase, background: "#f1f5f9", color: "#6b7280" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };

const inquiryCta = { display: "inline-flex", alignItems: "center", gap: 9, marginTop: 16, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 11, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(29,78,216,.25)" };
const inquiryCard = { background: "#fff", border: "1px solid #eef2f8", borderRadius: 16, padding: "26px", marginTop: 34, boxShadow: "0 4px 12px rgba(0,0,0,0.04)", position: "relative", scrollMarginTop: 20 };
const inqRow = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 };
const fieldLabel = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const fieldInput = { width: "100%", padding: "11px 13px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" };
const sendBtn = { marginTop: 18, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 10, padding: "13px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const sentBox = { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "18px 20px", color: "#166534" };
const refBox = { background: "#fff", border: "1px dashed #86efac", borderRadius: 10, padding: "10px 14px", margin: "0 0 12px", display: "inline-block", color: "#15803d" };

const footer = { textAlign: "center", color: "#94A3B8", fontSize: 12.5, marginTop: 38, lineHeight: 1.7 };
