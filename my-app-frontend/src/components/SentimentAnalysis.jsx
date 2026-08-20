import { useState, useEffect, useCallback } from "react";
import { useConfirm } from "./ConfirmDialog";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { apiList, apiRemove, apiReclassifySentiment, apiImportReviews, apiImportBatches, apiDeleteImportBatch } from "../api/api";
import { isProfane, maskWord, maskText } from "../utils/profanity";
import { parseCSV, mapFeedbackRow } from "../utils/csv";
import { toast } from "../utils/toast";
import Icon from "./Icon";

/* ---- Word cloud: common words to ignore (English + Tagalog) ---- */
const STOPWORDS = new Set([
  // English
  "the","a","an","and","or","but","is","are","was","were","be","been","being","to","of","in","on","at","for",
  "with","it","its","this","that","these","those","i","we","you","they","he","she","my","our","your","their",
  "me","us","them","so","very","really","just","too","also","not","no","yes","have","has","had","do","does",
  "did","will","would","can","could","there","here","when","what","which","how","as","by","from","all","some",
  "more","most","much","if","than","then","because","about","again","out","up","down","into","over","after",
  "before","during","while","place","visit","visited","get","got","go","went","one","time","day","na","pa",
  // Tagalog
  "ang","ng","sa","mga","ako","ka","siya","kami","tayo","kayo","sila","ko","mo","niya","namin","natin","ninyo",
  "nila","ito","iyan","iyon","dito","diyan","doon","at","o","pero","kasi","dahil","kung","para","ay","ba","po",
  "naman","lang","din","rin","daw","raw","pala","kaya","yung","yan","yun","si","ni","kay","may","mayroon","wala",
  "hindi","oo","opo","sana","talaga","sobra","sobrang","grabe","medyo","parang","nga","eh","ah","huh","hmm",
]);

/* ---- Topic detection: keyword groups counted across real comments ---- */
const TOPIC_KEYWORDS = {
  "Cleanliness":   ["clean", "malinis", "dirty", "marumi", "baho", "smell"],
  "Staff Service": ["staff", "service", "mabait", "bastos", "rude", "friendly", "helpful", "tulong"],
  "Accessibility": ["accessible", "access", "malapit", "layo", "transport", "commute", "sakay"],
  "Food Quality":  ["food", "masarap", "pagkain", "taste", "lasa"],
  "Parking":       ["parking", "park"],
  "Safety":        ["safe", "unsafe", "ligtas", "delikado"],
  "Price / Value": ["expensive", "mahal", "affordable", "sulit", "mura", "presyo"],
};

export default function SentimentAnalysis() {
  const [confirm, ConfirmUI] = useConfirm();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedReviewer, setSelectedReviewer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiList("reviews");
      setReviews((Array.isArray(data) ? data : []).map(r => ({ ...r, rating: Number(r.rating) || 0 })));
    } catch (e) {
      setErr(e.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(String(d).replace(" ", "T"));
    return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const total = reviews.length;
  const avg = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : 0;

  const positive = reviews.filter(r => r.sentiment === "Positive").length;
  const neutral  = reviews.filter(r => r.sentiment === "Neutral").length;
  const negative = reviews.filter(r => r.sentiment === "Negative").length;
  const positivePct = total ? Math.round((positive / total) * 100) : 0;
  const overall = positivePct >= 60 ? "Positive" : positivePct >= 40 ? "Neutral" : "Negative";

  const sentimentData = [
    { name: "Positive", value: positive, color: "#22c55e" },
    { name: "Neutral",  value: neutral,  color: "#facc15" },
    { name: "Negative", value: negative, color: "#ef4444" }
  ];

  // count how many reviews mention each topic (keyword match)
  const TOPICS = Object.entries(TOPIC_KEYWORDS).map(([topic, kws]) => ({
    topic,
    count: reviews.filter(r => {
      const c = (r.comment || "").toLowerCase();
      return kws.some(k => c.includes(k));
    }).length,
  })).sort((a, b) => b.count - a.count);

  /* ---- Per-place sentiment breakdown ---- */
  const placeMap = {};
  reviews.forEach(r => {
    const p = r.place || "Unspecified";
    if (!placeMap[p]) placeMap[p] = { place: p, Positive: 0, Neutral: 0, Negative: 0, ratings: [] };
    if (placeMap[p][r.sentiment] !== undefined) placeMap[p][r.sentiment] += 1;
    placeMap[p].ratings.push(r.rating);
  });
  const placeStats = Object.values(placeMap)
    .map(p => {
      const t = p.Positive + p.Neutral + p.Negative;
      return {
        ...p,
        total: t,
        avg: p.ratings.length ? (p.ratings.reduce((s, x) => s + x, 0) / p.ratings.length).toFixed(1) : "0.0",
        posPct: t ? Math.round((p.Positive / t) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
  const placeChartData = placeStats.slice(0, 8); // top 8 places by review count

  /* ---- Low-rating alert: flag places where 3+ of their last 5 reviews are
     Negative, so admin catches a developing problem instead of finding out
     from a monthly report. Also surfaces the likely recurring complaint by
     running the same topic keywords used in "Most Mentioned Topics" but
     scoped to just that place's recent negative comments. ---- */
  const byDateDesc = (a, b) =>
    new Date(String(b.created_at).replace(" ", "T")) - new Date(String(a.created_at).replace(" ", "T"));
  const flaggedPlaces = Object.keys(placeMap)
    .map(place => {
      const recent = reviews.filter(r => (r.place || "Unspecified") === place).sort(byDateDesc).slice(0, 5);
      const negCount = recent.filter(r => r.sentiment === "Negative").length;
      if (recent.length < 3 || negCount < 3) return null;

      const negComments = recent.filter(r => r.sentiment === "Negative").map(r => (r.comment || "").toLowerCase());
      let topTopic = null, topHits = 0;
      Object.entries(TOPIC_KEYWORDS).forEach(([topic, kws]) => {
        const hits = negComments.filter(c => kws.some(k => c.includes(k))).length;
        if (hits > topHits) { topTopic = topic; topHits = hits; }
      });

      return { place, negCount, recentCount: recent.length, likelyIssue: topTopic, latest: recent[0] };
    })
    .filter(Boolean)
    .sort((a, b) => b.negCount - a.negCount);

  /* ---- Word cloud: frequency + dominant sentiment per word ---- */
  const wordStats = {};
  reviews.forEach(r => {
    const words = (r.comment || "").toLowerCase().replace(/[^a-záéíóúñ\s'-]/gi, " ").split(/\s+/);
    const seen = new Set(); // count each word once per review
    words.forEach(w => {
      w = w.replace(/^['-]+|['-]+$/g, "");
      if (w.length < 3 || STOPWORDS.has(w) || seen.has(w)) return;
      seen.add(w);
      if (!wordStats[w]) wordStats[w] = { word: w, count: 0, pos: 0, neg: 0 };
      wordStats[w].count += 1;
      if (r.sentiment === "Positive") wordStats[w].pos += 1;
      if (r.sentiment === "Negative") wordStats[w].neg += 1;
    });
  });
  const cloudWords = Object.values(wordStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map((w, i) => {
      const max = Math.max(...Object.values(wordStats).map(x => x.count), 1);
      const size = 13 + Math.round((w.count / max) * 22); // 13px – 35px
      const profane = isProfane(w.word);
      // profanity is always negative; otherwise colour by where the word appears most
      const color = profane ? "#dc2626" : w.pos > w.neg ? "#16a34a" : w.neg > w.pos ? "#dc2626" : "#b45309";
      const display = profane ? maskWord(w.word) : w.word; // fuck -> fu*k
      return { ...w, size, color, display, order: (i * 7) % 40 }; // scatter big words around
    })
    .sort((a, b) => a.order - b.order);

  const filtered = reviews.filter(r =>
    [r.place, r.reviewer, r.comment, r.sentiment].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const deleteReview = async (id) => {
    if (!(await confirm({
      title: "Delete this review?",
      message: "The review and its sentiment result will be permanently removed from the analysis.",
      confirmLabel: "Delete review",
    }))) return;
    try {
      await apiRemove("reviews", id);
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete review.");
    }
  };

  const [reBusy, setReBusy] = useState(false);
  const reanalyze = async () => {
    setReBusy(true);
    try {
      const r = await apiReclassifySentiment();
      toast.success(r.message || "Feedback re-analyzed.");
      await load();
    } catch (e) {
      toast.error(e.message || "Could not re-analyze feedback.");
    } finally {
      setReBusy(false);
    }
  };

  /* ---- Import historical/manual feedback from a CSV spreadsheet ---- */
  const [importRows, setImportRows] = useState(null);   // parsed+mapped rows, or null when no file chosen
  const [importFileName, setImportFileName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null); // { imported, skipped, errors }

  const onImportFileChosen = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file later
    if (!file) return;
    setImportResult(null);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCSV(String(reader.result)).map(mapFeedbackRow);
        setImportRows(parsed);
      } catch {
        toast.error("Could not read that file. Make sure it's a plain CSV.");
        setImportRows(null);
        setImportFileName("");
      }
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  };

  const importValidRows = (importRows || []).filter(
    (r) => (r.place || "").trim() && Number(r.rating) >= 1 && Number(r.rating) <= 5
  );
  const importInvalidCount = (importRows?.length || 0) - importValidRows.length;

  const closeImport = () => {
    setImportRows(null);
    setImportFileName("");
    setImportResult(null);
  };

  const confirmImport = async () => {
    if (importValidRows.length === 0) return;
    setImportBusy(true);
    // One batch id for the whole file, even if it's chunked into multiple
    // requests — so the entire import can be undone as a single unit later.
    const batchId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    let imported = 0, skipped = importInvalidCount, errors = [];
    try {
      const CHUNK = 500;
      for (let i = 0; i < importValidRows.length; i += CHUNK) {
        const chunk = importValidRows.slice(i, i + CHUNK);
        const r = await apiImportReviews(chunk, batchId);
        imported += r.imported || 0;
        skipped += r.skipped || 0;
        errors = errors.concat(r.errors || []);
      }
      setImportResult({ imported, skipped, errors, batch: batchId });
      toast.success(`Imported ${imported} review(s).`);
      await load();
    } catch (e) {
      toast.error(e.message || "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

  /* ---- Manage / undo past import batches ---- */
  const [batches, setBatches] = useState(null);   // null = modal closed, array = open
  const [batchesBusy, setBatchesBusy] = useState(false);

  const openBatches = async () => {
    setBatches([]); // opens the modal immediately with a loading state
    setBatchesBusy(true);
    try {
      const data = await apiImportBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || "Could not load import history.");
      setBatches(null);
    } finally {
      setBatchesBusy(false);
    }
  };

  const deleteBatch = async (batch, rowCount) => {
    if (!(await confirm({
      title: "Delete this whole import?",
      message: `This removes all ${rowCount} review(s) from this import batch. This cannot be undone.`,
      confirmLabel: "Delete batch",
    }))) return;
    try {
      const r = await apiDeleteImportBatch(batch);
      toast.success(`Removed ${r.deleted} review(s).`);
      setBatches((bs) => bs.filter((b) => b.batch !== batch));
      await load();
    } catch (e) {
      toast.error(e.message || "Could not delete batch.");
    }
  };

  const sentimentBadge = (s) =>
    s === "Positive" ? badgeGreen : s === "Negative" ? badgeRed : badgeAmber;

  return (
    <>
      {/* BREADCRUMB */}
      <div style={breadcrumb}>
        <span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Sentiment</span>
      </div>

      {/* HEADER */}
      <div style={{ ...pageHeader, justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={headerIcon} className="tc-page-icon"><Icon name="message" size={26} /></div>
          <div>
            <h1 style={pageTitle}>Sentiment Analysis</h1>
            <p style={pageSub}>Analyze tourist feedback and reviews using automated NLP categorization.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={importBtn} className="tc-btn" onClick={openBatches}>
            <Icon name="folder" size={15} style={{ marginRight: 7 }} /> Manage imports
          </button>
          <label style={importBtn} className="tc-btn">
            <Icon name="upload" size={15} style={{ marginRight: 7 }} /> Import feedback (CSV)
            <input type="file" accept=".csv,text/csv" onChange={onImportFileChosen} style={{ display: "none" }} />
          </label>
          <button style={reanalyzeBtn} className="tc-btn tc-btn-primary" onClick={reanalyze} disabled={reBusy}>
            <Icon name="history" size={15} style={{ marginRight: 7, verticalAlign: -3 }} /> {reBusy ? "Re-analyzing…" : "Re-analyze all feedback"}
          </button>
        </div>
      </div>

      {/* IMPORT PREVIEW / RESULT MODAL */}
      {importRows !== null && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => !importBusy && closeImport()}>
          <div style={modalCard} className="tc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0F172A" }}>
                  {importResult ? "Import complete" : "Import historical feedback"}
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>{importFileName}</p>
              </div>
              {!importBusy && (
                <button style={modalCloseBtn} className="tc-btn" onClick={closeImport}>✕</button>
              )}
            </div>

            <div style={modalBody}>
              {importResult ? (
                <>
                  <p style={{ margin: "0 0 10px", fontSize: 14, color: "#374151" }}>
                    <strong style={{ color: "#16a34a" }}>{importResult.imported} imported</strong>
                    {importResult.skipped > 0 && (
                      <> — <strong style={{ color: "#dc2626" }}>{importResult.skipped} skipped</strong></>
                    )}
                  </p>
                  {importResult.errors.length > 0 && (
                    <div style={{ background: "#FEF2F2", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#B91C1C" }}>
                      {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                    {importResult.imported > 0 && (
                      <button
                        style={{ flex: 1, background: "#FEF2F2", color: "#dc2626", border: "none", borderRadius: 11, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }}
                        onClick={async () => {
                          if (!(await confirm({
                            title: "Undo this import?",
                            message: `This removes all ${importResult.imported} review(s) you just imported.`,
                            confirmLabel: "Undo import",
                          }))) return;
                          try {
                            await apiDeleteImportBatch(importResult.batch);
                            toast.success("Import undone.");
                            await load();
                            closeImport();
                          } catch (e) {
                            toast.error(e.message || "Could not undo import.");
                          }
                        }}
                      >
                        Undo this import
                      </button>
                    )}
                    <button style={{ ...reanalyzeBtn, flex: 1 }} className="tc-btn tc-btn-primary" onClick={closeImport}>
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 14px", fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                    Detected <strong>{importRows.length}</strong> row(s) —{" "}
                    <strong style={{ color: "#16a34a" }}>{importValidRows.length} ready to import</strong>
                    {importInvalidCount > 0 && (
                      <> · <strong style={{ color: "#dc2626" }}>{importInvalidCount} missing a place or valid rating (1-5), will be skipped</strong></>
                    )}
                    . Each row runs through the same sentiment engine used for live feedback.
                  </p>

                  {importValidRows.length > 0 && (
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #eef2f8", borderRadius: 10 }}>
                      <table style={tableStyle} className="tc-table">
                        <thead>
                          <tr>
                            <th style={thStyle}>PLACE</th>
                            <th style={thStyle}>REVIEWER</th>
                            <th style={thStyle}>RATING</th>
                            <th style={thStyle}>COMMENT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importValidRows.slice(0, 8).map((r, i) => (
                            <tr key={i}>
                              <td style={tdStyle}>{r.place}</td>
                              <td style={tdStyle}>{r.reviewer || "Anonymous"}</td>
                              <td style={tdStyle}>{r.rating} ★</td>
                              <td style={{ ...tdStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.comment || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importValidRows.length > 8 && (
                        <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "8px 0" }}>
                          + {importValidRows.length - 8} more row(s) not shown
                        </p>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    <button style={{ flex: 1, background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 11, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: "pointer" }} onClick={closeImport} disabled={importBusy}>
                      Cancel
                    </button>
                    <button
                      style={{ ...reanalyzeBtn, flex: 1 }}
                      className="tc-btn tc-btn-primary"
                      onClick={confirmImport}
                      disabled={importBusy || importValidRows.length === 0}
                    >
                      {importBusy ? "Importing…" : `Import ${importValidRows.length} review(s)`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANAGE IMPORTS MODAL */}
      {batches !== null && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setBatches(null)}>
          <div style={modalCard} className="tc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0F172A" }}>Manage imports</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                  Every CSV import you've done — delete a whole batch anytime.
                </p>
              </div>
              <button style={modalCloseBtn} className="tc-btn" onClick={() => setBatches(null)}>✕</button>
            </div>

            <div style={modalBody}>
              {batchesBusy ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>Loading…</p>
              ) : batches.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                  No CSV imports yet. Rows added via "Import feedback (CSV)" will show up here.
                </p>
              ) : (
                batches.map((b) => (
                  <div key={b.batch} style={{ ...reviewItem, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#0F172A" }}>
                        {b.row_count} review(s) · {b.place_count} place(s)
                      </div>
                      <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
                        Imported {fmtDate(b.imported_at)} by {b.imported_by || "admin"}
                      </div>
                    </div>
                    <button
                      style={{ background: "#FEF2F2", color: "#dc2626", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      onClick={() => deleteBatch(b.batch, b.row_count)}
                    >
                      Delete batch
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>Loading reviews…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626", padding: 40 }}>
          {err}
          <div><button style={iconAction} className="tc-btn" onClick={load}>Retry</button></div>
        </div>
      ) : total === 0 ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>
          No reviews yet. They will appear here once tourists submit feedback through the Be@Mandaluyong app.
        </div>
      ) : (
      <>
      {/* LOW-RATING ALERT */}
      {flaggedPlaces.length > 0 && (
        <div style={alertCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={alertIcon}><Icon name="bell" size={18} /></div>
            <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#92400e" }}>
              {flaggedPlaces.length} place{flaggedPlaces.length > 1 ? "s" : ""} need{flaggedPlaces.length > 1 ? "" : "s"} attention
            </h3>
          </div>
          <p className="tc-alert-indent" style={{ margin: "0 0 14px 0", fontSize: 13, color: "#92400e", opacity: 0.85 }}>
            Most of their recent reviews came back Negative — worth a closer look before it becomes a pattern.
          </p>
          <div className="tc-alert-indent" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {flaggedPlaces.map((f) => (
              <div key={f.place} style={alertRow} onClick={() => setSelectedPlace(f.place)}>
                <div>
                  <span style={{ fontWeight: 700, color: "#0F172A" }}>{f.place}</span>
                  <span style={{ marginLeft: 10, fontSize: 12.5, color: "#dc2626", fontWeight: 700 }}>
                    {f.negCount} of last {f.recentCount} reviews negative
                  </span>
                  {f.likelyIssue && (
                    <span style={likelyIssueTag}>Likely issue: {f.likelyIssue}</span>
                  )}
                </div>
                <span style={{ fontSize: 13, color: "#1D4ED8", fontWeight: 600, whiteSpace: "nowrap" }}>View reviews →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI CARDS */}
      <div style={kpiGrid} className="tc-stagger">
        <div style={kpiCard}>
          <div>
            <div style={kpiLabel}>Total Reviews Analyzed</div>
            <div style={kpiValue}>{total}</div>
          </div>
          <div style={{ ...kpiIcon, background: "#1D4ED8" }}></div>
        </div>
        <div style={kpiCard}>
          <div>
            <div style={kpiLabel}>Average Rating</div>
            <div style={kpiValue}>{avg} / 5.0</div>
          </div>
          <div style={{ ...kpiIcon, background: "#EAA31E" }}></div>
        </div>
        <div style={kpiCard}>
          <div>
            <div style={kpiLabel}>Overall Sentiment</div>
            <div style={kpiValue}>{overall}</div>
            <div style={{ fontSize: 13, color: "#22c55e", marginTop: 6, fontWeight: 600 }}>↑ {positivePct}% positive</div>
          </div>
          <div style={{ ...kpiIcon, background: "#22c55e" }}></div>
        </div>
      </div>

      {/* CHARTS */}
      <div style={chartGrid} className="tc-stagger">
        <div style={card}>
          <h3 style={cardTitle}>Sentiment Distribution</h3>
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" innerRadius={75} outerRadius={105} paddingAngle={2}>
                  {sentimentData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={donutCenter}>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#0F172A" }}>{positivePct}%</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Positive</div>
            </div>
          </div>
          <div style={legendRow}>
            <span><span style={{ ...dot, background: "#ef4444" }} /> Negative</span>
            <span><span style={{ ...dot, background: "#facc15" }} /> Neutral</span>
            <span><span style={{ ...dot, background: "#22c55e" }} /> Positive</span>
          </div>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Most Mentioned Topics</h3>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={TOPICS} layout="vertical" margin={{ left: 30, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 120]} />
              <YAxis dataKey="topic" type="category" width={90} />
              <Tooltip />
              <Bar dataKey="count" fill="#1D4ED8" radius={[0, 6, 6, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PER-PLACE SENTIMENT + WORD CLOUD */}
      <div style={chartGrid} className="tc-stagger">
        <div style={card}>
          <h3 style={cardTitle}>Sentiment by Place</h3>
          <p style={{ margin: "-8px 0 14px", fontSize: 13, color: "#6b7280" }}>
            Positive / Neutral / Negative reviews per destination (top {placeChartData.length}).
          </p>
          <ResponsiveContainer width="100%" height={Math.max(240, placeChartData.length * 42)}>
            <BarChart data={placeChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="place" type="category" width={130} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="Positive" stackId="s" fill="#22c55e" barSize={18} />
              <Bar dataKey="Neutral"  stackId="s" fill="#facc15" barSize={18} />
              <Bar dataKey="Negative" stackId="s" fill="#ef4444" barSize={18} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={legendRow}>
            <span><span style={{ ...dot, background: "#22c55e" }} /> Positive</span>
            <span><span style={{ ...dot, background: "#facc15" }} /> Neutral</span>
            <span><span style={{ ...dot, background: "#ef4444" }} /> Negative</span>
          </div>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Feedback Word Cloud</h3>
          <p style={{ margin: "-8px 0 14px", fontSize: 13, color: "#6b7280" }}>
            Most frequent words in tourist comments — <span style={{ color: "#16a34a", fontWeight: 600 }}>green</span> appear
            mostly in positive reviews, <span style={{ color: "#dc2626", fontWeight: 600 }}>red</span> in negative.
          </p>
          {cloudWords.length === 0 ? (
            <div style={{ color: "#9ca3af", textAlign: "center", padding: "40px 0" }}>Not enough comments yet.</div>
          ) : (
            <div style={cloudBox}>
              {cloudWords.map((w) => (
                <span
                  key={w.word}
                  title={`"${w.display}" — mentioned in ${w.count} review(s)`}
                  style={{ fontSize: w.size, color: w.color, fontWeight: w.size > 24 ? 700 : 600, lineHeight: 1.4, cursor: "default" }}
                >
                  {w.display}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PLACE LEADERBOARD */}
      <div style={card}>
        <h3 style={cardTitle}>Place Performance</h3>
        <p style={{ margin: "-8px 0 14px", fontSize: 13, color: "#6b7280" }}>
          Click a place to read every review left for it.
        </p>
        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}>PLACE</th>
              <th style={thStyle}>REVIEWS</th>
              <th style={thStyle}>AVG RATING</th>
              <th style={thStyle}>% POSITIVE</th>
              <th style={thStyle}>SENTIMENT MIX</th>
            </tr>
          </thead>
          <tbody>
            {placeStats.map((p) => (
              <tr key={p.place} style={placeRow} onClick={() => setSelectedPlace(p.place)}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#1D4ED8" }}>{p.place}</td>
                <td style={tdStyle}>{p.total}</td>
                <td style={tdStyle}>{p.avg} ★</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: p.posPct >= 60 ? "#16a34a" : p.posPct >= 40 ? "#b45309" : "#dc2626" }}>{p.posPct}%</td>
                <td style={tdStyle}>
                  <div style={mixBar}>
                    {p.Positive > 0 && <div style={{ flex: p.Positive, background: "#22c55e" }} />}
                    {p.Neutral  > 0 && <div style={{ flex: p.Neutral,  background: "#facc15" }} />}
                    {p.Negative > 0 && <div style={{ flex: p.Negative, background: "#ef4444" }} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PLACE REVIEWS MODAL */}
      {selectedPlace && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setSelectedPlace(null)}>
          <div style={modalCard} className="tc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0F172A" }}>{selectedPlace}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                  {reviews.filter(r => (r.place || "Unspecified") === selectedPlace).length} review(s) — newest first
                </p>
              </div>
              <button style={modalCloseBtn} className="tc-btn" onClick={() => setSelectedPlace(null)}>✕</button>
            </div>

            <div style={modalBody}>
              {reviews
                .filter(r => (r.place || "Unspecified") === selectedPlace)
                .sort((a, b) => new Date(String(b.created_at).replace(" ", "T")) - new Date(String(a.created_at).replace(" ", "T")))
                .map((r) => (
                  <div key={r.id} style={reviewItem}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>{r.reviewer || "Anonymous"}</span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>{fmtDate(r.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 10px" }}>
                      <span style={{ fontSize: 13, color: "#374151" }}>{r.rating} ★</span>
                      <span style={sentimentBadge(r.sentiment)}>{r.sentiment}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                      {r.comment
                        ? maskText(r.comment)
                        : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No written comment — rating only.</span>}
                    </p>
                  </div>
                ))}
              {reviews.filter(r => (r.place || "Unspecified") === selectedPlace).length === 0 && (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>No reviews for this place yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVIEWER REVIEWS MODAL */}
      {selectedReviewer && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setSelectedReviewer(null)}>
          <div style={modalCard} className="tc-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: "#0F172A" }}>{selectedReviewer}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>
                  {reviews.filter(r => r.reviewer === selectedReviewer).length} review(s) by this user — newest first
                </p>
              </div>
              <button style={modalCloseBtn} className="tc-btn" onClick={() => setSelectedReviewer(null)}>✕</button>
            </div>

            <div style={modalBody}>
              {reviews
                .filter(r => r.reviewer === selectedReviewer)
                .sort((a, b) => new Date(String(b.created_at).replace(" ", "T")) - new Date(String(a.created_at).replace(" ", "T")))
                .map((r) => (
                  <div key={r.id} style={reviewItem}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>{r.place || "Unspecified"}</span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>{fmtDate(r.created_at)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0 10px" }}>
                      <span style={{ fontSize: 13, color: "#374151" }}>{r.rating} ★</span>
                      <span style={sentimentBadge(r.sentiment)}>{r.sentiment}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                      {r.comment
                        ? maskText(r.comment)
                        : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>No written comment — rating only.</span>}
                    </p>
                  </div>
                ))}
              {reviews.filter(r => r.reviewer === selectedReviewer).length === 0 && (
                <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>No reviews from this user yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MANAGEMENT */}
      <h2 style={sectionTitle}>Review Management</h2>
      <div style={card}>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
          Click a reviewer's name to see every review that user has left.
        </p>
        <div style={{ marginBottom: 16 }}>
          <div style={searchBox} className="tc-search">
            <input style={searchInput} className="tc-input" placeholder="Search reviews..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <table style={tableStyle} className="tc-table">
          <thead>
            <tr>
              <th style={thStyle}>REVIEWER</th>
              <th style={thStyle}>PLACE</th>
              <th style={thStyle}>RATING</th>
              <th style={thStyle}>SENTIMENT</th>
              <th style={thStyle}>DATE</th>
              <th style={{ ...thStyle, textAlign: "center" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td
                  style={{ ...tdStyle, fontWeight: 600, color: "#1D4ED8", cursor: "pointer" }}
                  onClick={() => setSelectedReviewer(r.reviewer)}
                  title="View all reviews by this user"
                >
                  {r.reviewer || "Anonymous"}
                </td>
                <td style={tdStyle}>{r.place || "—"}</td>
                <td style={tdStyle}>{r.rating} ★</td>
                <td style={tdStyle}><span style={sentimentBadge(r.sentiment)}>{r.sentiment}</span></td>
                <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <button style={iconAction} className="tc-btn" title="Delete" onClick={() => deleteReview(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }} colSpan={6}>No reviews found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      </>
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

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "20px", marginBottom: "24px" };
const kpiCard = { background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", minHeight: "120px" };
const kpiLabel = { fontSize: 14, color: "#6b7280", marginBottom: 10 };
const kpiValue = { fontSize: 28, fontWeight: 700, color: "#0F172A" };
const kpiIcon = { width: "48px", height: "48px", borderRadius: "12px", color: "#fff", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

const chartGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "24px", alignItems: "stretch" };
const card = { background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", marginBottom: "20px" };
const cardTitle = { margin: "0 0 16px", fontSize: "18px", fontWeight: 700, color: "#0F172A" };
const donutCenter = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" };
const legendRow = { display: "flex", justifyContent: "center", gap: "20px", marginTop: "12px", fontSize: "14px", color: "#374151" };
const dot = { display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", marginRight: "6px" };

const alertCard = { background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1px solid #fde68a", borderRadius: "16px", padding: "20px 22px", marginBottom: "24px" };
const alertIcon = { width: 30, height: 30, borderRadius: 9, background: "#EAA31E", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const alertRow = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, background: "rgba(255,255,255,0.6)", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", cursor: "pointer" };
const likelyIssueTag = { marginLeft: 10, fontSize: 12, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 9px", borderRadius: 999, fontWeight: 600 };

const sectionTitle = { fontSize: "20px", color: "#0F172A", margin: "8px 0 16px" };
const cloudBox = { display: "flex", flexWrap: "wrap", gap: "10px 16px", alignItems: "center", justifyContent: "center", padding: "16px 8px", minHeight: 220 };
const mixBar = { display: "flex", height: 10, width: 140, borderRadius: 999, overflow: "hidden", background: "#f1f5f9" };

const searchBox = { display: "flex", alignItems: "center", gap: "8px", background: "#F7FAFF", border: "1px solid #e6ecf5", borderRadius: "10px", padding: "10px 14px", maxWidth: 460 };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };

const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { padding: "12px 14px", textAlign: "left", fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", borderBottom: "1px solid #eef2f8" };
const tdStyle = { padding: "16px 14px", borderBottom: "1px solid #f1f5f9", fontSize: "14px", color: "#374151" };

const badgeBase = { padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" };
const badgeGreen = { ...badgeBase, background: "#dcfce7", color: "#16a34a" };
const badgeAmber = { ...badgeBase, background: "#fef3c7", color: "#b45309" };
const badgeRed = { ...badgeBase, background: "#fee2e2", color: "#dc2626" };
const iconAction = { background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#dc2626" };
const reanalyzeBtn = { background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff", border: "none", borderRadius: 11, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(29,78,216,.28)" };
const importBtn = { background: "#fff", color: "#1D4ED8", border: "1.5px solid #1D4ED8", borderRadius: 11, padding: "11px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center" };

/* ---- Place reviews modal ---- */
const placeRow = { cursor: "pointer" };
const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
};
const modalCard = {
  background: "#fff", borderRadius: 18, width: 560, maxWidth: "100%", maxHeight: "80vh",
  display: "flex", flexDirection: "column", boxShadow: "0 24px 56px rgba(10,37,89,.24)", overflow: "hidden",
};
const modalHeader = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  padding: "22px 24px", borderBottom: "1px solid #eef2f8", flexShrink: 0,
};
const modalCloseBtn = {
  background: "#F1F5F9", color: "#334155", border: "none", borderRadius: 9,
  width: 32, height: 32, fontSize: 14, cursor: "pointer", flexShrink: 0,
};
const modalBody = { padding: "12px 24px 22px", overflowY: "auto" };
const reviewItem = { padding: "14px 0", borderBottom: "1px solid #f1f5f9" };
