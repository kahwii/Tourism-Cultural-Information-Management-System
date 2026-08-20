import { useEffect, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { apiCertificateStatus, apiCertificateEmail } from "../api/api";
import { toast } from "../utils/toast";
import Icon from "./Icon";

/**
 * Some Tourist accounts sign in with an email as their username (Google/
 * Firebase sign-in, or .edu accounts). Printing that raw on a certificate
 * looks broken (overlong, all-lowercase) — so if the name looks like an
 * email, show a tidied-up version of just the local part instead.
 * "markemmanuel.sagarino@my.jru.edu" -> "Markemmanuel Sagarino"
 */
function prettyName(raw) {
  if (!raw) return "";
  const local = raw.includes("@") ? raw.split("@")[0] : raw;
  const words = local.replace(/[._]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return raw;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

/**
 * Heritage Church Trail — Certificate of Completion.
 * Fetches the tourist's own completion status, renders a shareable/printable
 * certificate card, and offers "Share certificate" (image, via html2canvas +
 * Web Share API with a download fallback) and "Email me a copy" (server-sent,
 * prompts for a Gmail address first if the account has none on file yet).
 */
export default function TrailCertificate({ onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailPrompt, setEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const certRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiCertificateStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e) => { if (!cancelled) toast.error(e.message || "Could not load your certificate."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const dateLabel = status?.date
    ? new Date(status.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const certName = prettyName(status?.name);
  // scale the name down as it gets longer so it never overflows/wraps awkwardly
  const nameFontSize = certName.length > 26 ? 18 : certName.length > 20 ? 21 : certName.length > 14 ? 24 : 27;

  const shareCert = async () => {
    if (!certRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(certRef.current, { scale: 2, backgroundColor: "#FEFDFB", useCORS: true });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not render the certificate image.");
      const fileName = `Heritage-Trail-Certificate-${(certName || "certificate").replace(/\s+/g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "Heritage Church Trail Certificate",
            text: "I completed the Heritage Church Trail of Mandaluyong!",
          });
        } catch {
          // user cancelled the native share sheet — not an error
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        toast.success("Certificate downloaded!");
      }
    } catch (e) {
      toast.error(e.message || "Could not share the certificate.");
    } finally {
      setSharing(false);
    }
  };

  const emailCert = async () => {
    if (!status?.email && !emailPrompt) { setEmailPrompt(true); return; }
    if (!status?.email) {
      const val = emailInput.trim();
      if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        toast.error("Please enter a valid email address.");
        return;
      }
    }
    setSending(true);
    try {
      const res = await apiCertificateEmail(status?.email ? undefined : emailInput.trim());
      if (res.emailed) {
        toast.success(`Certificate emailed to ${res.email}!`);
        setStatus((s) => ({ ...s, email: res.email }));
        setEmailPrompt(false);
      } else {
        toast.error("Could not send the email right now — try Share instead, or try again later.");
      }
    } catch (e) {
      toast.error(e.message || "Could not send the certificate email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <button style={closeX} onClick={onClose} aria-label="Close">
          <Icon name="plus" size={18} style={{ transform: "rotate(45deg)" }} />
        </button>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>Loading your certificate…</div>
        ) : !status?.completed ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
            Complete all 9 churches on the Heritage Trail to unlock your certificate.
            <div style={{ marginTop: 6, fontWeight: 700, color: "#0F172A" }}>{status?.done ?? 0}/{status?.total ?? 9} visited</div>
          </div>
        ) : (
          <>
            <div ref={certRef} style={certCard}>
              <div style={certInner}>
                <img src="/mandaluyong-logo.png?v=2" alt="" style={seal} />
                <div style={eyebrow}>CITY OF MANDALUYONG &bull; CCAT</div>
                <h1 style={certTitle}>Certificate of Completion</h1>
                <div style={certSubtitle}>HERITAGE CHURCH TRAIL</div>

                <div style={ornament}>
                  <span style={ornLine} />
                  <span style={ornIcon}><Icon name="landmark" size={16} /></span>
                  <span style={ornLine} />
                </div>

                <div style={certifiesText}>This certifies that</div>
                <div style={{ ...nameText, fontSize: nameFontSize }}>{certName}</div>
                <div style={nameRule} />

                <p style={certBody}>
                  has successfully completed the Heritage Church Trail of Mandaluyong, visiting all 9 historic churches of the city.
                </p>

                <div style={checkBadge}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div style={awardedText}>Awarded on {dateLabel}</div>

                <div style={certFooter}>
                  <div style={footerCol}>
                    <div style={footerLine} />
                    <div style={footerLabel}>Be@Mandaluyong</div>
                  </div>
                  <div style={footerCol}>
                    <div style={footerLine} />
                    <div style={footerLabel}>City of Mandaluyong</div>
                  </div>
                </div>
              </div>
            </div>

            {emailPrompt && !status.email && (
              <div style={emailBox}>
                <div style={{ fontSize: 12.5, color: "#374151", marginBottom: 6 }}>
                  Wala pa kaming email sa file mo — ilagay ang Gmail mo para maipadala ang certificate:
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="email" placeholder="you@gmail.com" value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    style={emailInputStyle}
                  />
                  <button style={sendBtn} onClick={emailCert} disabled={sending}>
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}

            <div style={actionsRow}>
              <button style={shareBtn} onClick={shareCert} disabled={sharing}>
                <Icon name="upload" size={16} />
                {sharing ? "Preparing…" : "Share certificate"}
              </button>
              {!emailPrompt && (
                <button style={emailBtn} onClick={emailCert} disabled={sending}>
                  {sending ? "Sending…" : "Email me a copy"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16, overflowY: "auto" };
const modal = { position: "relative", background: "transparent", width: 520, maxWidth: "100%", margin: "auto" };
const closeX = { position: "absolute", top: -6, right: -6, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1px solid #e6ecf5", color: "#374151", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 1 };

const certCard = { background: "#EAA31E", borderRadius: 18, padding: 3, boxShadow: "0 20px 50px rgba(0,0,0,0.3)" };
const certInner = { background: "#FEFDFB", border: "1px solid #e9e2cf", borderRadius: 16, padding: "34px 30px", textAlign: "center" };
const seal = { width: 58, height: 58, objectFit: "contain", marginBottom: 8 };
const eyebrow = { fontSize: 11, letterSpacing: 2, color: "#9ca3af", fontWeight: 700, marginBottom: 6 };
const certTitle = { fontFamily: "Georgia, 'Times New Roman', serif", color: "#1D4ED8", fontSize: 25, margin: "4px 0 2px", fontWeight: 700 };
const certSubtitle = { color: "#b45309", fontWeight: 800, letterSpacing: 3, fontSize: 12.5, marginBottom: 16 };
const ornament = { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 };
const ornLine = { width: 46, height: 1, background: "#e5c98a" };
const ornIcon = { color: "#EAA31E", display: "inline-flex" };
const certifiesText = { fontStyle: "italic", color: "#6b7280", fontSize: 14, marginBottom: 6 };
const nameText = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 27, fontWeight: 800, color: "#0F172A", marginBottom: 10 };
const nameRule = { width: 130, height: 2, background: "#EAA31E", margin: "0 auto 18px", borderRadius: 2 };
const certBody = { color: "#374151", fontSize: 14, lineHeight: 1.6, margin: "0 auto 18px", maxWidth: 380 };
const checkBadge = { width: 30, height: 30, borderRadius: "50%", background: "#1D4ED8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" };
const awardedText = { color: "#9ca3af", fontSize: 12.5, marginBottom: 22 };
const certFooter = { display: "flex", justifyContent: "center", gap: 40 };
const footerCol = { textAlign: "center" };
const footerLine = { width: 110, height: 1, background: "#d1d5db", marginBottom: 6 };
const footerLabel = { fontSize: 12, color: "#6b7280", fontWeight: 600 };

const emailBox = { background: "#fff", borderRadius: 12, padding: 14, marginTop: 14 };
const emailInputStyle = { flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const sendBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };

const actionsRow = { display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" };
const shareBtn = { flex: 1, minWidth: 180, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#EAE6FF", color: "#4C3AA8", border: "none", borderRadius: 12, padding: "13px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" };
const emailBtn = { flex: 1, minWidth: 160, background: "#fff", color: "#1D4ED8", border: "1px solid #DBE7FF", borderRadius: 12, padding: "13px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" };
