import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* Shown for any URL that doesn't match a route. */
export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Send people back to the dashboard that matches their role.
  const homeFor = (role) => {
    if (!role) return "/login";
    if (role === "Establishment") return "/establishment";
    if (role === "Tourist") return "/tourist";
    return "/admin";
  };
  const home = homeFor(user?.role);

  return (
    <div style={page}>
      <div style={card} className="fade-up">
        <img src="/mandaluyong-logo.png?v=2" alt="City of Mandaluyong"
             className="tc-seal" style={{ width: 66, height: 66, objectFit: "contain" }} />

        <div style={code}>404</div>
        <h1 style={title}>Page not found</h1>
        <p style={sub}>
          The page you're looking for doesn't exist, or it may have been moved.
          Check the address, or head back to a familiar place.
        </p>

        <div style={btnRow}>
          <Link to={home} style={primaryBtn} className="tc-btn tc-btn-primary">
            {user ? "Back to dashboard" : "Go to sign in"}
          </Link>
          <button style={ghostBtn} className="tc-btn" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>

      <div style={footNote}>
        Tourism &amp; Cultural Information Management System — City of Mandaluyong
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const page = {
  minHeight: "100vh", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", padding: 24,
  fontFamily: "'Inter', 'Segoe UI', sans-serif",
  background: "radial-gradient(1000px 500px at 50% 0%, #E8F0FF 0%, transparent 60%), #F5F8FC",
};
const card = {
  background: "#fff", borderRadius: 20, padding: "36px 34px", maxWidth: 480, width: "100%",
  textAlign: "center", border: "1px solid #E6ECF5", boxShadow: "0 24px 56px rgba(10,37,89,.14)",
};
const code = {
  fontSize: 58, fontWeight: 800, letterSpacing: "-2px", marginTop: 12,
  background: "linear-gradient(135deg,#1D4ED8,#EAA31E)",
  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
};
const title = { margin: "2px 0 8px", fontSize: 22, fontWeight: 800, color: "#0F172A" };
const sub = { margin: 0, fontSize: 14.5, color: "#64748B", lineHeight: 1.65 };
const btnRow = { display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" };
const primaryBtn = {
  background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff", border: "none",
  borderRadius: 11, padding: "12px 22px", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 8px 20px rgba(29,78,216,.28)", textDecoration: "none", display: "inline-block",
};
const ghostBtn = {
  background: "#F1F5F9", color: "#334155", border: "none",
  borderRadius: 11, padding: "12px 22px", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
};
const footNote = { marginTop: 22, fontSize: 12, color: "#94A3B8", textAlign: "center" };
