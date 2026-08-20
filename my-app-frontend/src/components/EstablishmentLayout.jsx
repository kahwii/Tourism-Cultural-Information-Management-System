import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AccountModal from "./AccountModal";

export default function EstablishmentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showAccount, setShowAccount] = useState(false);

  const handleLogout = () => { logout(); localStorage.removeItem("user"); navigate("/login"); };

  return (
    <div style={page}>
      <header style={topbar} className="tc-portal-bar">
        <div style={inner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="tc-brand-mark">
            <img src="/mandaluyong-logo.png?v=2" alt="Mandaluyong" style={{ width: 38, height: 38, objectFit: "contain" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#fff", lineHeight: 1.1, fontSize: 18 }}>CCAT Accreditation Portal</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Tourism Establishment Registration</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#fff", fontSize: 14 }}>{user?.username || "Establishment"}</span>
            <button style={acctBtn} className="tc-btn" onClick={() => setShowAccount(true)}>Account</button>
            <button style={logoutBtn} className="tc-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <main style={content} className="tc-page">
        <Outlet />
      </main>

      {showAccount && <AccountModal user={user} onClose={() => setShowAccount(false)} />}
    </div>
  );
}

const page = { minHeight: "100vh", background: "#F5F8FC", fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const topbar = { background: "linear-gradient(135deg, #1D4ED8 0%, #123471 100%)", position: "sticky", top: 0, zIndex: 10 };
const inner = { maxWidth: 1040, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" };
const logoutBtn = { background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const acctBtn = { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const content = { maxWidth: 1040, margin: "0 auto", padding: "28px 24px" };
