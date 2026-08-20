import { useState, useEffect, useCallback } from "react";
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { apiList } from "../api/api";
import { buildMonthlyTrend } from "../utils/trend";
import Icon from "./Icon";

// Branded tooltip for the Feedback Trend chart (replaces Recharts' plain default box).
const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const v = payload[0].value;
  return (
    <div style={trendTooltip}>
      <div style={{ fontSize: 11.5, color: "#9ca3af", fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D4ED8", display: "inline-block" }} />
        <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{v}</span>
        <span style={{ fontSize: 12.5, color: "#6b7280" }}>review{v === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [db, setDb] = useState({ reviews: [], certificates: [], tourist_spots: [], restaurants: [], hotels: [], tourism_businesses: [], events: [], heritage_sites: [], visits: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const tables = ["reviews", "certificates", "tourist_spots", "restaurants", "hotels", "tourism_businesses", "events", "heritage_sites", "visits"];
      const results = await Promise.all(tables.map(t => apiList(t).catch(() => [])));
      const next = {};
      tables.forEach((t, i) => { next[t] = Array.isArray(results[i]) ? results[i] : []; });
      setDb(next);
    } catch (e) {
      setErr(e.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reviews = db.reviews.map(r => ({ ...r, rating: Number(r.rating) || 0 }));
  const totalSpots = db.tourist_spots.length;
  const establishments = db.restaurants.length + db.hotels.length + db.tourism_businesses.length;
  const totalReviews = reviews.length;
  const pending = db.certificates.filter(c => c.status === "Under Review").length;

  const positive = reviews.filter(r => r.sentiment === "Positive").length;
  const neutral  = reviews.filter(r => r.sentiment === "Neutral").length;
  const negative = reviews.filter(r => r.sentiment === "Negative").length;
  const positivePct = totalReviews ? Math.round((positive / totalReviews) * 100) : 0;
  const SENTIMENT = [
    { name: "Positive", value: positive, color: "#22c55e" },
    { name: "Neutral",  value: neutral,  color: "#facc15" },
    { name: "Negative", value: negative, color: "#ef4444" },
  ];

  // feedback trend (reviews per month) — zero-filled so widely-spaced dates
  // (e.g. imported historical feedback) don't visually compress/distort the line
  const TREND = buildMonthlyTrend(reviews);

  // most visited places (from real check-ins)
  const byPlace = {};
  db.visits.forEach(v => { const p = v.place || "Unknown"; byPlace[p] = (byPlace[p] || 0) + 1; });
  const MOST = Object.entries(byPlace).map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits).slice(0, 5);
  const maxVisits = Math.max(1, ...MOST.map(m => m.visits));

  return (
    <>
      <div style={breadcrumb}>
        <span style={{ opacity: 0.5 }}>›</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>Dashboard</span>
      </div>

      <h1 style={pageTitle} className="fade-up">Dashboard Overview</h1>
      <p style={pageSub}>Tourism and Cultural Information Management System — City of Mandaluyong.</p>

      {loading ? (
        <div style={{ ...card, textAlign: "center", color: "#64748B", padding: 40 }}><div className="tc-spinner" />Loading dashboard…</div>
      ) : err ? (
        <div style={{ ...card, textAlign: "center", color: "#dc2626", padding: 40 }}>{err}<div><button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div></div>
      ) : (
      <>
      {/* KPI CARDS */}
      <div style={kpiGrid} className="tc-stagger">
        <KpiCard label="Total Tourist Spots" value={totalSpots} iconName="pin" accent="#1D4ED8" sub="Destinations in directory" />
        <KpiCard label="Registered Establishments" value={establishments} iconName="store" accent="#EAA31E" sub="Restaurants, hotels & businesses" />
        <KpiCard label="Total Reviews" value={totalReviews.toLocaleString()} iconName="message" accent="#1D4ED8" sub="Visitor feedback collected" />
        <KpiCard label="Pending Accreditations" value={pending} iconName="file" accent="#EAA31E" sub="Awaiting admin review" />
      </div>

      {/* CHARTS */}
      <div style={chartGrid} className="tc-stagger">
        <div style={card} className="card-hover">
          <div style={cardHeader}>
            <div>
              <h3 style={cardTitle}>Feedback Trend</h3>
              <p style={cardSub}>Reviews submitted per month</p>
            </div>
          </div>
          {TREND.length === 0 ? <div style={emptyTxt}>No reviews yet.</div> : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={TREND} margin={{ top: 16, right: 16, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#visGrad)" dot={false}
                activeDot={{ r: 6, fill: "#1D4ED8", stroke: "#fff", strokeWidth: 3 }}
                animationDuration={900} animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <div style={card} className="card-hover">
          <div style={cardHeader}>
            <div>
              <h3 style={cardTitle}>Overall Sentiment</h3>
              <p style={cardSub}>Based on {totalReviews.toLocaleString()} analyzed reviews</p>
            </div>
          </div>
          {totalReviews === 0 ? <div style={emptyTxt}>No reviews yet.</div> : (
          <>
          <div style={{ position: "relative" }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={SENTIMENT} dataKey="value" innerRadius={78} outerRadius={112} paddingAngle={2} stroke="none">
                  {SENTIMENT.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={donutCenter}>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>{positivePct}%</div>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Positive</div>
            </div>
          </div>
          <div style={legendRow}>
            {SENTIMENT.map((s) => (
              <div key={s.name} style={legendItem}>
                <span style={{ ...legendDot, background: s.color }} />
                <span style={{ color: "#6b7280" }}>{s.name}</span>
                <span style={{ fontWeight: 700, color: "#0F172A" }}>{s.value}</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </div>

      {/* MOST VISITED LOCATIONS */}
      <div style={card} className="card-hover">
        <div style={cardHeader}>
          <div>
            <h3 style={cardTitle}>Most Visited Locations</h3>
            <p style={cardSub}>Ranked by verified visitor check-ins</p>
          </div>
        </div>
        {MOST.length === 0 ? <div style={emptyTxt}>No check-ins yet.</div> : MOST.map((loc, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={rankBadge}>{i + 1}</span>
                <span style={{ fontSize: 14, color: "#374151", fontWeight: 500 }}>{loc.name}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{loc.visits.toLocaleString()}<span style={{ color: "#9ca3af", fontWeight: 500, fontSize: 12 }}> visits</span></span>
            </div>
            <div style={barTrack}>
              <div className="tc-bar-fill" style={{ ...barFill, width: `${(loc.visits / maxVisits) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </>
  );
}

function KpiCard({ label, value, iconName, accent, sub }) {
  return (
    <div style={kpiCard} className="card-hover tc-kpi">
      <div style={{ ...kpiAccent, background: accent }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ ...kpiIcon, background: hexA(accent, 0.12), color: accent }} className="tc-kpi-icon">
          <Icon name={iconName} size={22} />
        </div>
      </div>
      <div className="tc-kpi-value" style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", marginTop: 16, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 14, color: "#374151", fontWeight: 600, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12.5, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* hex -> rgba tint */
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ================= STYLES ================= */
const breadcrumb = { display: "flex", alignItems: "center", gap: "8px", color: "#6b7280", fontSize: "14px", marginBottom: "16px" };
const pageTitle = { margin: "0 0 4px", fontSize: "28px", color: "#0F172A" };
const pageSub = { margin: "0 0 24px", color: "#6b7280", fontSize: "15px" };
const emptyTxt = { color: "#9ca3af", fontSize: 14, padding: "20px 0", textAlign: "center" };
const retryBtn = { marginTop: 10, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 };
const trendTooltip = { background: "#fff", borderRadius: 12, padding: "10px 14px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", border: "1px solid #eef2f8" };

const kpiGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "20px", marginBottom: "24px" };
const kpiCard = { position: "relative", background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 1px 3px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", overflow: "hidden" };
const kpiAccent = { position: "absolute", top: 0, left: 0, right: 0, height: "3px" };
const kpiIcon = { width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

const chartGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", marginBottom: "24px", alignItems: "stretch" };
const card = { background: "#fff", padding: "22px", borderRadius: "16px", border: "1px solid #eef2f8", boxShadow: "0 1px 3px rgba(15,23,42,0.04)", marginBottom: "20px" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" };
const cardTitle = { margin: 0, fontSize: "17px", fontWeight: 700, color: "#0F172A", letterSpacing: "-0.2px" };
const cardSub = { margin: "3px 0 0", fontSize: "13px", color: "#9ca3af" };
const donutCenter = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", pointerEvents: "none" };
const legendRow = { display: "flex", justifyContent: "center", gap: 20, marginTop: 6, flexWrap: "wrap" };
const legendItem = { display: "flex", alignItems: "center", gap: 7, fontSize: 13 };
const legendDot = { width: 10, height: 10, borderRadius: 3, display: "inline-block" };

const rankBadge = { width: 22, height: 22, borderRadius: 7, background: "#EFF5FF", color: "#1D4ED8", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const barTrack = { width: "100%", height: "8px", background: "#eef2f8", borderRadius: "6px", overflow: "hidden" };
const barFill = { height: "100%", background: "linear-gradient(90deg,#1D4ED8,#3b82f6)", borderRadius: "6px", transition: "width .4s ease" };
