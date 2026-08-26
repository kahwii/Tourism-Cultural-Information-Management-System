import { useState, useEffect, useMemo } from "react";
import { apiFeedbackCreate, apiFeedbackMine, apiVisitsMine, apiVisitToggle, apiList, fileUrl } from "../api/api";
import { websiteHref, telHref, hasContact } from "../utils/contact";
import { computePoints, tierFor } from "../utils/gamification";
import { toast } from "../utils/toast";
import { useLanguage } from "../context/LanguageContext";
import { HERITAGE_FIL, spotDescription, categoryLabel, bucketLabel } from "../i18n/translations";

/* ---- legacy image filename fallback (from the old static file convention),
   used only for a place that hasn't had a photo uploaded through the admin
   yet: "San Felipe Neri Church" -> "/places/san-felipe-neri-church.jpg" ---- */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const legacyImgFor = (name) => `/places/${slug(name)}.jpg`;
// A photo uploaded through the admin (Tourist Spots / Heritage Sites) always
// wins; the bundled /places/*.jpg files are a fallback only.
const placeImgSrc = (p) => (p.image ? fileUrl(p.image) : legacyImgFor(p.name));

/* ---- merge spots + heritage, dedupe by normalized name ---- */
const normalize = (s) => s.toLowerCase().replace(/\bparish\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Built per-render (memoized on `lang` + the DB rows) so heritage-church
// descriptions can swap to their Filipino translation when the tourist
// toggles language. Landmarks/institutions/schools/parks don't have a
// curated Filipino description yet, so they fall back to the English text.
//
// `heritageSites` / `touristSpots` come from the database (heritage_sites /
// tourist_spots tables, via apiList) — this used to read a hardcoded array
// from tcimsData.js instead, which meant editing a place in the admin had
// zero effect on what tourists actually saw here.
const buildPlaces = (lang, heritageSites, touristSpots) => {
  const raw = [
    ...heritageSites.map(h => ({
      name: h.name, category: h.category, location: h.location,
      description: (lang === "fil" && HERITAGE_FIL[h.name]?.description) || h.description,
      coordinates: h.coordinates, est: h.est, image: h.image || "",
    })),
    ...touristSpots
      .filter(s => (s.status || "Active") === "Active")
      .map(s => ({
        name: s.name, category: s.category, location: s.address,
        description: spotDescription(s.category || "Others", "Mandaluyong City", lang),
        coordinates: s.coordinates, est: "—", image: s.image || "",
      })),
  ];
  const seen = new Set(); const out = [];
  for (const p of raw) { const k = normalize(p.name); if (seen.has(k)) continue; seen.add(k); out.push(p); }
  return out;
};

/* ---- category buckets + colors ---- */
const bucketOf = (c) => {
  if (/church|abbey|chapel|shrine|parish/i.test(c)) return "Churches";
  if (/landmark|monument|structure|history|cultural/i.test(c)) return "Landmarks";
  if (/institution|health|bank|correctional/i.test(c)) return "Institutions";
  if (/school|university|college/i.test(c)) return "Schools";
  if (/park|special|recreation|sports/i.test(c)) return "Parks & Rec";
  if (/shopping|mall/i.test(c)) return "Shopping";
  return "Others";
};
const GRAD = {
  "Churches": "linear-gradient(135deg,#1e3a8a,#3b82f6)",
  "Landmarks": "linear-gradient(135deg,#7c2d12,#d97706)",
  "Institutions": "linear-gradient(135deg,#334155,#64748b)",
  "Schools": "linear-gradient(135deg,#0e7490,#06b6d4)",
  "Parks & Rec": "linear-gradient(135deg,#166534,#22c55e)",
  "Shopping": "linear-gradient(135deg,#7e22ce,#a855f7)",
  "Others": "linear-gradient(135deg,#475569,#94a3b8)"
};
export default function TouristExplore() {
  const { lang, t } = useLanguage();
  // Heritage sites + tourist spots now come from the database (the admin
  // pages actually affect what's shown here, instead of a hardcoded list).
  const [heritageSites, setHeritageSites] = useState([]);
  const [touristSpots, setTouristSpots] = useState([]);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiList("heritage_sites").catch(() => []),
      apiList("tourist_spots").catch(() => []),
    ]).then(([h, s]) => {
      if (cancelled) return;
      setHeritageSites(Array.isArray(h) ? h : []);
      setTouristSpots(Array.isArray(s) ? s : []);
      setPlacesLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  const PLACES = useMemo(() => buildPlaces(lang, heritageSites, touristSpots), [lang, heritageSites, touristSpots]);
  const BUCKETS = useMemo(() => ["All", ...Array.from(new Set(PLACES.map(p => bucketOf(p.category))))], [PLACES]);
  const [search, setSearch] = useState("");
  const [bucket, setBucket] = useState("All");
  const [visited, setVisited] = useState([]);
  const [detail, setDetail] = useState(null);
  // Contact details for restaurants/hotels/businesses live in separate
  // directory tables and are matched onto a place by normalised name.
  // Tourist spots carry their own contact_no/email/website directly (already
  // fetched above via touristSpots), so only the other three need fetching
  // here. Failure is non-fatal: the page simply shows no contact block
  // rather than breaking the whole Explore view.
  const [contacts, setContacts] = useState({});
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiList("restaurants").catch(() => []),
      apiList("hotels").catch(() => []),
      apiList("tourism_businesses").catch(() => []),
    ]).then((sets) => {
      if (cancelled) return;
      const map = {};
      [...touristSpots, ...sets.flat()].forEach((r) => {
        if (!r?.name || !hasContact(r)) return;
        map[normalize(r.name)] = { contact_no: r.contact_no, email: r.email, website: r.website };
      });
      setContacts(map);
    });
    return () => { cancelled = true; };
  }, [touristSpots]);
  const contactFor = (name) => contacts[normalize(name)] || null;
  const [fb, setFb] = useState(null);
  // No default rating — an untouched 5-star used to silently promote
  // no-polarity comments (e.g. ":(", "pumunta kami noong Sabado") to
  // "Positive" in the sentiment engine's rating tie-break, because the
  // engine couldn't tell "genuinely rated 5 stars" apart from "never
  // touched the widget". Starting at 0 and requiring a real tap fixes
  // that at the source instead of guessing in the classifier.
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fbAll, setFbAll] = useState([]);

  // load the tourist's own submitted feedback from the DB
  const loadFeedback = () => {
    apiFeedbackMine().then(d => setFbAll(Array.isArray(d) ? d : [])).catch(() => setFbAll([]));
  };
  const loadVisited = () => {
    apiVisitsMine().then(d => setVisited(Array.isArray(d) ? d : [])).catch(() => setVisited([]));
  };
  useEffect(() => { loadFeedback(); loadVisited(); }, []);

  const isVisited = (name) => visited.includes(name);

  const ratingFor = (name) => {
    const list = fbAll.filter(f => f.place === name);
    if (!list.length) return null;
    return { avg: (list.reduce((a, b) => a + Number(b.rating), 0) / list.length).toFixed(1), count: list.length };
  };

  const filtered = PLACES.filter(p => {
    const s = [p.name, p.category, p.location].join(" ").toLowerCase().includes(search.toLowerCase());
    const b = bucket === "All" || bucketOf(p.category) === bucket;
    return s && b;
  });

  const visitedCount = visited.filter(v => PLACES.some(p => p.name === v)).length;
  const [checkingIn, setCheckingIn] = useState("");

  // gamification: points + tier from total check-ins & reviews
  const points = computePoints({ checkins: visited.length, reviews: fbAll.length });
  const tier = tierFor(visited.length);

  const checkIn = async (name) => {
    // toggling OFF (un-visit) needs no location check
    if (isVisited(name)) {
      try { await apiVisitToggle(name); loadVisited(); }
      catch (e) { toast.error(e.message || "Failed."); }
      return;
    }
    // Explore check-in is a lightweight self-report (no reward tied to it, just
    // unlocks the feedback form) — unlike the Heritage Trail, it does NOT gate
    // on GPS proximity. Strict location verification stays on the Trail only,
    // since that one hands out the Digital Tourist Badge and needs anti-cheat.
    setCheckingIn(name);
    try {
      await apiVisitToggle(name);
      loadVisited();
      toast.success(`Checked in at "${name}"! +10 points`);
    } catch (e) {
      toast.error(e.message || "Could not check in.");
    } finally {
      setCheckingIn("");
    }
  };
  const openFb = (place) => { setFb(place); setRating(0); setComment(""); setDetail(null); };
  const submitFeedback = async () => {
    if (rating === 0) { toast.error("Please tap a star to rate your visit."); return; }
    setSubmitting(true);
    try {
      const res = await apiFeedbackCreate({ place: fb.name, rating, comment });
      setFb(null);
      loadFeedback();
      toast.success(`Thank you for your feedback! Detected sentiment: ${res?.sentiment || "Neutral"}`);
    } catch (e) {
      toast.error(e.message || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* HERO */}
      <div style={hero}>
        <div style={heroGlow} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.4px" }}>{t("exploreTitle")}</div>
          <div style={{ opacity: 0.9, marginTop: 6, fontSize: 14.5 }}>{t("exploreSubtitle", { n: PLACES.length })}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={heroStat}><b style={{ fontSize: 15 }}>{tier.current.name}</b> · <b>{points}</b> pts</div>
            <div style={heroStat}><b>{visitedCount}</b> {t("placesVisited", { n: PLACES.length })}</div>
          </div>
          <div style={heroProgress}>
            <div style={{ ...heroProgressFill, width: `${PLACES.length ? (visitedCount / PLACES.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div style={searchBox} className="tc-search">
        <input style={searchInput} placeholder={t("searchPlaces")} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* CATEGORY CHIPS */}
      <div style={chips}>
        {BUCKETS.map(b => (
          <button key={b} onClick={() => setBucket(b)} style={{ ...chip, ...(bucket === b ? chipActive : {}) }}>{bucketLabel(b, lang)}</button>
        ))}
      </div>

      {/* CARDS */}
      <div style={grid} className="tc-stagger">
        {filtered.map((p, i) => {
          const b = bucketOf(p.category);
          const isV = isVisited(p.name);
          const r = ratingFor(p.name);
          return (
            <div key={i} style={card} className="card-hover" onClick={() => setDetail(p)}>
              <div style={{ ...cardHead, background: GRAD[b] }}>
                <img src={placeImgSrc(p)} alt="" style={headImg} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div style={headScrim} />
                {p.est && p.est !== "—" && <span style={{ ...estBadge, zIndex: 2 }}>Est. {p.est}</span>}
                {isV && <span style={{ ...visitedBadge, zIndex: 2 }}>✓ {t("visited")}</span>}
                <div style={{ ...cardHeadTitle, zIndex: 2 }}>{p.name}</div>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "#1D4ED8", fontWeight: 600 }}>{categoryLabel(p.category, lang)}</span>
                  {r && <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>★ {r.avg} ({r.count})</span>}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 12px" }}>{p.location}</div>
                <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button style={isV ? checkedBtn : checkBtn} onClick={() => checkIn(p.name)} disabled={checkingIn === p.name}>{checkingIn === p.name ? t("locating") : isV ? t("visited") : t("checkIn")}</button>
                  <button style={fbBtn} onClick={() => openFb(p)}>{t("feedbackBtn")}</button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ color: "#9ca3af", textAlign: "center", gridColumn: "1/-1" }}>
            {placesLoaded ? t("noPlacesFound") : "Loading places…"}
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {detail && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setDetail(null)}>
          <div style={detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ ...detailHero, background: GRAD[bucketOf(detail.category)] }}>
              <img src={placeImgSrc(detail)} alt="" style={headImg} onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div style={headScrim} />
              <button style={{ ...closeBtn, zIndex: 2 }} className="tc-btn" onClick={() => setDetail(null)}>✕</button>
              <div style={{ marginTop: "auto", zIndex: 2 }}>
                {detail.est && detail.est !== "—" && <span style={estBadge}>Est. {detail.est}</span>}
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{detail.name}</div>
                <div style={{ opacity: 0.92, fontSize: 14, marginTop: 4 }}>{detail.location}</div>
              </div>
            </div>
            <div style={{ padding: 22 }}>
              <span style={{ ...chip, ...chipActive, cursor: "default" }}>{categoryLabel(detail.category, lang)}</span>
              {ratingFor(detail.name) && <span style={{ marginLeft: 10, color: "#b45309", fontWeight: 600 }}>★ {ratingFor(detail.name).avg} · {ratingFor(detail.name).count} review(s)</span>}

              <h3 style={secH}>{t("about")}</h3>
              <p style={secP}>{detail.description}</p>

              {contactFor(detail.name) && (
                <>
                  <h3 style={secH}>Contact</h3>
                  <div style={contactBox}>
                    {contactFor(detail.name).contact_no && (
                      <a href={telHref(contactFor(detail.name).contact_no)} style={contactRow}>
                        <span style={contactIcon}>Phone</span>{contactFor(detail.name).contact_no}
                      </a>
                    )}
                    {contactFor(detail.name).email && (
                      <a href={`mailto:${contactFor(detail.name).email}`} style={contactRow}>
                        <span style={contactIcon}>Email</span>{contactFor(detail.name).email}
                      </a>
                    )}
                    {contactFor(detail.name).website && (
                      <a href={websiteHref(contactFor(detail.name).website)} target="_blank" rel="noopener noreferrer" style={contactRow}>
                        <span style={contactIcon}>Website</span>{contactFor(detail.name).website}
                      </a>
                    )}
                  </div>
                </>
              )}

              {fbAll.filter(f => f.place === detail.name).length > 0 && (
                <>
                  <h3 style={secH}>{t("recentReviews")}</h3>
                  {fbAll.filter(f => f.place === detail.name).slice(0, 3).map(f => (
                    <div key={f.id} style={reviewItem}>
                      <div style={{ color: "#EAA31E" }}>{"★".repeat(f.rating)}</div>
                      {f.comment && <div style={{ fontSize: 14, color: "#374151" }}>{f.comment}</div>}
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>{f.reviewer}{f.created_at ? " · " + new Date(String(f.created_at).replace(" ", "T")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</div>
                    </div>
                  ))}
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <button style={isVisited(detail.name) ? checkedBtn : checkBtn} onClick={() => checkIn(detail.name)} disabled={checkingIn === detail.name}>
                  {checkingIn === detail.name ? t("locating") : isVisited(detail.name) ? t("visited") : t("checkIn")}
                </button>
                <button style={fbBtn} onClick={() => openFb(detail)}>{t("leaveFeedback")}</button>
                <button style={mapBtn} onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(detail.name + " Mandaluyong")}`, "_blank")}>{t("viewOnMap")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {fb && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setFb(null)}>
          <div style={modal} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", color: "#0F172A" }}>Rate {fb.name}</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>{t("rateVisit")}</p>
            <div style={{ fontSize: 34, textAlign: "center", marginBottom: 4 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <span
                  key={n}
                  onClick={() => setRating(n)}
                  style={{ color: n <= rating ? "#EAA31E" : "#d1d5db", cursor: "pointer", padding: "0 2px", display: "inline-block" }}
                >★</span>
              ))}
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#9ca3af", textAlign: "center" }}>
              {rating === 0 ? "Tap a star to rate" : `${rating} of 5 stars`}
            </p>
            <textarea style={textarea} placeholder={t("shareExperience")} value={comment} onChange={(e) => setComment(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button style={cancelBtn} className="tc-btn" onClick={() => setFb(null)} disabled={submitting}>{t("cancel")}</button>
              <button style={submitBtn} className="tc-btn tc-btn-primary" onClick={submitFeedback} disabled={submitting || rating === 0}>{submitting ? t("submitting") : t("submit")}</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

/* ================= STYLES ================= */
const hero = { position: "relative", background: "linear-gradient(135deg,#1e40af,#1D4ED8 60%,#3b82f6)", color: "#fff", borderRadius: 20, padding: "28px 26px", marginBottom: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(37,99,235,0.25)" };
const heroGlow = { position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(250,204,21,0.35), transparent 70%)", zIndex: 0 };
const heroStat = { marginTop: 14, display: "inline-block", background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.22)", padding: "8px 14px", borderRadius: 999, fontSize: 14, backdropFilter: "blur(4px)" };
const heroProgress = { marginTop: 16, height: 8, width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.22)", borderRadius: 999, overflow: "hidden" };
const heroProgressFill = { height: "100%", background: "linear-gradient(90deg,#facc15,#fde047)", borderRadius: 999, transition: "width .5s ease" };

const searchBox = { display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e6ecf5", borderRadius: 12, padding: "12px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: 14 };

const chips = { display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0 18px" };
const chip = { background: "#fff", border: "1px solid #e6ecf5", color: "#374151", borderRadius: 999, padding: "8px 16px", fontSize: 14, cursor: "pointer", fontWeight: 500 };
const chipActive = { background: "#1D4ED8", color: "#fff", borderColor: "#1D4ED8", fontWeight: 700 };

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 };
const card = { background: "#fff", borderRadius: 16, border: "1px solid #eef2f8", boxShadow: "0 1px 3px rgba(15,23,42,0.04)", overflow: "hidden", cursor: "pointer" };
const cardHead = { minHeight: 120, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff", position: "relative", overflow: "hidden" };
const headImg = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 };
const headScrim = { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))", zIndex: 1 };
// Capped at 2 lines (with an ellipsis on a 3rd) so a long name like
// "Archdiocesan Shrine of the Divine Mercy" can never grow tall enough to
// run into the "✓ Visited" badge pinned at the top-right of the card.
const cardHeadTitle = {
  fontSize: 17, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.4)", lineHeight: 1.25,
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
};
const estBadge = { alignSelf: "flex-start", background: "rgba(255,255,255,0.25)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6 };
const visitedBadge = { position: "absolute", top: 12, right: 12, background: "#16a34a", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 6 };

const checkBtn = { background: "#eff6ff", color: "#1D4ED8", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const checkedBtn = { background: "#dcfce7", color: "#16a34a", border: "1px solid #bbf7d0", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const fbBtn = { background: "#F5F8FC", color: "#374151", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const mapBtn = { background: "#fef3c7", color: "#b45309", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };

const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 };
const detailModal = { background: "#fff", borderRadius: 18, width: 560, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const contactBox = { display: "flex", flexDirection: "column", gap: 8, background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: 12, padding: "14px 16px" };
const contactRow = { display: "flex", alignItems: "center", gap: 10, color: "#1D4ED8", textDecoration: "none", fontSize: 14, overflowWrap: "anywhere" };
const contactIcon = { fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".4px", minWidth: 58, flexShrink: 0 };
const detailHero = { minHeight: 150, padding: 18, display: "flex", flexDirection: "column", color: "#fff", position: "relative" };
const closeBtn = { position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.25)", color: "#fff", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 14 };
const secH = { margin: "18px 0 6px", fontSize: 16, color: "#0F172A" };
const secP = { margin: 0, fontSize: 14, color: "#4b5563", lineHeight: 1.6 };
const reviewItem = { background: "#f8fafc", border: "1px solid #eef2f8", borderRadius: 10, padding: 12, marginBottom: 8 };

const modal = { background: "#fff", borderRadius: 16, padding: 22, width: 360, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const textarea = { width: "100%", minHeight: 80, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" };
const cancelBtn = { background: "#F5F8FC", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, color: "#374151" };
const submitBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600 };
