import { useState, useEffect } from "react";
import Avatar from "./Avatar";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiList } from "../api/api";
import { toast } from "../utils/toast";
import { EVENTS_SEEN_KEY } from "./TouristEvents";
import { getInterested } from "../utils/interestedEvents";
import AccountModal from "./AccountModal";
import { LanguageProvider, useLanguage } from "../context/LanguageContext";

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Day-of reminder for events the tourist marked "Interested" in — fires when
// they open the app (no server-side push infra needed). Deduped per day via
// sessionStorage so it doesn't nag on every page navigation.
function notifyInterestedToday(list) {
  const interested = getInterested();
  if (interested.length === 0) return;
  const today = todayStr();
  const todays = list.filter((e) => interested.includes(Number(e.id)) && e.event_date === today);
  if (todays.length === 0) return;

  const dedupeKey = "tcims_today_notified";
  if (sessionStorage.getItem(dedupeKey) === today) return;
  sessionStorage.setItem(dedupeKey, today);

  const names = todays.map((e) => e.name).join(", ");
  toast.info(`Happening today: ${names}. Don't miss it!`);

  if (typeof Notification === "undefined") return;
  const fire = () => new Notification("Event today in Mandaluyong", { body: names, icon: "/mandaluyong-logo.png" });
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
}

export default function TouristLayout() {
  return (
    <LanguageProvider>
      <TouristLayoutInner />
    </LanguageProvider>
  );
}

function TouristLayoutInner() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { lang, toggle, t } = useLanguage();
  const [newEvents, setNewEvents] = useState(0);
  const [showAccount, setShowAccount] = useState(false);

  const handleLogout = () => { logout(); localStorage.removeItem("user"); navigate("/login"); };

  // check for newly-posted events (by admin) and notify the tourist
  useEffect(() => {
    let cancelled = false;
    apiList("events").then(list => {
      if (cancelled || !Array.isArray(list)) return;
      const maxId = list.reduce((mx, e) => Math.max(mx, Number(e.id) || 0), 0);
      const seenRaw = localStorage.getItem(EVENTS_SEEN_KEY);
      if (seenRaw === null) {
        // first visit: set a baseline so existing events aren't flagged as new
        localStorage.setItem(EVENTS_SEEN_KEY, String(maxId));
      } else {
        const seen = Number(seenRaw);
        const fresh = list.filter(e => Number(e.id) > seen);
        if (fresh.length > 0) {
          setNewEvents(fresh.length);
          toast.info(`${fresh.length} new event${fresh.length > 1 ? "s" : ""} posted! Check the Events tab.`);
        }
      }
      // day-of reminder for events the tourist starred as "Interested"
      notifyInterestedToday(list);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const tabs = [
    { to: "/tourist", label: t("navExplore"), end: true },
    { to: "/tourist/trail", label: t("navTrail") },
    { to: "/tourist/events", label: t("navEvents") },
    { to: "/tourist/feedback", label: t("navFeedback") }
  ];

  return (
    <div style={page}>
      <header style={topbar} className="tc-portal-bar">
        <div style={inner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="tc-brand-mark">
            <img src="/mandaluyong-logo.png?v=2" alt="Mandaluyong" style={{ width: 38, height: 38, objectFit: "contain" }} />
            <div>
              <div style={{ fontWeight: 700, color: "#fff", lineHeight: 1.1, fontSize: 18 }}>Be@Mandaluyong</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>Tourist Trail & Guide</div>
            </div>
          </div>

          <nav style={navWrap}>
            {tabs.map(t => {
              const isEvents = t.to === "/tourist/events";
              return (
                <NavLink key={t.to} to={t.to} end={t.end}
                  onClick={isEvents ? () => setNewEvents(0) : undefined}
                  className={({ isActive }) => "tc-topnav" + (isActive ? " is-active" : "")}
                  style={({ isActive }) => ({ ...navItem, ...(isActive ? navActive : {}), position: "relative" })}>
                  <span>{t.label}</span>
                  {isEvents && newEvents > 0 && <span style={badge} className="tc-pulse">{newEvents}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              style={langBtn} className="tc-btn" onClick={toggle}
              title={lang === "en" ? "Switch to Filipino" : "Switch to English"}
            >
              {lang === "en" ? "FIL" : "EN"}
            </button>
            <Avatar user={user} size={34} ring />
            <span style={{ color: "#fff", fontSize: 14 }}>{user?.username || "Tourist"}</span>
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
const inner = { maxWidth: 1140, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" };
const navWrap = { display: "flex", gap: 6 };
const navItem = { display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.9)", textDecoration: "none", padding: "8px 16px", borderRadius: 10, fontSize: 15, fontWeight: 500 };
const navActive = { background: "rgba(255,255,255,0.16)", color: "#fff", fontWeight: 700 };
const badge = { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 5px", background: "#EAA31E", color: "#0A2559", borderRadius: 999, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" };
const logoutBtn = { background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const acctBtn = { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer" };
const langBtn = { background: "rgba(255,255,255,0.14)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 };
const content = { maxWidth: 1140, margin: "0 auto", padding: "28px 24px" };
