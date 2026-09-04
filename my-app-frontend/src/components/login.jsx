import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BASE, apiFirebaseLogin, apiGetSecurityQuestion, apiResetWithAnswer, fetchJsonRetry } from '../api/api';
import { toast } from '../utils/toast';
import { pwChecks, pwValid, pwStrength } from '../utils/password';
import Icon from './Icon';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

// Firebase web config (from .env). Google sign-in shows only when configured.
const FB = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseConfigured = !!(FB.apiKey && FB.projectId && !String(FB.apiKey).startsWith("PASTE"));

// Google Identity Services (script tag in index.html) — used instead of
// Firebase's own signInWithPopup/signInWithRedirect. Firebase's popup helper
// does async setup (persistence lookups, etc.) BEFORE calling window.open(),
// which on mobile Safari is enough delay for the browser to stop treating it
// as a direct result of the user's tap and silently block or drop it —
// that's what was happening even though the click handler itself was
// synchronous. Google's own library opens the popup to accounts.google.com
// immediately/synchronously, which Safari allows, and it skips the
// redirect-through-Firebase's-authDomain trip entirely.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const googleClientConfigured = !!(GOOGLE_CLIENT_ID && !String(GOOGLE_CLIENT_ID).startsWith("PASTE"));

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [pinStep, setPinStep] = useState(false);
  const [loginPin, setLoginPin] = useState('');
  const [error, setError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [roleModal, setRoleModal] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotQuestion, setForgotQuestion] = useState("");
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [forgotPw, setForgotPw] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  // Desktop shows the branded split-screen; mobile stacks to the form only.
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const on = (e) => setIsWide(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else mq.removeListener(on); };
  }, []);

  // Warm up the backend as soon as the login screen is shown. On free hosting
  // the FIRST request to an idle site is the slow/flaky one — letting this
  // throwaway ping absorb it means the user's actual sign-in hits a warm
  // server. Deliberately fire-and-forget: failures here are meaningless.
  useEffect(() => {
    fetch(`${BASE}/public_events.php`, { method: "GET", cache: "no-store" }).catch(() => {});
  }, []);

  const closeForgot = () => { setShowForgot(false); setForgotStep(1); setForgotUser(""); setForgotQuestion(""); setForgotAnswer(""); setForgotPw(""); };
  const fetchQuestion = async () => {
    if (!forgotUser.trim()) { toast.error("Enter your username or email."); return; }
    setForgotBusy(true);
    try {
      const data = await apiGetSecurityQuestion(forgotUser.trim());
      setForgotQuestion(data.question);
      setForgotStep(2);
    } catch (e) { toast.error(e.message || "Could not find your security question."); }
    finally { setForgotBusy(false); }
  };
  const submitAnswer = async () => {
    if (!forgotAnswer.trim()) { toast.error("Enter your answer."); return; }
    if (!pwValid(forgotPw)) { toast.error("Password does not meet the security requirements."); return; }
    setForgotBusy(true);
    try {
      await apiResetWithAnswer(forgotUser.trim(), forgotAnswer.trim(), forgotPw);
      toast.success("Password reset! You can now sign in with your new password.");
      closeForgot();
    } catch (e) { toast.error(e.message || "Reset failed."); }
    finally { setForgotBusy(false); }
  };
  const { login } = useAuth();
  const navigate = useNavigate();

  // Google sign-in via Google Identity Services (see index.html for the
  // script tag). `google.accounts.oauth2.initTokenClient(...).requestAccessToken()`
  // opens the popup to accounts.google.com synchronously, right inside the
  // click handler that picks a role — same mechanism on desktop and mobile,
  // no redirect trip, no Firebase authDomain hop. The access token it
  // returns is exchanged for a Firebase credential so the rest of the app
  // (getIdToken -> apiFirebaseLogin) works exactly as before.
  const handleGoogle = (role) => {
    setRoleModal(false);
    setError('');
    if (!window.google?.accounts?.oauth2) {
      setError("Google sign-in isn't ready yet — please wait a moment and try again.");
      return;
    }
    setGoogleBusy(true);
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "openid email profile",
      callback: async (response) => {
        if (response.error) {
          setError(response.error_description || "Google sign-in failed");
          setGoogleBusy(false);
          return;
        }
        try {
          const app = getApps().length ? getApps()[0] : initializeApp(FB);
          const auth = getAuth(app);
          const credential = GoogleAuthProvider.credential(null, response.access_token);
          const result = await signInWithCredential(auth, credential);
          const idToken = await result.user.getIdToken();
          const data = await apiFirebaseLogin(idToken, role);
          login(data.user);
          navigate('/dashboard');
        } catch (err) {
          setError(err.message || "Google sign-in failed");
          setGoogleBusy(false);
        }
      },
      error_callback: (err) => {
        // user closed the popup, or it was blocked/cancelled
        if (err?.type !== "popup_closed") {
          setError(err?.message || "Google sign-in was cancelled or failed.");
        }
        setGoogleBusy(false);
      },
    });
    tokenClient.requestAccessToken();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoginBusy(true);
    try {
      const { res, data } = await fetchJsonRetry(`${BASE}/login.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, pin: pinStep ? loginPin : undefined }),
      });
      if (res.ok && data.pin_required) {
        setPinStep(true);   // admin needs their 2-step PIN
        setError('');
        return;
      }
      if (res.ok) {
        login(data.user);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed');
        if (data.error === 'Invalid PIN.') setLoginPin('');
      }
    } catch {
      setError('Could not connect to server. Please try signing in again.');
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <div style={page}>
      <div style={{ ...shell, maxWidth: isWide ? 1000 : 440, gridTemplateColumns: isWide ? "1.05fr 1fr" : "1fr" }}>

        {/* ================= BRANDED PANEL =================
            Desktop: left column. Mobile: same panel stacked on top,
            just scaled down — identical content on both. */}
        <div style={isWide ? hero : heroMobile}>
          <div className="tc-blob" style={{ width: isWide ? 340 : 220, height: isWide ? 340 : 220, background: "rgba(234,163,30,.30)", top: isWide ? -70 : -50, right: isWide ? -60 : -40 }} />
          <div className="tc-blob tc-blob-2" style={{ width: isWide ? 300 : 200, height: isWide ? 300 : 200, background: "rgba(59,130,246,.38)", bottom: isWide ? -80 : -60, left: isWide ? -70 : -50 }} />

          <div style={{ position: "relative", zIndex: 1 }} className="tc-reveal">
            <img src="/mandaluyong-logo.png?v=2" alt="City of Mandaluyong"
                 className="tc-seal" style={{ width: isWide ? 78 : 62, height: isWide ? 78 : 62, objectFit: "contain" }} />
            <h1 style={isWide ? heroTitle : heroTitleMobile}>TCIMS</h1>
            <p style={isWide ? heroSub : heroSubMobile}>
              Tourism &amp; Cultural Information Management System with Sentiment Analysis
            </p>
            <div style={heroRule} />
            <div style={{ display: "flex", flexDirection: "column", gap: isWide ? 16 : 12, marginTop: isWide ? 26 : 18 }}>
              {[
                { icon: "pin",     t: "Discover Mandaluyong",   d: "Heritage sites, events, and local establishments" },
                { icon: "message", t: "Voice of the visitor",   d: "Feedback analysed automatically for sentiment" },
                { icon: "file",    t: "Accreditation, online",  d: "Apply and track tourism certificates end to end" },
              ].map((f) => (
                <div key={f.t} style={featRow} className="tc-feat">
                  <span style={isWide ? featIcon : featIconMobile}><Icon name={f.icon} size={isWide ? 18 : 16} /></span>
                  <span>
                    <span style={isWide ? featTitle : featTitleMobile}>{f.t}</span>
                    <span style={isWide ? featDesc : featDescMobile}>{f.d}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={isWide ? heroFoot : heroFootMobile}>City Cultural Affairs &amp; Tourism Development Department</div>
        </div>

        {/* ================= SIGN-IN FORM ================= */}
        <div style={isWide ? formPane : formPaneMobile} className={isWide ? "tc-slide-right" : "fade-up"}>

        {/* Card */}
        <div style={card} className="tc-reveal">
          <div style={{ marginBottom: isWide ? 20 : 16 }}>
            <h2 style={isWide ? cardHeading : { ...cardHeading, fontSize: 20 }}>
              {pinStep ? "Verify your identity" : "Welcome back"}
            </h2>
            <p style={cardSubheading}>
              {pinStep ? "Enter your 6-digit admin security PIN." : "Sign in to continue to your dashboard."}
            </p>
          </div>
          {error && <div style={errorBox}>{error}</div>}

          {/* Google Sign-In via Google Identity Services + Firebase credential exchange */}
          {firebaseConfigured && googleClientConfigured ? (
            <button type="button" style={googleBtn} className="tc-google" onClick={() => setRoleModal(true)} disabled={googleBusy}>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.2-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 5.1 29.5 3 24 3 16 3 9.1 7.6 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 45c5.2 0 9.9-2 13.5-5.2l-6.2-5.1C29.2 36.3 26.7 37 24 37c-5.3 0-9.7-2.6-11.3-7l-6.5 5C9 40.4 16 45 24 45z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.6l6.2 5.1C39.6 41 44 37 44 24c0-1.2-.1-2.3-.4-3.5z"/>
              </svg>
              {googleBusy ? "Signing in…" : "Continue with Google"}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "10px 0" }}>
              Google sign-in not configured yet.
            </div>
          )}

          {/* divider */}
          <div style={divider}><span style={dividerLine} /><span style={dividerText}>or</span><span style={dividerLine} /></div>

          <form onSubmit={handleSubmit} autoComplete="off">
            <label style={fieldLabel}>Username</label>
            <div style={inputWrap} className="tc-field">
              <span style={inputIcon} className="tc-field-icon"></span>
              <input style={input} type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>

            <label style={{ ...fieldLabel, marginTop: 14 }}>Password</label>
            <div style={inputWrap} className="tc-field">
              <span style={inputIcon} className="tc-field-icon"></span>
              <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required disabled={pinStep} />
            </div>

            {pinStep && (
              <>
                <label style={{ ...fieldLabel, marginTop: 14 }}>Admin Security PIN</label>
                <div style={inputWrap} className="tc-field">
                  <span style={inputIcon} className="tc-field-icon"></span>
                  <input
                    style={{ ...input, letterSpacing: 6, fontWeight: 700 }}
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit PIN"
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ""))}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                </div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "8px 2px 0" }}>
                  Two-step verification is on for this admin account. Enter your 6-digit PIN to continue.
                </p>
              </>
            )}

            {!pinStep && (
              <div style={row}>
                <label style={remember}>
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  Remember me
                </label>
                <a href="#" style={forgot} onClick={(e) => { e.preventDefault(); setShowForgot(true); }}>Forgot your password?</a>
              </div>
            )}

            <button type="submit" style={{ ...signInBtn, marginTop: pinStep ? 16 : signInBtn.marginTop, opacity: loginBusy ? 0.75 : 1 }} className="tc-btn tc-btn-primary" disabled={loginBusy}>
              {loginBusy ? "Signing in…" : pinStep ? "Verify PIN" : "Sign in"}
            </button>

            {pinStep && (
              <button
                type="button"
                onClick={() => { setPinStep(false); setLoginPin(""); setError(""); }}
                style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
              >
                ← Back
              </button>
            )}
          </form>

          <div style={footer}>
            Don't have an account? <Link to="/register" style={{ color: "#1D4ED8", fontWeight: 700, textDecoration: "none" }}>Register</Link>
          </div>
          <div style={{ ...footer, marginTop: 8 }}>
            <Link to="/" style={{ color: "#1D4ED8", fontWeight: 600, textDecoration: "none", fontSize: 13.5 }}>
              ← Back to city events &amp; visitor services
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, marginTop: 18 }}>
          © {new Date().getFullYear()} City of Mandaluyong — CCAT
        </div>
        </div>
      </div>

      {/* Account-type picker for Google sign-in */}
      {roleModal && (
        <div style={overlay} className="tc-modal-backdrop" onClick={() => setRoleModal(false)}>
          <div style={roleCard} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a", textAlign: "center" }}>Continue as</h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#6b7280", textAlign: "center" }}>Choose the type of account to sign in with Google.</p>

            <button style={roleOption} className="tc-role" onClick={() => handleGoogle("Tourist")}>
              <div style={{ ...roleIcon, background: "#EFF5FF", color: "#1D4ED8" }}>
                <Icon name="pin" size={22} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={roleTitle}>Tourist</div>
                <div style={roleDesc}>Explore places, check in, and leave reviews.</div>
              </div>
            </button>

            <button style={{ ...roleOption, marginTop: 12 }} className="tc-role" onClick={() => handleGoogle("Establishment")}>
              <div style={{ ...roleIcon, background: "#fef3c7", color: "#b45309" }}>
                <Icon name="store" size={22} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={roleTitle}>Establishment</div>
                <div style={roleDesc}>Apply for accreditation and upload requirements.</div>
              </div>
            </button>

            <button style={roleCancel} onClick={() => setRoleModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Forgot password — self-service via security question (no email needed) */}
      {showForgot && (
        <div style={overlay} onClick={closeForgot}>
          <div style={roleCard} className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#0f172a", textAlign: "center" }}>Reset your password</h2>

            {forgotStep === 1 ? (
              <>
                <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#6b7280", lineHeight: 1.5, textAlign: "center" }}>
                  Enter your username or email to find your security question.
                </p>
                <input style={fpInput} value={forgotUser} onChange={(e) => setForgotUser(e.target.value)} placeholder="Username or email" autoComplete="off" />
                <button style={{ ...roleCancel, background: "#2563eb", color: "#fff", marginTop: 14 }} onClick={fetchQuestion} disabled={forgotBusy}>
                  {forgotBusy ? "Checking…" : "Continue"}
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "12px 14px", margin: "4px 0 12px" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Security question</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{forgotQuestion}</div>
                </div>
                <input style={fpInput} value={forgotAnswer} onChange={(e) => setForgotAnswer(e.target.value)} placeholder="Your answer" autoComplete="off" />
                <input style={{ ...fpInput, marginTop: 10 }} type="password" autoComplete="new-password" value={forgotPw} onChange={(e) => setForgotPw(e.target.value)} placeholder="New password" />
                {forgotPw && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: pwStrength(forgotPw).pct + "%", background: pwStrength(forgotPw).color, transition: "width .2s ease" }} />
                    </div>
                    {pwChecks(forgotPw).map((c) => (
                      <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: c.ok ? "#16a34a" : "#9ca3af", marginBottom: 3 }}>
                        <span style={{ width: 13, textAlign: "center", fontWeight: 700 }}>{c.ok ? "✓" : "•"}</span>{c.label}
                      </div>
                    ))}
                  </div>
                )}
                <button style={{ ...roleCancel, background: "#2563eb", color: "#fff", marginTop: 14 }} onClick={submitAnswer} disabled={forgotBusy}>
                  {forgotBusy ? "Resetting…" : "Reset password"}
                </button>
                <button style={{ ...roleCancel, marginTop: 8, background: "transparent" }} onClick={() => setForgotStep(1)}>← Use a different account</button>
              </>
            )}

            <button style={{ ...roleCancel, marginTop: 8 }} onClick={closeForgot}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */
const page = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "18px 14px", fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "radial-gradient(1200px 600px at 12% 10%, #E8F0FF 0%, transparent 60%), radial-gradient(900px 500px at 88% 90%, #FFF4DC 0%, transparent 55%), #F5F8FC" };
const shell = { width: "100%", maxWidth: 1000, display: "grid", gap: 0, background: "#fff", borderRadius: 22, overflow: "hidden", boxShadow: "0 30px 70px rgba(10,37,89,.16)", border: "1px solid #E6ECF5" };

/* left hero panel */
const hero = { position: "relative", overflow: "hidden", padding: "44px 40px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(150deg, #1D4ED8 0%, #123471 55%, #0A2559 100%)" };
const heroTitle = { margin: "18px 0 6px", fontSize: 38, fontWeight: 800, letterSpacing: "1px", color: "#fff" };
const heroSub = { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,.78)", maxWidth: 380 };
const heroRule = { width: 54, height: 3, borderRadius: 3, background: "#EAA31E", marginTop: 22 };
const featRow = { display: "flex", alignItems: "flex-start", gap: 13 };
const featIcon = { width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#F7CD6B" };
const featTitle = { display: "block", fontSize: 14.5, fontWeight: 700, color: "#fff" };
const featDesc = { display: "block", fontSize: 12.5, color: "rgba(255,255,255,.66)", marginTop: 2, lineHeight: 1.5 };
const heroFoot = { position: "relative", zIndex: 1, marginTop: 34, fontSize: 11.5, color: "rgba(255,255,255,.5)", letterSpacing: ".3px" };

/* Mobile variants — same panel, scaled down and stacked above the form */
const heroMobile = { position: "relative", overflow: "hidden", padding: "30px 24px 26px", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", background: "linear-gradient(150deg, #1D4ED8 0%, #123471 55%, #0A2559 100%)" };
const heroTitleMobile = { margin: "12px 0 5px", fontSize: 30, fontWeight: 800, letterSpacing: "1px", color: "#fff" };
const heroSubMobile = { margin: 0, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,.78)" };
const featIconMobile = { width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.13)", border: "1px solid rgba(255,255,255,.18)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#F7CD6B" };
const featTitleMobile = { display: "block", fontSize: 13.5, fontWeight: 700, color: "#fff" };
const featDescMobile = { display: "block", fontSize: 11.5, color: "rgba(255,255,255,.66)", marginTop: 2, lineHeight: 1.45 };
const heroFootMobile = { position: "relative", zIndex: 1, marginTop: 22, fontSize: 10.5, color: "rgba(255,255,255,.5)", letterSpacing: ".3px" };

/* right form pane */
const formPane = { padding: "40px 38px", display: "flex", flexDirection: "column", justifyContent: "center" };
const formPaneMobile = { padding: "26px 22px", display: "flex", flexDirection: "column", justifyContent: "center" };
const cardHeading = { margin: 0, fontSize: 23, fontWeight: 800, color: "#0F172A", letterSpacing: "-.3px" };
const cardSubheading = { margin: "5px 0 0", fontSize: 14, color: "#64748B" };
const brand = { textAlign: "center", marginBottom: 22 };
const title = { margin: "12px 0 4px", fontSize: 29, fontWeight: 800, color: "#0A2559", letterSpacing: 1 };
const subtitle = { margin: 0, color: "#6b7280", fontSize: 14 };

const card = { background: "transparent", borderRadius: 0, padding: 0, boxShadow: "none", border: "none" };
const errorBox = { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 16 };

const googleBtn = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 11, padding: "12px", fontSize: 15, fontWeight: 600, color: "#334155", cursor: "pointer" };

const divider = { display: "flex", alignItems: "center", gap: 12, margin: "15px 0" };
const dividerLine = { flex: 1, height: 1, background: "#e6ecf5" };
const dividerText = { color: "#9ca3af", fontSize: 13 };

const fieldLabel = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 };
const inputWrap = { display: "flex", alignItems: "center", gap: 10, border: "1.5px solid #E2E8F0", borderRadius: 11, padding: "0 13px", background: "#F9FBFF" };
const inputIcon = { opacity: 0.5, fontSize: 14 };
const input = { flex: 1, border: "none", outline: "none", background: "transparent", padding: "12px 0", fontSize: 14 };

const row = { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0" };
const remember = { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151" };
const forgot = { color: "#1D4ED8", fontSize: 13, fontWeight: 700, textDecoration: "none" };

const signInBtn = { width: "100%", background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff", border: "none", borderRadius: 11, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(29,78,216,.30)", marginTop: 4 };
const footer = { textAlign: "center", marginTop: 16, fontSize: 14, color: "#6b7280" };

/* role picker modal */
const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 };
const roleCard = { background: "#fff", borderRadius: 18, padding: 26, width: 400, maxWidth: "100%", boxShadow: "0 20px 50px rgba(2,6,23,0.25)" };
const roleOption = { width: "100%", display: "flex", alignItems: "center", gap: 14, background: "#fff", border: "1px solid #e6ecf5", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left" };
const roleIcon = { width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const roleTitle = { fontSize: 16, fontWeight: 700, color: "#0f172a" };
const roleDesc = { fontSize: 12.5, color: "#6b7280", marginTop: 2 };
const roleCancel = { width: "100%", marginTop: 16, background: "#f1f5f9", border: "none", borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" };
const fpInput = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, boxSizing: "border-box" };

export default Login;
