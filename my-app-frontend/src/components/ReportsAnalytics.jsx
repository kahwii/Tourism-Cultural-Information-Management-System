import { useState, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { apiList } from "../api/api";
import { buildMonthlyTrend } from "../utils/trend";
import { describe, formatDelta } from "../utils/stats";
import Icon from "./Icon";

const DATE_RANGES = ["This Week", "This Month", "This Quarter", "This Year", "All Time"];

const TOPIC_KEYWORDS = {
  "Cleanliness":   ["clean", "malinis", "dirty", "marumi", "baho"],
  "Staff Service": ["staff", "service", "mabait", "bastos", "rude", "friendly", "helpful"],
  "Accessibility": ["accessible", "access", "malapit", "layo", "transport", "commute"],
  "Food Quality":  ["food", "masarap", "pagkain", "lasa"],
  "Parking":       ["parking", "park"],
  "Safety":        ["safe", "unsafe", "ligtas", "delikado"],
  "Price / Value": ["expensive", "mahal", "affordable", "sulit", "mura"],
};

const parseDate = (d) => { const dt = new Date(String(d).replace(" ", "T")); return isNaN(dt) ? null : dt; };

// Branded tooltip for the Feedback Trend chart (replaces Recharts' plain default box).
const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", border: "1px solid #eef2f8" }}>
      <div style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D4ED8", display: "inline-block" }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{v}</span>
        <span style={{ fontSize: 12.5, color: "#6b7280" }}>review{v === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
};

// Defined at module level, not inside ReportsAnalytics: a component declared
// during render is a brand-new type on every render, so React unmounts and
// remounts it each time instead of updating it.
const Stat = ({ label, value, note }) => (
  <div style={statCell}>
    <div style={statLabel}>{label}</div>
    <div style={statValue}>{value}</div>
    <div style={statNoteSm}>{note}</div>
  </div>
);

const RankTable = ({ title, rows, suffix = "" }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div style={card}>
      <h3 style={cardTitle}>{title}</h3>
      {rows.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>No data yet.</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 14 }}>
            <span style={{ color: "#374151" }}><b style={{ color: "#9ca3af" }}>{i + 1}.</b> {r.name}</span>
            <span style={{ fontWeight: 600, color: "#0F172A" }}>{r.value.toLocaleString()}{suffix}</span>
          </div>
          <div style={barTrack}><div style={{ ...barFill, width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
};

export default function ReportsAnalytics() {
  const [range, setRange] = useState("This Year");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [db, setDb] = useState({ reviews: [], certificates: [], events: [], tourist_spots: [], restaurants: [], hotels: [], tourism_businesses: [], heritage_sites: [] });

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const tables = ["reviews", "certificates", "events", "tourist_spots", "restaurants", "hotels", "tourism_businesses", "heritage_sites"];
      const results = await Promise.all(tables.map(t => apiList(t).catch(() => [])));
      const next = {};
      tables.forEach((t, i) => { next[t] = Array.isArray(results[i]) ? results[i] : []; });
      setDb(next);
    } catch (e) {
      setErr(e.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---- date-range filter (applied to reviews) ----
  const inRange = (dateStr) => {
    if (range === "All Time") return true;
    const d = parseDate(dateStr); if (!d) return true;
    const now = new Date();
    if (range === "This Week")    { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
    if (range === "This Month")   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (range === "This Quarter") return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
    if (range === "This Year")    return d.getFullYear() === now.getFullYear();
    return true;
  };

  const reviews = db.reviews.map(r => ({ ...r, rating: Number(r.rating) || 0 })).filter(r => inRange(r.created_at));

  // ---- the immediately preceding equivalent period ----
  // A comparison is only meaningful against a window of the SAME length:
  // "this month vs last month", not "this month vs everything before it".
  // "All Time" has no prior period by definition, so comparison is skipped.
  const inPrevRange = (dateStr) => {
    if (range === "All Time") return false;
    const d = parseDate(dateStr); if (!d) return false;
    const now = new Date();
    if (range === "This Week") {
      const start = new Date(now); start.setDate(now.getDate() - 14);
      const end = new Date(now);   end.setDate(now.getDate() - 7);
      return d >= start && d < end;
    }
    if (range === "This Month") {
      const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getMonth() === p.getMonth() && d.getFullYear() === p.getFullYear();
    }
    if (range === "This Quarter") {
      const q = Math.floor(now.getMonth() / 3);
      const pq = q === 0 ? 3 : q - 1;
      const py = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return Math.floor(d.getMonth() / 3) === pq && d.getFullYear() === py;
    }
    if (range === "This Year") return d.getFullYear() === now.getFullYear() - 1;
    return false;
  };

  const prevReviews = db.reviews
    .map(r => ({ ...r, rating: Number(r.rating) || 0 }))
    .filter(r => inPrevRange(r.created_at));

  const hasComparison = range !== "All Time" && prevReviews.length > 0;

  // ---- KPIs ----
  const totalReviews = reviews.length;
  const avgRating = totalReviews ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1) : "0.0";
  const positive = reviews.filter(r => r.sentiment === "Positive").length;
  const neutral  = reviews.filter(r => r.sentiment === "Neutral").length;
  const negative = reviews.filter(r => r.sentiment === "Negative").length;
  const positivePct = totalReviews ? Math.round((positive / totalReviews) * 100) : 0;
  const neutralPct  = totalReviews ? Math.round((neutral / totalReviews) * 100) : 0;
  const negativePct = totalReviews ? Math.round((negative / totalReviews) * 100) : 0;

  const approvedCerts = db.certificates.filter(c => c.status === "Approved").length;
  const pendingCerts  = db.certificates.filter(c => c.status === "Under Review").length;
  const rejectedCerts = db.certificates.filter(c => c.status === "Rejected").length;
  const totalEvents   = db.events.length;
  const dirTotal = db.tourist_spots.length + db.restaurants.length + db.hotels.length + db.tourism_businesses.length + db.heritage_sites.length;

  // ---- descriptive statistics on the ratings ----
  const stats = describe(reviews.map(r => r.rating));
  const prevStats = describe(prevReviews.map(r => r.rating));
  const prevPositive = prevReviews.filter(r => r.sentiment === "Positive").length;
  const prevPositivePct = prevReviews.length ? Math.round((prevPositive / prevReviews.length) * 100) : 0;
  const prevNegative = prevReviews.filter(r => r.sentiment === "Negative").length;
  const prevNegativePct = prevReviews.length ? Math.round((prevNegative / prevReviews.length) * 100) : 0;

  // Accreditation/events/directory are point-in-time totals, not per-period
  // counts, so they deliberately carry no comparison — showing a delta there
  // would imply a change within the range that the data can't support.
  const SUMMARY = [
    { label: "Total Reviews", value: totalReviews.toLocaleString(), icon: "", color: "#1D4ED8",
      delta: hasComparison ? formatDelta(totalReviews, prevReviews.length) : null },
    { label: "Average Rating", value: `${avgRating} / 5.0`, icon: "", color: "#EAA31E",
      delta: hasComparison ? formatDelta(stats.mean, prevStats.mean) : null },
    { label: "Positive Sentiment", value: `${positivePct}%`, icon: "", color: "#22c55e",
      delta: hasComparison ? formatDelta(positivePct, prevPositivePct) : null },
    { label: "Negative Sentiment", value: `${negativePct}%`, icon: "", color: "#ef4444",
      // a rise here is bad news, so the arrow colour is inverted
      delta: hasComparison ? formatDelta(negativePct, prevNegativePct, false) : null },
  ];

  const SENTIMENT = [
    { name: "Positive", value: positive, color: "#22c55e" },
    { name: "Neutral",  value: neutral,  color: "#facc15" },
    { name: "Negative", value: negative, color: "#ef4444" },
  ];

  // ---- feedback trend (reviews per month) ----
  // Zero-filled so widely-spaced dates (e.g. imported historical feedback,
  // or a quiet stretch of months) don't visually compress/distort the line —
  // a category axis spaces points evenly regardless of the real time gap.
  const TREND = buildMonthlyTrend(reviews);

  // ---- rankings from reviews ----
  const byPlace = {};
  reviews.forEach(r => {
    const p = r.place || "Unknown";
    byPlace[p] = byPlace[p] || { name: p, count: 0, sum: 0 };
    byPlace[p].count++; byPlace[p].sum += r.rating;
  });
  const places = Object.values(byPlace);
  const mostReviewed = [...places].sort((a, b) => b.count - a.count).slice(0, 8).map(p => ({ name: p.name, value: p.count }));
  const highestRated = [...places].filter(p => p.count >= 1).map(p => ({ name: p.name, value: +(p.sum / p.count).toFixed(1) })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Destinations pulling satisfaction down. More actionable for CCAT than the
  // top performers: these are where intervention actually changes something.
  // Negative-review count is carried alongside the average so a 2.0 based on
  // one review isn't mistaken for a 2.0 based on twenty.
  const needsAttention = [...places]
    .filter(p => p.count >= 1)
    .map(p => ({
      name: p.name,
      avg: +(p.sum / p.count).toFixed(1),
      count: p.count,
      negative: reviews.filter(r => (r.place || "Unknown") === p.name && r.sentiment === "Negative").length,
    }))
    .sort((a, b) => a.avg - b.avg || b.count - a.count)
    .slice(0, 5);

  const directoryBreakdown = [
    { name: "Tourist Spots", value: db.tourist_spots.length },
    { name: "Restaurants", value: db.restaurants.length },
    { name: "Hotels", value: db.hotels.length },
    { name: "Tourism Businesses", value: db.tourism_businesses.length },
    { name: "Heritage Sites", value: db.heritage_sites.length },
    { name: "Events", value: db.events.length },
  ].sort((a, b) => b.value - a.value);

  // ---- topics ----
  const topics = Object.entries(TOPIC_KEYWORDS).map(([topic, kws]) => ({
    topic, count: reviews.filter(r => { const c = (r.comment || "").toLowerCase(); return kws.some(k => c.includes(k)); }).length,
  })).sort((a, b) => b.count - a.count);
  const topTopics = topics.filter(t => t.count > 0).slice(0, 3).map(t => t.topic).join(", ") || "—";

  // ---- exportable reports (real metrics) ----
  const REPORTS = [
    {
      key: "feedback", title: "Visitor Feedback Analytics", icon: "", color: "#1D4ED8",
      desc: "Tourist review volume, ratings, and top-reviewed destinations.",
      metrics: [
        { label: "Total Reviews", value: String(totalReviews) },
        { label: "Average Rating", value: `${avgRating} / 5.0` },
        { label: "Median Rating", value: stats.n ? stats.median.toFixed(1) : "—" },
        { label: "Std. Deviation", value: stats.n ? `${stats.stdDev.toFixed(2)} (${stats.spread})` : "—" },
        { label: "Positive Sentiment", value: `${positivePct}%` },
        { label: "Top Destination", value: mostReviewed[0]?.name || "—" },
      ],
    },
    {
      key: "compliance", title: "Establishment Compliance", icon: "", color: "#EAA31E",
      desc: "Accreditation status of tourism establishments.",
      metrics: [
        { label: "Approved", value: String(approvedCerts) },
        { label: "Under Review", value: String(pendingCerts) },
        { label: "Rejected", value: String(rejectedCerts) },
        { label: "Directory Listings", value: String(dirTotal) },
      ],
    },
    {
      key: "events", title: "Events & Cultural Activities", icon: "", color: "#EAA31E",
      desc: "Calendar of activities and heritage inventory.",
      metrics: [
        { label: "Total Events", value: String(totalEvents) },
        { label: "Heritage Sites", value: String(db.heritage_sites.length) },
        { label: "Tourist Spots", value: String(db.tourist_spots.length) },
      ],
    },
    {
      key: "sentiment", title: "Sentiment & Feedback Analysis", icon: "", color: "#22c55e",
      desc: "Aggregated NLP sentiment scores and common topics.",
      metrics: [
        { label: "Positive", value: `${positivePct}%` },
        { label: "Neutral", value: `${neutralPct}%` },
        { label: "Negative", value: `${negativePct}%` },
        { label: "Top Topics", value: topTopics },
      ],
    },
  ];

  // ---- exporters ----
  const download = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const genStamp = () => new Date().toLocaleString();

  // extra data tables per report (so exports are complete, not just 4 lines)
  const buildExtras = (r) => {
    const ex = [];
    if ((r.key === "feedback" || r.key === "sentiment") && stats.n > 0) {
      ex.push({ title: "Descriptive Statistics (Ratings)", header: ["Measure", "Value"], data: [
        ["Responses (n)", stats.n],
        ["Mean", stats.mean.toFixed(2)],
        ["Median", stats.median.toFixed(1)],
        ["Mode", stats.mode.join(", ") || "—"],
        ["Standard Deviation", `${stats.stdDev.toFixed(2)} (${stats.spread})`],
        ["Range", `${stats.min} – ${stats.max}`],
      ]});
      ex.push({ title: "Rating Distribution", header: ["Rating", "Count", "Share"],
        data: [...stats.distribution].reverse().map(b => [`${b.star} star`, b.count, `${b.pct}%`]) });
    }
    if (r.key === "feedback" || r.key === "sentiment") {
      ex.push({ title: "Sentiment Breakdown", header: ["Sentiment", "Count", "Share"],
        data: [["Positive", positive, positivePct + "%"], ["Neutral", neutral, neutralPct + "%"], ["Negative", negative, negativePct + "%"]] });
    }
    if (r.key === "feedback") {
      if (mostReviewed.length) ex.push({ title: "Top Reviewed Places", header: ["#", "Place", "Reviews"], data: mostReviewed.slice(0, 8).map((p, i) => [i + 1, p.name, p.value]) });
      if (highestRated.length) ex.push({ title: "Highest Rated Places", header: ["#", "Place", "Avg Rating"], data: highestRated.map((p, i) => [i + 1, p.name, p.value]) });
    }
    if (r.key === "sentiment") {
      const tt = topics.filter(t => t.count > 0).slice(0, 7);
      if (tt.length) ex.push({ title: "Top Topics Mentioned", header: ["#", "Topic", "Mentions"], data: tt.map((t, i) => [i + 1, t.topic, t.count]) });
    }
    if (r.key === "compliance") {
      ex.push({ title: "Accreditation Status", header: ["Status", "Count"], data: [["Approved", approvedCerts], ["Under Review", pendingCerts], ["Rejected", rejectedCerts]] });
      ex.push({ title: "Directory Listings", header: ["Category", "Count"], data: directoryBreakdown.map(d => [d.name, d.value]) });
    }
    if (r.key === "events") {
      ex.push({ title: "Inventory Breakdown", header: ["Category", "Count"], data: directoryBreakdown.map(d => [d.name, d.value]) });
    }
    return ex;
  };

  /*
    Full per-review data for the spreadsheet exports.

    The report cards are summaries; this is the underlying evidence — needed to
    verify a figure, to re-analyse the data elsewhere, or to attach as a thesis
    appendix. Included in CSV and Excel only: 100+ rows in the PDF would bury
    the summary the PDF exists to give.

    Only attached to the feedback-related reports, since a compliance or events
    report has no reason to carry review text.
  */
  const rawReviewSection = () => ({
    title: `All Reviews (${reviews.length} records — ${range})`,
    header: ["#", "Date", "Place", "Reviewer", "Rating", "Sentiment", "Comment"],
    data: [...reviews]
      .sort((a, b) => {
        const da = parseDate(a.created_at), db2 = parseDate(b.created_at);
        return (db2 ? db2.getTime() : 0) - (da ? da.getTime() : 0);   // newest first
      })
      .map((rv, i) => [
        i + 1,
        rv.created_at ? (parseDate(rv.created_at)?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? rv.created_at) : "—",
        rv.place || "—",
        rv.reviewer || "Anonymous",
        rv.rating || "—",
        rv.sentiment || "—",
        // Newlines inside a cell break CSV row alignment in some spreadsheet apps.
        String(rv.comment ?? "").replace(/[\r\n]+/g, " ").trim(),
      ]),
  });

  const withRawData = (r) => {
    const secs = buildExtras(r);
    if ((r.key === "feedback" || r.key === "sentiment") && reviews.length) {
      secs.push(rawReviewSection());
    }
    return secs;
  };

  // ---- CSV (with context header + all sections) ----
  const exportCSV = (r) => {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const L = [];
    L.push(esc("TCIMS - " + r.title));
    L.push(esc("City of Mandaluyong - CCAT"));
    L.push(esc("Date Range: " + range));
    L.push(esc("Generated: " + genStamp()));
    L.push(esc(r.desc));
    L.push("");
    L.push("Metric,Value");
    r.metrics.forEach(m => L.push(`${esc(m.label)},${esc(m.value)}`));
    withRawData(r).forEach(sec => {
      L.push("");
      if (sec.title) L.push(esc(sec.title));
      L.push(sec.header.map(esc).join(","));
      sec.data.forEach(row => L.push(row.map(esc).join(",")));
    });
    download(`TCIMS_${r.key}_report.csv`, L.join("\n"), "text/csv;charset=utf-8");
  };

  // ---- Excel (styled HTML .xls) ----
  const exportExcel = (r) => {
    // Review text is written by the public, so it can contain < > & — without
    // escaping, one such character silently corrupts the rest of the sheet.
    const h = (v) => String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const secHtml = (title, header, data) =>
      (title ? `<tr><td colspan="${header.length}" style="background:#1D4ED8;color:#ffffff;font-weight:bold;font-size:13px;padding:8px 6px;">${h(title)}</td></tr>` : "") +
      `<tr>${header.map(x => `<th style="background:#e8f0fe;border:1px solid #b6c7e8;padding:7px 8px;color:#1e3a8a;text-align:left;">${h(x)}</th>`).join("")}</tr>` +
      data.map((row, i) => `<tr>${row.map(c => `<td style="border:1px solid #dbe4f2;padding:6px 8px;background:${i % 2 ? "#f5f9ff" : "#ffffff"};">${h(c)}</td>`).join("")}</tr>`).join("") +
      `<tr><td colspan="${header.length}" style="height:10px;border:none;"></td></tr>`;

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>`;
    html += `<body><table style="font-family:Calibri,Arial,sans-serif;font-size:11pt;border-collapse:collapse;">`;
    html += `<tr><td colspan="3" style="font-size:20px;font-weight:bold;color:#1d4ed8;padding-bottom:2px;">TCIMS — ${r.title}</td></tr>`;
    html += `<tr><td colspan="3" style="color:#6b7280;">Tourism &amp; Cultural Information Management System · City of Mandaluyong — CCAT</td></tr>`;
    html += `<tr><td colspan="3" style="color:#6b7280;">Date Range: ${range}  |  Generated: ${genStamp()}</td></tr>`;
    html += `<tr><td colspan="3" style="color:#374151;padding:4px 0 10px;">${r.desc}</td></tr>`;
    html += secHtml("Key Metrics", ["Metric", "Value"], r.metrics.map(m => [m.label, m.value]));
    withRawData(r).forEach(sec => { html += secHtml(sec.title, sec.header, sec.data); });
    html += `</table></body></html>`;
    download(`TCIMS_${r.key}_report.xls`, html, "application/vnd.ms-excel");
  };

  // ---- PDF (branded, tabular) ----
  const exportPDF = (r) => {
    const doc = new jsPDF();
    const W = 210, M = 14;

    const table = (title, header, data, y) => {
      const tw = W - 2 * M, n = header.length, rowH = 8.5;
      let widths;
      if (n === 2) widths = [tw * 0.62, tw * 0.38];
      else if (n === 3) widths = [tw * 0.12, tw * 0.6, tw * 0.28];
      else widths = header.map(() => tw / n);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); doc.setTextColor(37, 99, 235);
      doc.text(title, M, y); y += 3;
      const top = y;
      // header row
      doc.setFillColor(37, 99, 235); doc.rect(M, y, tw, rowH, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9.5);
      let cx = M; header.forEach((h, i) => { doc.text(String(h), cx + 3, y + 5.8); cx += widths[i]; });
      y += rowH;
      // data rows
      doc.setFont("helvetica", "normal"); doc.setTextColor(55, 65, 81);
      data.forEach((row, ri) => {
        if (ri % 2 === 1) { doc.setFillColor(244, 247, 252); doc.rect(M, y, tw, rowH, "F"); }
        cx = M;
        row.forEach((c, ci) => { doc.text(doc.splitTextToSize(String(c), widths[ci] - 6), cx + 3, y + 5.8); cx += widths[ci]; });
        y += rowH;
      });
      doc.setDrawColor(219, 228, 242); doc.setLineWidth(0.2);
      doc.rect(M, top, tw, (data.length + 1) * rowH);
      return y + 7;
    };

    // header band
    doc.setFillColor(37, 99, 235); doc.rect(0, 0, W, 28, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("TCIMS", M, 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text("Tourism & Cultural Information Management System", M, 19);
    doc.text("City of Mandaluyong - CCAT", M, 23.5);
    // report title + meta
    doc.setTextColor(17, 24, 39); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
    doc.text(r.title, M, 42);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(107, 114, 128);
    doc.text(`Date Range: ${range}      Generated: ${genStamp()}`, M, 49);
    doc.setTextColor(75, 85, 99); doc.setFontSize(10);
    const desc = doc.splitTextToSize(r.desc, W - 2 * M);
    doc.text(desc, M, 57);
    let y = 57 + desc.length * 5 + 6;

    y = table("Key Metrics", ["Metric", "Value"], r.metrics.map(m => [m.label, m.value]), y);
    // Summary sections only — the full per-review listing goes to CSV/Excel,
    // where it can be sorted and filtered, rather than padding the PDF.
    buildExtras(r).forEach(sec => {
      if (y > 250) { doc.addPage(); y = 20; }
      y = table(sec.title, sec.header, sec.data.map(row => row.map(String)), y);
    });

    if ((r.key === "feedback" || r.key === "sentiment") && reviews.length) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
      doc.text(
        doc.splitTextToSize(
          `The complete list of ${reviews.length} individual reviews for this period is included in the Excel and CSV exports of this report.`,
          W - 2 * M),
        M, y);
    }

    doc.setFontSize(8); doc.setTextColor(156, 163, 175);
    doc.text("Generated by TCIMS - for CCAT internal use only.", M, 289);
    doc.save(`TCIMS_${r.key}_report.pdf`);
  };

  // ---- Load the CCAT seal as a data URL so it can be embedded in the PDF ----
  const loadLogo = async () => {
    try {
      const res = await fetch("/mandaluyong-logo.png?v=2");
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  // ---- Auto-written findings: the system interprets its own data in plain English ----
  const buildInsights = () => {
    const out = [];
    const verdict = positivePct >= 70 ? "strongly positive"
      : positivePct >= 55 ? "generally positive"
      : positivePct >= 45 ? "mixed" : "a cause for concern";
    if (totalReviews > 0) {
      out.push(`Overall visitor sentiment for the period is ${verdict}, with ${positivePct}% of ${totalReviews} review(s) classified as positive, ${neutralPct}% neutral, and ${negativePct}% negative. The average visitor rating is ${avgRating} out of 5.0.`);
      // Descriptive statistics stated in words, so the report stands on its own.
      out.push(`Ratings (n = ${stats.n}) have a mean of ${stats.mean.toFixed(2)} and a median of ${stats.median.toFixed(1)}, with ${stats.mode.length > 1 ? "modes" : "a mode"} of ${stats.mode.join(" and ") || "—"}. The standard deviation of ${stats.stdDev.toFixed(2)} indicates responses were ${stats.spread}, ranging from ${stats.min} to ${stats.max}.${stats.mean < stats.median - 0.3 ? " The mean sitting below the median suggests a minority of very low ratings is pulling the average down." : ""}`);
      if (hasComparison) {
        const d = formatDelta(totalReviews, prevReviews.length);
        const s = formatDelta(positivePct, prevPositivePct);
        out.push(`Compared with the previous ${range.replace("This ", "").toLowerCase()}, review volume ${d.text === "no change" ? "held steady" : (d.dir === "up" ? "rose" : "fell") + " by " + d.text.replace(/[+−]/, "")} (${prevReviews.length} → ${totalReviews}), and positive sentiment ${s.text === "no change" ? "was unchanged" : (s.dir === "up" ? "improved" : "declined") + " by " + s.text.replace(/[+−]/, "")} (${prevPositivePct}% → ${positivePct}%).`);
      }
      if (mostReviewed[0]) out.push(`${mostReviewed[0].name} received the most visitor attention with ${mostReviewed[0].value} review(s), making it the most talked-about destination this period.`);
      if (highestRated[0]) out.push(`${highestRated[0].name} earned the highest satisfaction score at ${highestRated[0].value} out of 5.0 and may be highlighted as a model destination.`);
      const worst = [...places].filter(p => p.count >= 1).map(p => ({ name: p.name, avg: p.sum / p.count })).sort((a, b) => a.avg - b.avg)[0];
      if (worst && worst.avg < 3.5) out.push(`${worst.name} recorded the lowest average rating (${worst.avg.toFixed(1)}) and is recommended for priority review and improvement.`);
      if (topTopics !== "—") out.push(`The topics most frequently raised by visitors were: ${topTopics}. These themes should guide the department's next service-improvement actions.`);
    } else {
      out.push("No visitor feedback was recorded for the selected period. Once tourists submit reviews through the Be@Mandaluyong app, this section will summarize their sentiment automatically.");
    }
    out.push(`On accreditation, ${approvedCerts} establishment(s) are fully accredited, ${pendingCerts} are under review, and ${rejectedCerts} were rejected. The tourism directory currently lists ${dirTotal} establishment(s) and destination(s) across the city.`);
    return out;
  };

  // ---- Recommendations derived from the same data ----
  const buildRecommendations = () => {
    const recs = [];
    // Name the destination rather than saying "investigate the low performers" —
    // a recommendation the reader has to decode isn't actionable.
    const worstMeaningful = needsAttention.find(p => p.avg < 3.5 && p.count >= 2) || needsAttention.find(p => p.avg < 3.5);
    if (worstMeaningful) {
      recs.push(`Prioritise ${worstMeaningful.name} for service review — it holds the lowest average rating (${worstMeaningful.avg} / 5.0) across ${worstMeaningful.count} review(s), ${worstMeaningful.negative} of which were negative.`);
    }
    if (stats.n > 0 && stats.stdDev >= 1.4) {
      recs.push(`Visitor ratings are highly polarised (SD ${stats.stdDev.toFixed(2)}). Investigate what separates satisfied from dissatisfied visitors at the same sites, as the overall average conceals this split.`);
    }
    if (negativePct >= 25) recs.push("Address recurring negative feedback: investigate the destinations and service topics with the highest complaint volume.");
    if (pendingCerts > 0) recs.push(`Process the ${pendingCerts} pending accreditation application(s) to keep the tourism directory current.`);
    if (totalEvents === 0) recs.push("Schedule and publish upcoming cultural events to sustain tourist engagement.");
    if (highestRated[0]) recs.push(`Promote top-rated destinations such as ${highestRated[0].name} in city tourism campaigns.`);
    recs.push("Continue monitoring visitor sentiment monthly to detect changes in satisfaction early.");
    return recs;
  };

  // ---- Official consolidated CCAT report (multi-page, branded) ----
  const [officialBusy, setOfficialBusy] = useState(false);
  const exportOfficialReport = async () => {
    setOfficialBusy(true);
    try {
      const doc = new jsPDF();
      const W = 210, H = 297, M = 16;
      const blue = [29, 78, 216], gold = [200, 134, 13], ink = [17, 24, 39], grey = [107, 114, 128];
      const logo = await loadLogo();
      let page = 1;

      const footer = () => {
        doc.setFontSize(8); doc.setTextColor(...grey);
        doc.text("Tourism & Cultural Information Management System — City of Mandaluyong (CCAT)", M, H - 10);
        doc.text(`Page ${page}`, W - M, H - 10, { align: "right" });
      };
      const newPage = () => { footer(); doc.addPage(); page++; };

      // ---------- COVER ----------
      doc.setFillColor(...blue); doc.rect(0, 0, W, H, "F");
      doc.setFillColor(10, 37, 89); doc.rect(0, 210, W, 87, "F");
      if (logo) { try { doc.addImage(logo, "PNG", W / 2 - 22, 46, 44, 44); } catch { /* skip */ } }
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.text("REPUBLIC OF THE PHILIPPINES", W / 2, 104, { align: "center" });
      doc.setFontSize(13);
      doc.text("CITY OF MANDALUYONG", W / 2, 113, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
      doc.text("City Cultural Affairs & Tourism Development Department", W / 2, 121, { align: "center" });
      // gold rule
      doc.setDrawColor(...gold); doc.setLineWidth(1); doc.line(W / 2 - 30, 130, W / 2 + 30, 130);
      doc.setFont("helvetica", "bold"); doc.setFontSize(24);
      doc.text("TOURISM ANALYTICS", W / 2, 155, { align: "center" });
      doc.text("REPORT", W / 2, 167, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(12);
      doc.setTextColor(247, 205, 107);
      doc.text(range, W / 2, 182, { align: "center" });
      doc.setTextColor(226, 232, 240); doc.setFontSize(9.5);
      doc.text("Generated: " + genStamp(), W / 2, 250, { align: "center" });
      doc.text("Powered by TCIMS with Sentiment Analysis", W / 2, 257, { align: "center" });
      doc.text("CONFIDENTIAL — For CCAT internal use only", W / 2, 264, { align: "center" });
      newPage();

      // ---------- EXECUTIVE SUMMARY ----------
      // Auto-numbered: several sections are conditional (comparison only exists
      // when there's a prior period, rankings only when there are reviews), so
      // hardcoded numbers would skip or collide depending on the data.
      let secNo = 0;
      const sectionHead = (t, y) => {
        secNo++;
        doc.setFillColor(...blue); doc.rect(M, y, 3, 7, "F");
        doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(`${secNo}. ${t}`, M + 6, y + 6);
        return y + 14;
      };
      let y = 22;
      y = sectionHead("Executive Summary", y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(55, 65, 81);
      buildInsights().forEach((p) => {
        const lines = doc.splitTextToSize(p, W - 2 * M);
        if (y + lines.length * 5.4 > H - 24) { newPage(); y = 22; }
        doc.text(lines, M, y); y += lines.length * 5.4 + 4;
      });

      // ---------- KPI CARDS ----------
      y += 4;
      if (y > H - 70) { newPage(); y = 22; }
      y = sectionHead("Key Performance Indicators", y);
      const kpis = [
        ["Total Reviews", String(totalReviews)],
        ["Average Rating", `${avgRating} / 5.0`],
        ["Positive Sentiment", `${positivePct}%`],
        ["Accredited Establishments", String(approvedCerts)],
        ["Total Events", String(totalEvents)],
        ["Directory Listings", String(dirTotal)],
      ];
      const cw = (W - 2 * M - 2 * 6) / 3, ch = 22;
      kpis.forEach((k, i) => {
        const col = i % 3, rowi = Math.floor(i / 3);
        const x = M + col * (cw + 6), cy = y + rowi * (ch + 6);
        doc.setFillColor(244, 247, 252); doc.roundedRect(x, cy, cw, ch, 2, 2, "F");
        doc.setDrawColor(...gold); doc.setLineWidth(0.6); doc.line(x, cy, x, cy + ch);
        doc.setTextColor(...blue); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
        doc.text(String(k[1]), x + 5, cy + 11);
        doc.setTextColor(...grey); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(doc.splitTextToSize(k[0], cw - 8), x + 5, cy + 17);
      });
      y += 2 * (ch + 6) + 6;

      // ---------- SENTIMENT DONUT (drawn) ----------
      if (y > H - 80) { newPage(); y = 22; }
      y = sectionHead("Visitor Sentiment", y);
      if (totalReviews > 0) {
        const cx = M + 26, cy = y + 26, R = 22;
        const segs = [[positive, [34, 197, 94]], [neutral, [250, 204, 21]], [negative, [239, 68, 68]]];
        let a0 = -Math.PI / 2;
        segs.forEach(([val, col]) => {
          if (!val) return;
          const a1 = a0 + (val / totalReviews) * Math.PI * 2;
          doc.setFillColor(...col);
          // approximate wedge with triangle fan
          const steps = Math.max(2, Math.ceil((a1 - a0) / 0.2));
          for (let s = 0; s < steps; s++) {
            const t0 = a0 + (a1 - a0) * (s / steps), t1 = a0 + (a1 - a0) * ((s + 1) / steps);
            doc.triangle(cx, cy, cx + Math.cos(t0) * R, cy + Math.sin(t0) * R, cx + Math.cos(t1) * R, cy + Math.sin(t1) * R, "F");
          }
          a0 = a1;
        });
        doc.setFillColor(255, 255, 255); doc.circle(cx, cy, 11, "F");
        doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text(`${positivePct}%`, cx, cy + 1, { align: "center" });
        doc.setFontSize(6.5); doc.setTextColor(...grey); doc.text("positive", cx, cy + 5, { align: "center" });
        // legend
        const lx = M + 62; let ly = y + 8;
        [["Positive", positive, positivePct, [34, 197, 94]], ["Neutral", neutral, neutralPct, [250, 204, 21]], ["Negative", negative, negativePct, [239, 68, 68]]].forEach(([lbl, val, pct, col]) => {
          doc.setFillColor(...col); doc.roundedRect(lx, ly - 3.2, 4, 4, 1, 1, "F");
          doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
          doc.text(`${lbl}`, lx + 7, ly);
          doc.setFont("helvetica", "normal"); doc.setTextColor(...grey);
          doc.text(`${val} review(s)  ·  ${pct}%`, lx + 40, ly);
          ly += 8;
        });
        y = cy + R + 12;
      } else {
        doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...grey);
        doc.text("No reviews recorded for this period.", M, y); y += 10;
      }

      // ---------- TABLES ----------
      const table = (title, header, data) => {
        const rowH = 8, tw = W - 2 * M;
        const n = header.length;
        // Give the name/label column the space; numeric columns need very
        // little. Equal widths would squeeze long destination names into
        // wrapped text that overruns the fixed row height.
        let widths;
        if (n === 2)      widths = [tw * 0.62, tw * 0.38];
        else if (n === 3) widths = [tw * 0.12, tw * 0.6, tw * 0.28];
        else if (n === 4) widths = [tw * 0.34, tw * 0.22, tw * 0.22, tw * 0.22];
        else if (n === 5) widths = [tw * 0.08, tw * 0.46, tw * 0.16, tw * 0.15, tw * 0.15];
        else              widths = header.map(() => tw / n);
        if (y + (data.length + 2) * rowH > H - 20) { newPage(); y = 22; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...blue);
        doc.text(title, M, y); y += 3;
        const top = y;
        doc.setFillColor(...blue); doc.rect(M, y, tw, rowH, "F");
        doc.setTextColor(255, 255, 255); doc.setFontSize(9);
        let cx2 = M; header.forEach((h, i) => { doc.text(String(h), cx2 + 3, y + 5.5); cx2 += widths[i]; });
        y += rowH;
        doc.setFont("helvetica", "normal"); doc.setTextColor(55, 65, 81);
        data.forEach((row, ri) => {
          if (y + rowH > H - 20) { doc.rect(M, top, tw, y - top); newPage(); y = 22; }
          if (ri % 2) { doc.setFillColor(244, 247, 252); doc.rect(M, y, tw, rowH, "F"); }
          cx2 = M; row.forEach((c, ci) => { doc.text(doc.splitTextToSize(String(c), widths[ci] - 5), cx2 + 3, y + 5.5); cx2 += widths[ci]; });
          y += rowH;
        });
        doc.setDrawColor(219, 228, 242); doc.setLineWidth(0.2); doc.rect(M, top, tw, y - top);
        y += 9;
      };

      if (stats.n > 0) {
        y = sectionHead("Descriptive Statistics — Visitor Ratings", y);
        table("", ["Measure", "Value"], [
          ["Responses (n)", String(stats.n)],
          ["Mean", stats.mean.toFixed(2)],
          ["Median", stats.median.toFixed(1)],
          ["Mode", stats.mode.join(", ") || "—"],
          ["Standard Deviation", `${stats.stdDev.toFixed(2)} (${stats.spread})`],
          ["Range", `${stats.min} - ${stats.max}`],
        ]);

        // Drawn distribution rather than another table — the shape of the
        // ratings (clustered vs split at both ends) is the finding here, and
        // a row of numbers hides exactly that.
        const barsH = 5 * 9 + 22;
        if (y + barsH > H - 20) { newPage(); y = 22; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...blue);
        doc.text("Rating Distribution", M, y); y += 7;

        const starCol = { 1: [239, 68, 68], 2: [249, 115, 22], 3: [250, 204, 21], 4: [132, 204, 22], 5: [34, 197, 94] };
        const trackX = M + 16, trackW = W - 2 * M - 16 - 34;
        [...stats.distribution].reverse().forEach((b) => {
          doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
          doc.text(`${b.star} *`, M, y + 3.4);
          doc.setFillColor(238, 242, 248);
          doc.roundedRect(trackX, y, trackW, 4.6, 1.2, 1.2, "F");
          if (b.pct > 0) {
            doc.setFillColor(...starCol[b.star]);
            doc.roundedRect(trackX, y, Math.max(1.6, (trackW * b.pct) / 100), 4.6, 1.2, 1.2, "F");
          }
          doc.setTextColor(107, 114, 128); doc.setFontSize(8.5);
          doc.text(`${b.count} (${b.pct}%)`, W - M, y + 3.4, { align: "right" });
          y += 9;
        });
        y += 6;

        // State the interpretation, so the reader isn't left to infer it.
        const skew = stats.mean < stats.median - 0.3
          ? " The mean sitting below the median indicates a minority of very low ratings is dragging the average down."
          : "";
        const note = `Interpretation: ratings were ${stats.spread} (SD ${stats.stdDev.toFixed(2)}).${skew}${
          stats.stdDev >= 1.4 ? " Visitors are sharply divided rather than broadly agreeing, so the average alone understates the dissatisfaction of the lowest-rating group." : ""}`;
        const nl = doc.splitTextToSize(note, W - 2 * M);
        if (y + nl.length * 5 > H - 20) { newPage(); y = 22; }
        doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.setTextColor(75, 85, 99);
        doc.text(nl, M, y); y += nl.length * 5 + 8;
        doc.setFont("helvetica", "normal");
      }

      // ---------- PERIOD COMPARISON ----------
      if (hasComparison) {
        y = sectionHead(`5. Comparison with Previous ${range.replace("This ", "")}`, y);
        const prevAvg = prevStats.n ? prevStats.mean.toFixed(2) : "—";
        const cmp = [
          ["Total Reviews", String(prevReviews.length), String(totalReviews), formatDelta(totalReviews, prevReviews.length).text],
          ["Average Rating", prevAvg, stats.mean.toFixed(2), formatDelta(stats.mean, prevStats.mean).text],
          ["Positive Sentiment", `${prevPositivePct}%`, `${positivePct}%`, formatDelta(positivePct, prevPositivePct).text],
          ["Negative Sentiment", `${prevNegativePct}%`, `${negativePct}%`, formatDelta(negativePct, prevNegativePct, false).text],
        ];
        table("", ["Measure", "Previous", "Current", "Change"], cmp);
      }
      if (mostReviewed.length) { y = sectionHead("Most Reviewed Destinations", y); table("", ["#", "Destination", "Reviews"], mostReviewed.map((p, i) => [i + 1, p.name, p.value])); }
      if (highestRated.length) { y = sectionHead("Highest Rated Destinations", y); table("", ["#", "Destination", "Avg Rating"], highestRated.map((p, i) => [i + 1, p.name, p.value + " / 5.0"])); }

      // The operational counterpart to the rankings above: where to intervene.
      if (needsAttention.length) {
        y = sectionHead("Destinations Needing Attention", y);
        table("", ["#", "Destination", "Avg", "Reviews", "Negative"],
          needsAttention.map((p, i) => [i + 1, p.name, `${p.avg} / 5.0`, String(p.count), String(p.negative)]));
        const cav = doc.splitTextToSize(
          "Ranked by lowest average rating. Review count is shown so a low average based on a single review is not read as equivalent to one based on many.",
          W - 2 * M);
        if (y + cav.length * 5 > H - 20) { newPage(); y = 22; }
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
        doc.text(cav, M, y); y += cav.length * 5 + 8;
        doc.setFont("helvetica", "normal");
      }

      // What visitors actually talk about — turns free-text feedback into
      // themes the department can act on.
      const topicRows = topics.filter(t => t.count > 0);
      if (topicRows.length) {
        y = sectionHead("Topics Raised by Visitors", y);
        table("", ["#", "Topic", "Mentions"], topicRows.map((t, i) => [i + 1, t.topic, String(t.count)]));
      }

      y = sectionHead("Establishment Compliance", y);
      table("", ["Status", "Count"], [["Approved / Accredited", approvedCerts], ["Under Review", pendingCerts], ["Rejected", rejectedCerts]]);
      table("Tourism Directory", ["Category", "Count"], directoryBreakdown.map(d => [d.name, d.value]));

      // ---------- RECOMMENDATIONS ----------
      if (y > H - 60) { newPage(); y = 22; }
      y = sectionHead("Recommendations", y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(55, 65, 81);
      buildRecommendations().forEach((r, i) => {
        const lines = doc.splitTextToSize(`${i + 1}.  ${r}`, W - 2 * M - 4);
        if (y + lines.length * 5.4 > H - 24) { newPage(); y = 22; }
        doc.text(lines, M, y); y += lines.length * 5.4 + 3;
      });

      // ---------- SIGN-OFF ----------
      y += 10;
      if (y > H - 40) { newPage(); y = 22; }
      doc.setDrawColor(120); doc.setLineWidth(0.3); doc.line(M, y, M + 70, y);
      doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text("NOLAN V. ANGELES", M, y + 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...grey);
      doc.text("Head, City Cultural Affairs & Tourism Development Department", M, y + 11);

      footer();
      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`CCAT_Tourism_Report_${range.replace(/\s+/g, "_")}_${stamp}.pdf`);
    } finally {
      setOfficialBusy(false);
    }
  };

  return (
    <>
      <div style={breadcrumb}>
        <span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Reports</span>
      </div>

      <div style={pageHeader}>
        <div style={headerIcon} className="tc-page-icon"><Icon name="chart" size={26} /></div>
        <div>
          <h1 style={pageTitle}>Reports &amp; Analytics</h1>
          <p style={pageSub}>Live tourism data — reviews, accreditation, events, and directory.</p>
        </div>
      </div>

      <div style={filterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>Date Range:</span>
          <select style={select} value={range} onChange={(e) => setRange(e.target.value)}>
            {DATE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>(applies to review-based metrics)</span>
        </div>
        <button style={filterBtn} onClick={load}>↻ Refresh</button>
      </div>

      {/* ONE-CLICK OFFICIAL REPORT */}
      {!loading && !err && (
        <div style={officialBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
            <div style={officialIcon}><Icon name="file" size={24} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Official CCAT Tourism Report</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", marginTop: 2, lineHeight: 1.45 }}>
                One branded PDF — cover page, executive summary written from the data, KPIs, sentiment,
                rankings, compliance, and recommendations.
              </div>
            </div>
          </div>
          <button style={{ ...officialBtn, opacity: officialBusy ? 0.7 : 1 }} className="tc-btn" onClick={exportOfficialReport} disabled={officialBusy}>
            {officialBusy ? "Generating…" : "Generate Report"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>Loading analytics…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626", padding: 40 }}>{err}<div><button style={filterBtn} onClick={load}>Retry</button></div></div>
      ) : (
      <>
      {/* SUMMARY KPIs */}
      <div style={kpiGrid} className="tc-stagger">
        {SUMMARY.map((s, i) => (
          <div key={i} style={kpiCard}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#0F172A" }}>{s.value}</div>
              {s.delta && (
                <div style={{ ...deltaRow, color: s.delta.good === null ? "#9ca3af" : s.delta.good ? "#16a34a" : "#dc2626" }}>
                  <span style={{ fontWeight: 800 }}>
                    {s.delta.dir === "up" ? "▲" : s.delta.dir === "down" ? "▼" : "•"} {s.delta.text}
                  </span>
                  <span style={{ color: "#9ca3af", fontWeight: 500 }}>vs previous {range.replace("This ", "").toLowerCase()}</span>
                </div>
              )}
            </div>
            <div style={{ ...kpiIcon, background: s.color }}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* DESCRIPTIVE STATISTICS */}
      <div style={card}>
        <h3 style={cardTitle}>Descriptive Statistics — Visitor Ratings</h3>
        {stats.n === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 14 }}>No ratings in this range.</div>
        ) : (
          <>
            <div style={statGrid}>
              <Stat label="Responses (n)" value={stats.n.toLocaleString()} note="ratings analysed" />
              <Stat label="Mean" value={stats.mean.toFixed(2)} note="arithmetic average" />
              <Stat label="Median" value={stats.median.toFixed(1)} note="middle value" />
              <Stat label="Mode" value={stats.mode.join(", ") || "—"} note={stats.mode.length > 1 ? "bimodal" : "most frequent"} />
              <Stat label="Std. Deviation" value={stats.stdDev.toFixed(2)} note={stats.spread} />
              <Stat label="Range" value={`${stats.min} – ${stats.max}`} note="lowest to highest" />
            </div>

            <div style={{ marginTop: 22 }}>
              <div style={metricsLabel}>RATING DISTRIBUTION</div>
              {[...stats.distribution].reverse().map((b) => (
                <div key={b.star} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
                  <span style={{ width: 34, fontSize: 13.5, color: "#374151", fontWeight: 600, flexShrink: 0 }}>{b.star} ★</span>
                  <div style={{ ...barTrack, flex: 1 }}>
                    <div style={{ ...barFill, width: `${b.pct}%`, background: STAR_COLORS[b.star] }} />
                  </div>
                  <span style={{ width: 96, textAlign: "right", fontSize: 13, color: "#6b7280", flexShrink: 0 }}>
                    {b.count.toLocaleString()} ({b.pct}%)
                  </span>
                </div>
              ))}
            </div>

            {/* Plain-language reading of the numbers above */}
            <p style={statNote}>
              Visitors rated an average of <b>{stats.mean.toFixed(2)}</b> out of 5.0
              (median <b>{stats.median.toFixed(1)}</b>, most common rating <b>{stats.mode.join(" and ") || "—"}</b>).
              A standard deviation of <b>{stats.stdDev.toFixed(2)}</b> means responses were <b>{stats.spread}</b>
              {stats.stdDev >= 1.4 ? " — visitors are sharply divided rather than broadly agreeing, so averages alone hide the disagreement." : "."}
            </p>
          </>
        )}
      </div>

      {/* CHARTS */}
      <div style={chartGrid} className="tc-stagger">
        <div style={card}>
          <h3 style={cardTitle}>Feedback Trend (reviews / month)</h3>
          {TREND.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 14 }}>No reviews in this range.</div> : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={TREND} margin={{ top: 16, right: 16, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="vt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.42} />
                  <stop offset="55%" stopColor="#1D4ED8" stopOpacity={0.10} />
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#eef2f8" />
              <XAxis
                dataKey="month" tickLine={false} axisLine={false}
                tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }}
                interval="preserveStartEnd" minTickGap={28} padding={{ left: 12, right: 12 }}
              />
              <YAxis
                tickLine={false} axisLine={false} allowDecimals={false} width={28}
                tick={{ fontSize: 11.5, fill: "#94a3b8", fontWeight: 500 }}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#c7d5f2", strokeWidth: 1, strokeDasharray: "4 4" }} />
              <Area
                type="monotone" dataKey="reviews"
                stroke="#1D4ED8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                fill="url(#vt)" dot={false}
                activeDot={{ r: 6, fill: "#1D4ED8", stroke: "#fff", strokeWidth: 3 }}
                animationDuration={900} animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Sentiment Distribution</h3>
          {totalReviews === 0 ? <div style={{ color: "#9ca3af", fontSize: 14 }}>No reviews in this range.</div> : (
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={SENTIMENT} dataKey="value" innerRadius={75} outerRadius={105} paddingAngle={2}>
                  {SENTIMENT.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={donutCenter}>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#0F172A" }}>{positivePct}%</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>Positive</div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* MOST REVIEWED PLACES (bar) */}
      <div style={card}>
        <h3 style={cardTitle}>Most Reviewed Places</h3>
        {mostReviewed.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 14 }}>No reviews in this range.</div> : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={mostReviewed} layout="vertical" margin={{ left: 40, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="name" type="category" width={170} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1D4ED8" radius={[0, 6, 6, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </div>

      {/* RANK TABLES */}
      <div style={chartGrid} className="tc-stagger">
        <RankTable title="Highest Rated Places" rows={highestRated} suffix=" ★" />
        <RankTable title="Tourism Directory Breakdown" rows={directoryBreakdown} />
      </div>

      {/* EXPORTABLE REPORTS */}
      <h2 style={sectionTitle}>Generate &amp; Export Reports</h2>
      <div style={chartGrid} className="tc-stagger">
        {REPORTS.map((r) => (
          <div key={r.key} style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ ...cardIcon, background: r.color }}>{r.icon}</div>
              <div>
                <h3 style={cardTitle}>{r.title}</h3>
                <p style={cardDesc}>{r.desc}</p>
              </div>
            </div>
            <div style={metricsLabel}>INCLUDED METRICS:</div>
            <ul style={metricsList}>
              {r.metrics.map((m, i) => (
                <li key={i} style={metricItem}><span style={{ color: r.color, marginRight: 8 }}>•</span>{m.label}: <b style={{ marginLeft: 4 }}>{m.value}</b></li>
              ))}
            </ul>
            <div style={btnRow}>
              <button style={pdfBtn} onClick={() => exportPDF(r)}>PDF</button>
              <button style={excelBtn} onClick={() => exportExcel(r)}>Excel</button>
              <button style={csvBtn} onClick={() => exportCSV(r)}>CSV</button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </>
  );
}

/* ================= STYLES ================= */
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const pageHeader = { display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" };
const headerIcon = { width: "52px", height: "52px", borderRadius: "12px", background: "#1D4ED8", color: "#fff", fontSize: "24px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const pageTitle = { margin: 0, fontSize: "26px", color: "#0F172A" };
const pageSub = { margin: "4px 0 0", color: "#6b7280", fontSize: "15px" };

const filterBar = { background: "#fff", border: "1px solid #eef2f8", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" };
const select = { padding: "8px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "14px", cursor: "pointer", fontWeight: 600, color: "#b45309" };
const filterBtn = { background: "#fff", border: "1px solid #d1d5db", borderRadius: "10px", padding: "10px 16px", fontSize: "14px", cursor: "pointer", color: "#374151" };
const officialBar = { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "linear-gradient(135deg,#1D4ED8 0%,#123471 100%)", borderRadius: 16, padding: "18px 20px", marginBottom: 24, boxShadow: "0 10px 26px rgba(29,78,216,.28)" };
const officialIcon = { width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.22)", color: "#F7CD6B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const officialBtn = { background: "#EAA31E", color: "#0A2559", border: "none", borderRadius: 11, padding: "13px 22px", fontSize: 14.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(234,163,30,.4)" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "20px", marginBottom: "24px" };
const kpiCard = { background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" };
const kpiIcon = { width: "44px", height: "44px", borderRadius: "10px", color: "#fff", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

const chartGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "24px", alignItems: "stretch" };
const card = { background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 4px 12px rgba(0,0,0,0.04)", marginBottom: "20px", display: "flex", flexDirection: "column" };
const cardTitle = { margin: "0 0 16px", fontSize: "17px", fontWeight: 700, color: "#0F172A" };
const cardIcon = { width: "44px", height: "44px", borderRadius: "10px", color: "#fff", fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const cardDesc = { margin: "4px 0 0", fontSize: "14px", color: "#6b7280", lineHeight: 1.5 };

const donutCenter = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" };

const barTrack = { width: "100%", height: "9px", background: "#eef2f8", borderRadius: "6px", overflow: "hidden" };
const barFill = { height: "100%", background: "#1D4ED8", borderRadius: "6px" };

/* period-over-period delta shown under each KPI */
const deltaRow = { display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, flexWrap: "wrap" };

/* descriptive statistics panel */
const statGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 };
const statCell = { background: "#F7FAFF", border: "1px solid #eef2f8", borderRadius: 12, padding: "14px 16px", minWidth: 0 };
const statLabel = { fontSize: 11.5, letterSpacing: ".4px", color: "#6b7280", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 };
const statValue = { fontSize: 24, fontWeight: 800, color: "#0F172A", lineHeight: 1.1, overflowWrap: "anywhere" };
const statNoteSm = { fontSize: 11.5, color: "#9ca3af", marginTop: 4 };
const statNote = { margin: "20px 0 0", fontSize: 13.5, color: "#475569", lineHeight: 1.65, background: "#F7FAFF", border: "1px solid #eef2f8", borderRadius: 10, padding: "13px 15px" };
// 1★ red through 5★ green — the colour itself carries the reading
const STAR_COLORS = { 1: "#ef4444", 2: "#f97316", 3: "#facc15", 4: "#84cc16", 5: "#22c55e" };

const sectionTitle = { fontSize: "20px", color: "#0F172A", margin: "8px 0 16px" };

const metricsLabel = { fontSize: "12px", letterSpacing: "0.5px", color: "#9ca3af", fontWeight: 600, marginBottom: 8 };
const metricsList = { listStyle: "none", padding: 0, margin: "0 0 18px", flex: 1 };
const metricItem = { fontSize: "14px", color: "#374151", padding: "3px 0", display: "flex", alignItems: "center" };
const btnRow = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))", gap: "10px" };
const baseBtn = { border: "none", borderRadius: "8px", padding: "10px", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 600 };
const pdfBtn = { ...baseBtn, background: "#fef2f2", color: "#dc2626" };
const excelBtn = { ...baseBtn, background: "#f0fdf4", color: "#16a34a" };
const csvBtn = { ...baseBtn, background: "#f1f5f9", color: "#475569" };
