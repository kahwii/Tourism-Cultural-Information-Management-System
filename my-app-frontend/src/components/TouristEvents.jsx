import { useState, useEffect, useCallback } from "react";
import { apiList, fileUrl } from "../api/api";
import { eventStatus, isLiveForTourist } from "../utils/eventStatus";
import { downloadICS, mapsUrlFor, googleCalendarUrlFor } from "../utils/eventActions";
import { getInterested, toggleInterested } from "../utils/interestedEvents";
import Icon from "./Icon";

// mark the newest event as "seen" so the notification badge clears
export const EVENTS_SEEN_KEY = "tcims_events_seen";

// category -> bucket + color
const META = (c = "") => {
  if (/religious|lenten|marian|saints|sto|cruzan|flores|iglesia|peñafrancia|soul|abandoned/i.test(c)) return { bucket: "Religious", color: "#7c3aed" };
  if (/historical|history|bayani|liberation|kagitingan|rizal|bonifacio|anniversary/i.test(c)) return { bucket: "Historical", color: "#b45309" };
  if (/festival|christmas|maytime|daluyong|paskuhan|pistang|fashion/i.test(c)) return { bucket: "Festival", color: "#dc2626" };
  if (/pageant/i.test(c)) return { bucket: "Pageant", color: "#db2777" };
  if (/arts|cultural|music|literature|heritage|community/i.test(c)) return { bucket: "Arts & Culture", color: "#16a34a" };
  if (/trade|food/i.test(c)) return { bucket: "Trade & Food", color: "#0e7490" };
  if (/observance|week|nutrition|literacy|tourism|archives|museums|library|conference|morning/i.test(c)) return { bucket: "Observance", color: "#1D4ED8" };
  return { bucket: "Other", color: "#475569" };
};

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(String(d) + "T00:00:00");
  return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":");
  const hh = parseInt(h, 10); if (isNaN(hh)) return "";
  const ap = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${m ?? "00"} ${ap}`;
};
const timeRange = (e) => {
  const s = fmtTime(e.start_time), en = fmtTime(e.end_time);
  if (s && en) return `${s} – ${en}`;
  if (s) return `${s} onwards`;
  return en || "";
};

export default function TouristEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("All");
  const [showPast, setShowPast] = useState(false);
  const [interested, setInterested] = useState(() => getInterested());
  const handleToggleInterested = (id) => setInterested(toggleInterested(id));
  const [detailEvent, setDetailEvent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("events");
      // Tourists only ever see CCAT-approved events — anything still pending
      // (or sent back) stays internal to the admin approval queue.
      const list = (Array.isArray(data) ? data : [])
        .filter((e) => (e.approval_status ?? "Approved") === "Approved");
      setEvents(list);
      // mark newest event id as seen -> clears the nav notification badge
      const maxId = list.reduce((mx, e) => Math.max(mx, Number(e.id) || 0), 0);
      localStorage.setItem(EVENTS_SEEN_KEY, String(maxId));
    } catch (e) {
      setErr(e.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const BUCKETS = ["All", ...Array.from(new Set(events.map(e => META(e.category).bucket)))];

  const filtered = events.filter(e => {
    const s = [e.name, e.category, e.venue, e.month, fmtDate(e.event_date)].join(" ").toLowerCase().includes(search.toLowerCase());
    const b = bucket === "All" || META(e.category).bucket === bucket;
    const live = showPast || isLiveForTourist(e);   // finished events auto-hide
    return s && b && live;
  });

  // group by month (from the real date if present, else the stored month)
  const grouped = (() => {
    const map = {};
    filtered.forEach(e => {
      const dt = e.event_date ? new Date(e.event_date + "T00:00:00") : null;
      const valid = dt && !isNaN(dt);
      const key = valid ? dt.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : (e.month || "Scheduled");
      const ts = valid ? new Date(dt.getFullYear(), dt.getMonth(), 1).getTime() : Number.MAX_SAFE_INTEGER;
      if (!map[key]) map[key] = { month: key, ts, items: [] };
      map[key].items.push(e);
    });
    return Object.values(map).sort((a, b) => a.ts - b.ts);
  })();

  return (
    <>
      <style>{`
        .ev-card { transition: transform .15s ease, box-shadow .15s ease; }
        .ev-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.10); }
      `}</style>

      <div style={hero}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Events & Festivals</div>
          <div style={{ opacity: 0.92, marginTop: 6 }}>Discover upcoming cultural events & festivals in Mandaluyong City.</div>
        </div>
        <div style={heroGlow} />
      </div>

      <div style={searchBox} className="tc-search">
        <input style={searchInput} placeholder="Search events..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div style={chips}>
        {BUCKETS.map(b => (
          <button key={b} onClick={() => setBucket(b)} style={{ ...chip, ...(bucket === b ? chipActive : {}) }}>{b}</button>
        ))}
        <button
          onClick={() => setShowPast(p => !p)}
          style={{ ...chip, marginLeft: "auto", ...(showPast ? chipActive : {}) }}
          title="Past events are hidden by default"
        >
          {showPast ? "Hiding past soon" : "Show past events"}
        </button>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", textAlign: "center", marginTop: 30 }}>Loading events…</div>
      ) : err ? (
        <div style={{ color: "#dc2626", textAlign: "center", marginTop: 30 }}>{err}<div><button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div></div>
      ) : (
        <>
          {grouped.map((g) => (
            <div key={g.month} style={{ marginTop: 8 }}>
              <div style={monthHead}>{g.month}</div>
              <div style={grid} className="tc-stagger">
                {g.items.map((e) => {
                  const m = META(e.category);
                  const st = eventStatus(e);
                  const ended = st.key === "ended";
                  const fav = interested.includes(Number(e.id));
                  return (
                    <div
                      key={e.id} className="ev-card"
                      style={{ ...card, borderTop: `4px solid ${m.color}`, opacity: ended ? 0.6 : 1, position: "relative", overflow: "hidden", cursor: "pointer" }}
                      onClick={() => setDetailEvent(e)}
                      title="Click for full details"
                    >
                      <button
                        style={favBtn}
                        onClick={(ev2) => { ev2.stopPropagation(); handleToggleInterested(e.id); }}
                        title={fav ? "Remove from Interested" : "Mark as Interested — we'll notify you the day of the event"}
                      >
                        <Icon name="star" size={16} filled={fav} style={{ color: fav ? "#EAA31E" : "#c7d0dc" }} />
                      </button>
                      {e.image && <img src={fileUrl(e.image)} alt="" style={posterImg} />}
                      <div style={{ padding: 18, display: "flex", flexDirection: "column", height: "100%" }}>
                        <div style={evTopRow}>
                          <span style={{ ...dateBadge, background: m.color + "14", color: m.color }}>
                            <Icon name="calendar" size={14} /> {fmtDate(e.event_date) || g.month}
                          </span>
                          {st.key === "today"
                            ? <span style={todayPill}>Happening Today</span>
                            : ended
                              ? <span style={endedPill}>Ended</span>
                              : (e.category && <span style={{ ...catChip, background: m.color + "1a", color: m.color }}>{m.bucket}</span>)}
                        </div>
                        <div style={{ ...evTitle, paddingRight: 22 }}>{e.name}</div>
                        {timeRange(e) && (
                          <div style={metaRow}><span style={{ ...dot, background: m.color }} />{timeRange(e)}</div>
                        )}
                        {e.venue && (
                          <div style={metaRow}><Icon name="pin" size={14} style={{ color: "#9ca3af", flexShrink: 0 }} /><span>{e.venue}</span></div>
                        )}
                        {e.description && <div style={evDescClamp}>{e.description}</div>}

                        <div style={evActions}>
                          <a
                            href={googleCalendarUrlFor(e)}
                            target="_blank" rel="noopener noreferrer"
                            style={evActionLink}
                            onClick={(ev2) => ev2.stopPropagation()}
                            title="Add this event to Google Calendar"
                          >
                            <Icon name="calendar" size={13} /> Add to Calendar
                          </a>
                          {e.venue && (
                            <a
                              href={mapsUrlFor(e.venue)}
                              target="_blank" rel="noopener noreferrer"
                              style={evActionLink}
                              onClick={(ev2) => ev2.stopPropagation()}
                              title="Open this venue in Google Maps"
                            >
                              <Icon name="pin" size={13} /> View on Map
                            </a>
                          )}
                        </div>
                        <button
                          style={icsLink}
                          onClick={(ev2) => { ev2.stopPropagation(); downloadICS(e); }}
                          title="Download an .ics file for Apple Calendar / Outlook"
                        >
                          Not on Google? Download .ics file
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {grouped.length === 0 && <div style={{ color: "#9ca3af", textAlign: "center", marginTop: 30 }}>No events found.</div>}
        </>
      )}

      {detailEvent && (() => {
        const e = detailEvent;
        const m = META(e.category);
        const st = eventStatus(e);
        const ended = st.key === "ended";
        const fav = interested.includes(Number(e.id));
        return (
          <div style={detailOverlay} onClick={() => setDetailEvent(null)}>
            <div style={detailModal} onClick={(ev2) => ev2.stopPropagation()}>
              <button style={detailCloseBtn} onClick={() => setDetailEvent(null)} title="Close">
                <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
              </button>

              {e.image
                ? <img src={fileUrl(e.image)} alt="" style={detailImg} />
                : <div style={{ ...detailImg, background: `linear-gradient(135deg, ${m.color}, ${m.color}cc)` }} />}

              <div style={detailBody}>
                <div style={evTopRow}>
                  <span style={{ ...dateBadge, background: m.color + "14", color: m.color }}>
                    <Icon name="calendar" size={14} /> {fmtDate(e.event_date) || e.month}
                  </span>
                  {st.key === "today"
                    ? <span style={todayPill}>Happening Today</span>
                    : ended
                      ? <span style={endedPill}>Ended</span>
                      : (e.category && <span style={{ ...catChip, background: m.color + "1a", color: m.color }}>{m.bucket}</span>)}
                </div>

                <div style={detailTitle}>{e.name}</div>

                {timeRange(e) && (
                  <div style={metaRow}><span style={{ ...dot, background: m.color }} />{timeRange(e)}</div>
                )}
                {e.venue && (
                  <div style={metaRow}><Icon name="pin" size={14} style={{ color: "#9ca3af", flexShrink: 0 }} /><span>{e.venue}</span></div>
                )}

                {e.description && <div style={detailDesc}>{e.description}</div>}

                <div style={{ ...evActions, marginTop: 18 }}>
                  <button
                    style={{ ...evActionLink, background: fav ? "#FFF7E6" : "#F7FAFF", color: fav ? "#B8790B" : "#1D4ED8", borderColor: fav ? "#FBE3AE" : "#dbe6fb" }}
                    onClick={() => handleToggleInterested(e.id)}
                  >
                    <Icon name="star" size={13} filled={fav} /> {fav ? "Interested" : "Mark as Interested"}
                  </button>
                  <a
                    href={googleCalendarUrlFor(e)}
                    target="_blank" rel="noopener noreferrer"
                    style={evActionLink}
                    title="Add this event to Google Calendar"
                  >
                    <Icon name="calendar" size={13} /> Add to Calendar
                  </a>
                  {e.venue && (
                    <a
                      href={mapsUrlFor(e.venue)}
                      target="_blank" rel="noopener noreferrer"
                      style={evActionLink}
                      title="Open this venue in Google Maps"
                    >
                      <Icon name="pin" size={13} /> View on Map
                    </a>
                  )}
                </div>
                <button
                  style={icsLink}
                  onClick={() => downloadICS(e)}
                  title="Download an .ics file for Apple Calendar / Outlook"
                >
                  Not on Google? Download .ics file
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

/* ================= STYLES ================= */
const hero = { position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#1d4ed8,#1D4ED8)", color: "#fff", borderRadius: 18, padding: "26px 24px", marginBottom: 18 };
const heroGlow = { position: "absolute", right: -40, top: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.12)" };

const searchBox = { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e6ecf5", borderRadius: 12, padding: "12px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14 };

const chips = { display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 6px" };
const chip = { background: "#fff", border: "1px solid #e6ecf5", color: "#374151", borderRadius: 999, padding: "8px 16px", fontSize: 14, cursor: "pointer", fontWeight: 500 };
const chipActive = { background: "#1D4ED8", color: "#fff", borderColor: "#1D4ED8", fontWeight: 700 };
const retryBtn = { marginTop: 10, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 };

const monthHead = { fontSize: 18, fontWeight: 700, color: "#1D4ED8", margin: "22px 0 14px" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 };
const card = { background: "#fff", borderRadius: 14, border: "1px solid #eef2f8", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" };
const evTopRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 };
const todayPill = { display: "inline-block", padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 800, whiteSpace: "nowrap", background: "#dcfce7", color: "#15803d" };
const endedPill = { display: "inline-block", padding: "4px 11px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: "#f1f5f9", color: "#94a3b8" };
const dateBadge = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" };
const catChip = { display: "inline-block", padding: "4px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" };
const evTitle = { fontWeight: 700, fontSize: 15.5, color: "#0F172A", margin: "2px 0 12px", lineHeight: 1.35 };
const metaRow = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#6b7280", marginBottom: 7 };
const dot = { width: 8, height: 8, borderRadius: "50%", flexShrink: 0, display: "inline-block", marginLeft: 3, marginRight: 3 };
const evDesc = { fontSize: 12.5, color: "#4b5563", lineHeight: 1.55, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F5F8FC" };
const evDescClamp = { ...evDesc, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" };

const evActions = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid #F5F8FC" };
const evActionBtnBase = { flex: "1 1 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", background: "#F7FAFF", color: "#1D4ED8", border: "1px solid #dbe6fb", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none" };
const evActionBtn = { ...evActionBtnBase };
const evActionLink = { ...evActionBtnBase };
const icsLink = { background: "none", border: "none", color: "#9ca3af", fontSize: 11.5, cursor: "pointer", textDecoration: "underline", padding: "6px 0 0", textAlign: "left" };
const favBtn = { position: "absolute", top: 12, right: 12, zIndex: 1, background: "#fff", border: "1px solid #eef2f8", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" };
const posterImg = { width: "100%", height: 150, objectFit: "cover", display: "block" };

const detailOverlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 };
const detailModal = { background: "#fff", borderRadius: 18, width: 520, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", position: "relative" };
const detailCloseBtn = { position: "absolute", top: 14, right: 14, zIndex: 2, background: "rgba(15,23,42,0.55)", color: "#fff", border: "none", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const detailImg = { width: "100%", height: 190, objectFit: "cover", display: "block", borderRadius: "18px 18px 0 0" };
const detailBody = { padding: 22 };
const detailTitle = { fontWeight: 800, fontSize: 20, color: "#0F172A", margin: "6px 0 12px", lineHeight: 1.3 };
const detailDesc = { fontSize: 13.5, color: "#4b5563", lineHeight: 1.65, marginTop: 14, paddingTop: 14, borderTop: "1px solid #F5F8FC" };
