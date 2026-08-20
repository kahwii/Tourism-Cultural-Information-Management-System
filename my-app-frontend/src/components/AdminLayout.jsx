import { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiSetAdminPin, apiInquiryCount } from "../api/api";
import Icon from "./Icon";
import Avatar from "./Avatar";

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Admin 2-step login PIN setup ----
  const [pinModal, setPinModal] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinErr, setPinErr] = useState("");

  const savePin = async () => {
    setPinErr(""); setPinMsg("");
    if (!/^\d{6}$/.test(pinValue)) { setPinErr("PIN must be exactly 6 digits."); return; }
    setPinBusy(true);
    try {
      const r = await apiSetAdminPin(pinValue, "set");
      setPinMsg(r.message || "PIN set. Two-step login is now ON.");
      setPinValue("");
    } catch (e) { setPinErr(e.message || "Could not save PIN."); }
    finally { setPinBusy(false); }
  };

  const removePin = async () => {
    setPinErr(""); setPinMsg("");
    setPinBusy(true);
    try {
      const r = await apiSetAdminPin("", "remove");
      setPinMsg(r.message || "PIN removed. Two-step login is now OFF.");
      setPinValue("");
    } catch (e) { setPinErr(e.message || "Could not remove PIN."); }
    finally { setPinBusy(false); }
  };

  // Mobile detection (phones/tablets ≤ 768px). Desktop layout is unchanged.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches
  );
  // Sidebar starts open on desktop, closed on mobile.
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => { setIsMobile(e.matches); setSidebarOpen(!e.matches); };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  // Unanswered-inquiry badge. Re-checked on every navigation so it clears
  // as soon as staff reply, without needing a full page reload.
  const [openInquiries, setOpenInquiries] = useState(0);
  useEffect(() => {
    let cancelled = false;
    apiInquiryCount()
      .then((r) => { if (!cancelled) setOpenInquiries(Number(r?.open) || 0); })
      .catch(() => {}); // badge is a nicety — never surface an error for it
    return () => { cancelled = true; };
  }, [location.pathname]);

  const [openGroups, setOpenGroups] = useState({
    "Tourism Directory": location.pathname.startsWith("/admin/tourism")
      || ["/admin/tourist-spots", "/admin/restaurants", "/admin/hotels", "/admin/tourism-businesses"]
        .includes(location.pathname)
  });

  const toggleGroup = (label) =>
    setOpenGroups(g => ({ ...g, [label]: !g[label] }));

  // On mobile, tapping a link should close the drawer.
  const closeOnMobile = () => { if (isMobile) setSidebarOpen(false); };

  const handleLogout = () => {
    logout();
    localStorage.clear();
    navigate("/login");
  };

  // CCAT Staff are day-to-day encoders (the "makers"). Managing accounts and
  // reading the audit trail belong to the approver roles — a staff member
  // being able to create admins or edit the log would defeat maker-checker.
  // Menu hiding is cosmetic; the real enforcement is server-side in crud.php.
  const APPROVER_ROLES = ["Super Admin", "CCAT Admin", "admin"];
  const isApprover = APPROVER_ROLES.includes(user?.role);

  const menu = [
    { label: "Dashboard", icon: "dashboard", to: "/admin" },
    {
      label: "Tourism Directory", icon: "pin",
      children: [
        { label: "Tourist Spots", icon: "pin", to: "/admin/tourist-spots" },
        { label: "Restaurants", icon: "utensils", to: "/admin/restaurants" },
        { label: "Hotels", icon: "bed", to: "/admin/hotels" },
        { label: "Tourism Businesses", icon: "store", to: "/admin/tourism-businesses" }
      ]
    },
    { label: "Certificates", icon: "file", to: "/admin/certificates" },
    { label: "Events", icon: "calendar", to: "/admin/events" },
    { label: "Visitor Inquiries", icon: "message", to: "/admin/inquiries", badge: openInquiries },
    { label: "Heritage Sites", icon: "landmark", to: "/admin/heritage-sites" },
    { label: "Sentiment Analysis", icon: "message", to: "/admin/sentiment" },
    { label: "Reports & Analytics", icon: "chart", to: "/admin/reports" },
    { label: "Rewards", icon: "gift", to: "/admin/rewards" },
    ...(isApprover ? [
      { label: "User Management", icon: "users", to: "/admin/users" },
      { label: "Activity Log", icon: "history", to: "/admin/activity-log" },
    ] : []),
  ];

  // Sidebar styling differs by device: desktop = in-flow collapsible column;
  // mobile = fixed slide-in drawer over the content.
  const sidebarStyle = isMobile
    ? { ...sidebarBase, position: "fixed", top: 0, left: 0, height: "100vh", width: 262,
        zIndex: 50, transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease" }
    : { ...sidebarBase, position: "sticky", top: 0, height: "100vh",
        width: sidebarOpen ? 260 : 0, transition: "width 0.25s ease" };

  return (
    <div style={layout}>

      {/* Mobile backdrop */}
      {isMobile && sidebarOpen && (
        <div style={backdrop} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside style={sidebarStyle}>
        <div style={brand}>
          <img
            src="/mandaluyong-logo.png?v=2"
            alt="City of Mandaluyong"
            style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
          />
          <div>
            <div style={brandTitle}>TCIMS</div>
            <div style={brandSub}>Mandaluyong City</div>
          </div>
        </div>

        <nav style={nav}>
          {menu.map((item) => {
            const hasChildren = !!item.children;
            const expanded = !!openGroups[item.label];

            if (!hasChildren) {
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={closeOnMobile}
                  className={({ isActive }) => "tc-nav-item" + (isActive ? " is-active" : "")}
                  style={({ isActive }) => ({ ...navItem, ...(isActive ? navItemActive : {}) })}
                >
                  <Icon name={item.icon} size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge > 0 && <span style={navBadge}>{item.badge > 99 ? "99+" : item.badge}</span>}
                </NavLink>
              );
            }

            return (
              <div key={item.label}>
                <div style={navItem} className="tc-nav-item" onClick={() => toggleGroup(item.label)}>
                  <Icon name={item.icon} size={18} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  <span style={{ ...chevron, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-flex" }}><Icon name="chevron" size={16} /></span>
                </div>
                {expanded && (
                  <div style={subNav}>
                    {item.children.map((child) => (
                      <NavLink
                        key={child.label}
                        to={child.to}
                        onClick={closeOnMobile}
                        className={({ isActive }) => "tc-nav-item" + (isActive ? " is-active" : "")}
                        style={({ isActive }) => ({ ...subItem, ...(isActive ? navItemActive : {}) })}
                      >
                        <Icon name={child.icon} size={16} />
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ================= MAIN ================= */}
      <main style={main}>
        <div style={topbar}>
          <button style={toggleBtn} className="tc-btn" onClick={() => setSidebarOpen(o => !o)}><Icon name="menu" size={18} /></button>
          {!isMobile && (
            <div style={searchBox} className="tc-search">
              <span style={{ color: "#94a3b8", display: "inline-flex" }}><Icon name="search" size={16} /></span>
              <input style={searchInput} className="tc-input" placeholder="Search tourist spots, events, establishments..." />
            </div>
          )}
          <div style={topRight}>
            <div style={userBox}>
              <Avatar user={user} size={38} />
              {!isMobile && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.username || "—"}</div>
                  {/* Was hardcoded "Super Admin", so every admin-area user
                      appeared to be a Super Admin regardless of actual role. */}
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{user?.role || "—"}</div>
                </div>
              )}
            </div>
            <button
              style={securityBtn}
              onClick={() => { setPinModal(true); setPinMsg(""); setPinErr(""); setPinValue(""); }}
              title="Two-step login PIN"
            >
              <Icon name="lock" size={15} />
              {!isMobile && <span>Security</span>}
            </button>
            <button style={logoutBtn} className="tc-btn" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <div style={isMobile ? contentMobile : content}>
          <Outlet />
        </div>
      </main>

      {/* ============ ADMIN 2-STEP PIN MODAL ============ */}
      {pinModal && (
        <div style={modalWrap} onClick={() => setPinModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ color: "#1D4ED8", display: "inline-flex" }}><Icon name="lock" size={20} /></span>
              <h3 style={{ margin: 0, fontSize: 18, color: "#0F172A" }}>Two-Step Login PIN</h3>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#6b7280", lineHeight: 1.5 }}>
              Add a 6-digit PIN as a second step after your password. When it's on, every admin sign-in
              will ask for this PIN — even if someone knows your password.
            </p>

            {pinMsg && <div style={okBox}>{pinMsg}</div>}
            {pinErr && <div style={errBox}>{pinErr}</div>}

            <label style={modalLabel}>New 6-digit PIN</label>
            <input
              style={{ ...modalInput, letterSpacing: 8, fontWeight: 700, textAlign: "center" }}
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={pinValue}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              autoComplete="off"
            />

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button style={{ ...modalBtn, flex: 1, background: "#1D4ED8", color: "#fff" }} className="tc-btn" onClick={savePin} disabled={pinBusy}>
                {pinBusy ? "Saving…" : "Turn ON / Update PIN"}
              </button>
              <button style={{ ...modalBtn, background: "#f1f5f9", color: "#475569" }} className="tc-btn" onClick={removePin} disabled={pinBusy}>
                Turn OFF
              </button>
            </div>
            <button
              style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
              onClick={() => setPinModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= SHARED STYLES ================= */
const layout = { display: "flex", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#F5F8FC" };

const sidebarBase = { background: "#ffffff", borderRight: "1px solid #e6ecf5", boxShadow: "2px 0 10px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 };
const backdrop = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 40 };
const brand = { display: "flex", alignItems: "center", gap: "12px", padding: "20px 18px", background: "linear-gradient(135deg, #F7FAFF, #FFFFFF)", borderBottom: "1px solid #eef2f8", boxShadow: "inset 0 -2px 0 rgba(234,163,30,.35)" };
const brandIcon = { width: "44px", height: "44px", borderRadius: "12px", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "22px" };
const brandTitle = { fontWeight: 800, fontSize: "18px", color: "#0A2559", letterSpacing: "-0.3px" };
const brandSub = { fontSize: "12px", color: "#6b7280" };

const nav = { display: "flex", flexDirection: "column", gap: "4px", padding: "14px 12px" };
const navItem = { display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", cursor: "pointer", color: "#374151", fontSize: "15px", whiteSpace: "nowrap", textDecoration: "none", transition: "background 0.15s ease, color 0.15s ease" };
const navItemActive = { background: "linear-gradient(135deg, #1D4ED8, #123471)", color: "#ffffff", fontWeight: 600, boxShadow: "0 6px 16px rgba(29,78,216,0.32)" };
const navIcon = { fontSize: "16px", width: "20px", textAlign: "center" };
const chevron = { fontSize: "16px", transition: "transform 0.2s ease", opacity: 0.7 };
// Unanswered-inquiry count. Red so it reads as "needs attention", and it stays
// legible on the blue gradient when the nav item is active.
const navBadge = { background: "#dc2626", color: "#fff", borderRadius: 999, minWidth: 20, height: 20, padding: "0 6px", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 0 2px rgba(255,255,255,.55)" };
const subNav = { display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px", paddingLeft: "18px" };
const subItem = { display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "10px", cursor: "pointer", color: "#374151", fontSize: "14px", whiteSpace: "nowrap", textDecoration: "none", transition: "background 0.15s ease, color 0.15s ease" };

const main = { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" };
const topbar = { display: "flex", alignItems: "center", gap: "16px", background: "rgba(255,255,255,.88)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid #e6ecf5", padding: "12px 24px", position: "sticky", top: 0, zIndex: 10 };
const toggleBtn = { background: "#f1f5f9", border: "none", borderRadius: "8px", width: "38px", height: "38px", color: "#475569", cursor: "pointer", flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const searchBox = { flex: 1, maxWidth: 620, display: "flex", alignItems: "center", gap: "8px", background: "#f1f5f9", borderRadius: "10px", padding: "10px 14px" };
const searchInput = { border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "14px", color: "#374151" };
const topRight = { marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px" };
const bellWrap = { position: "relative", cursor: "pointer" };
const bellDot = { position: "absolute", top: 0, right: 0, width: "8px", height: "8px", background: "#ef4444", borderRadius: "50%" };
const userBox = { display: "flex", alignItems: "center", gap: "10px" };
const avatar = { width: "38px", height: "38px", borderRadius: "50%", background: "linear-gradient(135deg, #1D4ED8, #123471)", boxShadow: "0 4px 10px rgba(29,78,216,.28)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 };
const logoutBtn = { padding: "8px 14px", background: "#DC2626", color: "#fff", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "14px", fontWeight: 600, boxShadow: "0 3px 10px rgba(220,38,38,.25)" };
const securityBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#EFF5FF", color: "#1D4ED8", border: "1px solid #dbeafe", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600 };
const content = { padding: "24px 32px" };
const contentMobile = { padding: "16px 14px" };

/* ---- PIN modal ---- */
const modalWrap = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modalCard = { background: "#fff", borderRadius: 16, padding: "26px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" };
const modalLabel = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 6 };
const modalInput = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 18, boxSizing: "border-box", fontFamily: "inherit" };
const modalBtn = { padding: "12px 16px", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const okBox = { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, marginBottom: 12 };
const errBox = { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 12px", fontSize: 13.5, marginBottom: 12 };
