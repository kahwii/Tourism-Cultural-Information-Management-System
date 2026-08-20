import { useState, useEffect, useCallback } from "react";
import { apiFeedbackMine } from "../api/api";
import { maskText } from "../utils/profanity";

export default function TouristFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const data = await apiFeedbackMine();
      setFeedback(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load your feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const badge = (s) =>
    s === "Positive" ? bGreen : s === "Negative" ? bRed : bAmber;

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d.replace(" ", "T"));
    return isNaN(dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <h1 style={h1}>My Feedback</h1>
      <p style={sub}>Your submitted ratings & reviews. Leave feedback from the Explore tab.</p>

      {loading ? (
        <div style={empty}>Loading your feedback…</div>
      ) : err ? (
        <div style={{ ...empty, color: "#dc2626" }}>{err}<div><button style={retryBtn} className="tc-btn tc-btn-primary" onClick={load}>Retry</button></div></div>
      ) : feedback.length === 0 ? (
        <div style={empty}>
          You haven't left any feedback yet. Go to <b>Explore</b> and rate the places you've visited!
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {feedback.map((f) => (
            <div key={f.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, color: "#0F172A" }}>{f.place}</div>
                <span style={badge(f.sentiment)}>{f.sentiment}</span>
              </div>
              <div style={{ margin: "4px 0", color: "#EAA31E" }}>{"★".repeat(Number(f.rating) || 0)}</div>
              {f.comment && <div style={{ fontSize: 14, color: "#374151" }}>{maskText(f.comment)}</div>}
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{fmtDate(f.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const h1 = { margin: "0 0 4px", fontSize: 24, color: "#0F172A" };
const sub = { margin: "0 0 16px", fontSize: 14, color: "#6b7280" };
const empty = { background: "#fff", border: "1px dashed #d1d5db", borderRadius: 14, padding: "40px 20px", textAlign: "center", color: "#6b7280", fontSize: 14 };
const retryBtn = { marginTop: 10, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 };
const card = { background: "#fff", borderRadius: 14, border: "1px solid #eef2f8", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: 16 };
const bBase = { padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 };
const bGreen = { ...bBase, background: "#dcfce7", color: "#16a34a" };
const bAmber = { ...bBase, background: "#fef3c7", color: "#b45309" };
const bRed = { ...bBase, background: "#fee2e2", color: "#dc2626" };
