import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BASE, fetchJsonRetry } from "../api/api";
import { pwChecks, pwValid, pwStrength } from "../utils/password";
import { SECURITY_QUESTIONS } from "../utils/securityQuestions";

const BARANGAYS = [
  "Addition Hills", "Bagong Silang", "Barangka Drive", "Barangka Ibaba", "Barangka Ilaya",
  "Barangka Itaas", "Buayang Bato", "Burol", "Daang Bakal", "Hagdang Bato Itaas",
  "Hagdang Bato Libis", "Harapin Ang Bukas", "Highway Hills", "Hulo", "Mabini-J. Rizal",
  "Malamig", "Mauway", "Namayan", "New Zañiga", "Old Zañiga", "Pag-asa", "Plainview",
  "Pleasant Hills", "Poblacion", "San Jose", "Vergara", "Wack-Wack Greenhills",
];
const EST_TYPES = ["Hotel", "Restaurant", "Shopping Mall", "Tourism Business", "Travel Agency", "Event Venue", "Resort", "Others"];
// Business/Mayor's Permit numbers: letters, digits, hyphens/slashes, 5-40 chars
// (e.g. "2026-00456", "BP-2026-001234"). Mirrors the backend check in register.php.
const PERMIT_NO_RE = /^[A-Za-z0-9/-]{5,40}$/;

// Nothing is pre-selected — every field starts blank so applicants must
// explicitly choose/type each value themselves (no silent defaults).
const EMPTY = {
  first_name: "", middle_name: "", last_name: "", sex: "", account_type: "",
  business_name: "", establishment_type: "",
  business_permit_no: "",
  region: "", province: "", city: "",
  barangay: "", business_address: "", zip_code: "",
  email: "", password: "", confirm_password: "",
  security_question: "", security_answer: "",
  mobile: "", telephone: "",
};

export default function EstablishmentRegister({ onSwitchToTourist }) {
  const [f, setF] = useState(EMPTY);
  const [certified, setCertified] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!f.sex) return setError("Please select your sex.");
    if (!f.account_type) return setError("Please select an account type.");
    if (!f.business_name.trim()) return setError("Business Name is required.");
    if (!PERMIT_NO_RE.test(f.business_permit_no.trim())) return setError("Enter a valid Business/Mayor's Permit Number (letters, numbers, - or /, 5-40 characters).");
    if (!f.establishment_type) return setError("Please select an establishment type.");
    if (!f.region.trim()) return setError("Region is required.");
    if (!f.province.trim()) return setError("Province is required.");
    if (!f.city.trim()) return setError("City / Municipality is required.");
    if (!f.barangay) return setError("Please select a barangay.");
    if (!f.zip_code.trim()) return setError("Zip Code is required.");
    if (!f.business_address.trim()) return setError("Business Address is required.");
    if (!f.email.trim()) return setError("Email Address is required.");
    if (!pwValid(f.password)) return setError("Password does not meet the security requirements.");
    if (f.password !== f.confirm_password) return setError("Passwords do not match.");
    if (!f.security_question) return setError("Please select a security question.");
    if (!f.security_answer.trim()) return setError("Please answer your security question (for password recovery).");
    if (!certified) return setError("Please certify the declaration before registering.");

    setSaving(true);
    try {
      const { res, data } = await fetchJsonRetry(`${BASE}/register.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, role: "establishment" }),
      });
      if (res.ok) {
        setSuccess(" Account created and application submitted for review! Sign in with your email. Redirecting…");
        setTimeout(() => navigate("/login"), 1800);
      } else {
        setError(data.error || "Registration failed.");
      }
    } catch {
      setError("Could not connect to server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={page}>
      <div style={card} className="tc-tile">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/mandaluyong-logo.png" alt="Mandaluyong" style={{ width: 64, height: 64, objectFit: "contain" }} />
          <h1 style={{ margin: "10px 0 2px", fontSize: 24, color: "#0F172A" }}>Create your Accreditation Account</h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: 14 }}>City Cultural Affairs & Tourism — Mandaluyong</p>
        </div>

        {error && <div style={errorBox}>{error}</div>}
        {success && <div style={successBox}>{success}</div>}

        <form onSubmit={submit} autoComplete="off">
          {/* PERSONAL INFORMATION */}
          <div style={sectionHead}>Personal Information</div>
          <div style={row3}>
            <Field label="First Name"><input style={inp} className="tc-input" value={f.first_name} onChange={set("first_name")} autoComplete="off" /></Field>
            <Field label="Middle Name"><input style={inp} className="tc-input" value={f.middle_name} onChange={set("middle_name")} autoComplete="off" /></Field>
            <Field label="Last Name"><input style={inp} className="tc-input" value={f.last_name} onChange={set("last_name")} autoComplete="off" /></Field>
          </div>
          <div style={row2}>
            <Field label="Sex">
              <select style={inp} value={f.sex} onChange={set("sex")} required>
                <option value="" disabled>Select…</option>
                <option>Male</option><option>Female</option>
              </select>
            </Field>
            <Field label="Account Type">
              <select style={inp} value={f.account_type} onChange={set("account_type")} required>
                <option value="" disabled>Select…</option>
                <option>Owner</option><option>Authorized Representative</option><option>Frontliner</option>
              </select>
            </Field>
          </div>

          {/* BUSINESS INFORMATION */}
          <div style={sectionHead}>Business Information</div>
          <div style={row2}>
            <Field label="Business Name (as on Business Permit) *"><input style={inp} className="tc-input" value={f.business_name} onChange={set("business_name")} autoComplete="off" /></Field>
            <Field label="Establishment Type">
              <select style={inp} value={f.establishment_type} onChange={set("establishment_type")} required>
                <option value="" disabled>Select…</option>
                {EST_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Business/Mayor's Permit No. *">
            <input style={inp} className="tc-input" value={f.business_permit_no} onChange={set("business_permit_no")} autoComplete="off" placeholder="e.g. 2026-00456" />
          </Field>
          <p style={{ margin: "-6px 0 12px", fontSize: 12, color: "#9ca3af" }}>As printed on your Business/Mayor's Permit — CCAT verifies this against your uploaded permit copy.</p>
          <div style={row3}>
            <Field label="Region"><input style={inp} className="tc-input" value={f.region} onChange={set("region")} autoComplete="off" required /></Field>
            <Field label="Province"><input style={inp} className="tc-input" value={f.province} onChange={set("province")} autoComplete="off" required /></Field>
            <Field label="City / Municipality"><input style={inp} className="tc-input" value={f.city} onChange={set("city")} autoComplete="off" required /></Field>
          </div>
          <div style={row2}>
            <Field label="Barangay">
              <select style={inp} value={f.barangay} onChange={set("barangay")} required>
                <option value="" disabled>Select…</option>
                {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Zip Code"><input style={inp} className="tc-input" value={f.zip_code} onChange={set("zip_code")} autoComplete="off" required /></Field>
          </div>
          <Field label="Business Address (Bldg / House / Block / Lot No., Street) *">
            <input style={inp} className="tc-input" value={f.business_address} onChange={set("business_address")} autoComplete="off" />
          </Field>

          {/* ACCOUNT INFORMATION */}
          <div style={sectionHead}>Account Information</div>
          <Field label="Email Address *"><input style={inp} className="tc-input" type="email" value={f.email} onChange={set("email")} autoComplete="off" /></Field>
          <p style={noteBox}>Use a valid, active email — official communications and notifications will be sent here. This is also your sign-in username.</p>
          <div style={row2}>
            <Field label="Password *"><input style={inp} className="tc-input" type="password" value={f.password} onChange={set("password")} autoComplete="new-password" /></Field>
            <Field label="Confirm Password *"><input style={inp} className="tc-input" type="password" value={f.confirm_password} onChange={set("confirm_password")} autoComplete="new-password" /></Field>
          </div>
          {f.password && (
            <div style={{ margin: "-2px 0 6px", maxWidth: 420 }}>
              <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: pwStrength(f.password).pct + "%", background: pwStrength(f.password).color, transition: "width .2s ease" }} />
              </div>
              {pwStrength(f.password).label && <div style={{ fontSize: 12, fontWeight: 700, color: pwStrength(f.password).color, marginBottom: 8 }}>{pwStrength(f.password).label} password</div>}
              {pwChecks(f.password).map((c) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.ok ? "#16a34a" : "#9ca3af", marginBottom: 4 }}>
                  <span style={{ width: 14, textAlign: "center", fontWeight: 700 }}>{c.ok ? "✓" : "•"}</span>{c.label}
                </div>
              ))}
            </div>
          )}

          {/* ACCOUNT RECOVERY */}
          <div style={sectionHead}>Account Recovery</div>
          <div style={row2}>
            <Field label="Security Question *">
              <select style={inp} value={f.security_question} onChange={set("security_question")} required>
                <option value="" disabled>Select…</option>
                {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Your Answer *"><input style={inp} className="tc-input" value={f.security_answer} onChange={set("security_answer")} placeholder="Used if you forget your password" autoComplete="off" /></Field>
          </div>

          {/* CONTACT INFORMATION */}
          <div style={sectionHead}>Contact Information</div>
          <div style={row2}>
            <Field label="Mobile No."><input style={inp} className="tc-input" value={f.mobile} onChange={set("mobile")} placeholder="0917 123 4567" autoComplete="off" /></Field>
            <Field label="Telephone No."><input style={inp} className="tc-input" value={f.telephone} onChange={set("telephone")} placeholder="(02) 8XXX XXXX" autoComplete="off" /></Field>
          </div>

          {/* CERTIFICATION */}
          <label style={certRow}>
            <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              I certify that I am duly authorized to accomplish this application form and that the information provided
              herein are true, correct and complete to the best of my knowledge, in compliance with pertinent laws,
              rules, and regulations of the Republic of the Philippines.
            </span>
          </label>

          <button type="submit" style={submitBtn} disabled={saving}>{saving ? "Registering…" : "Register Account"}</button>

          <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#6b7280" }}>
            <button type="button" onClick={onSwitchToTourist} style={linkBtn}>← Register as Tourist instead</button>
            <span style={{ margin: "0 8px" }}>·</span>
            <Link to="/login" style={{ color: "#1D4ED8", fontWeight: 600 }}>Go to sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

/* ================= STYLES ================= */
const page = { minHeight: "100vh", background: "#F5F8FC", padding: "32px 16px", fontFamily: "'Inter', 'Segoe UI', sans-serif" };
const card = { maxWidth: 760, margin: "0 auto", background: "#fff", borderRadius: 16, padding: "32px", boxShadow: "0 10px 40px rgba(0,0,0,0.08)", border: "1px solid #eef2f8" };
const sectionHead = { margin: "22px 0 12px", fontSize: 15, fontWeight: 700, color: "#1D4ED8", borderBottom: "2px solid #DBE7FF", paddingBottom: 6 };
const row2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 };
const row3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14 };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#374151", marginBottom: 5 };
const inp = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const noteBox = { background: "#EFF5FF", border: "1px solid #DBE7FF", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#123471", margin: "0 0 12px", lineHeight: 1.5 };
const certRow = { display: "flex", gap: 10, alignItems: "flex-start", margin: "20px 0 6px", padding: "12px", background: "#fafbff", border: "1px solid #eef2f8", borderRadius: 10, cursor: "pointer" };
const submitBtn = { width: "100%", marginTop: 16, background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#1D4ED8", fontWeight: 600, cursor: "pointer", fontSize: 14, padding: 0 };
const errorBox = { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 14, marginBottom: 14 };
const successBox = { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 8, padding: "10px 14px", fontSize: 14, marginBottom: 14 };
