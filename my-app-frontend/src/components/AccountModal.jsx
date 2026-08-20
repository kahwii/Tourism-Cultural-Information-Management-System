import { useState } from "react";
import { apiSetPassword, apiUploadAvatar, apiRemoveAvatar } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "../utils/toast";
import { pwChecks, pwValid, pwStrength } from "../utils/password";
import Avatar from "./Avatar";

// Lets a signed-in user (including Google-registered ones) set a profile picture
// and a login password, so they can also sign in with their email + password.
export default function AccountModal({ user, onClose }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { login } = useAuth();

  const emailAsUsername = user?.email || user?.username || "";

  // Keep the signed-in user in sync so the new picture shows everywhere at once.
  const syncAvatar = (avatar) => {
    try {
      const stored = JSON.parse(localStorage.getItem("user")) || {};
      login({ ...stored, avatar });
    } catch { /* ignore */ }
  };

  const pickPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image is too large (max 5 MB)."); return; }
    setUploading(true);
    try {
      const r = await apiUploadAvatar(file);
      syncAvatar(r.avatar);
      toast.success(r.message || "Profile picture updated.");
    } catch (e) {
      toast.error(e.message || "Could not upload the picture.");
    } finally {
      setUploading(false);
    }
  };

  const dropPhoto = async () => {
    setUploading(true);
    try {
      const r = await apiRemoveAvatar();
      syncAvatar(null);
      toast.info(r.message || "Profile picture removed.");
    } catch (e) {
      toast.error(e.message || "Could not remove the picture.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!pwValid(pw)) { toast.error("Password does not meet the security requirements."); return; }
    if (pw !== pw2) { toast.error("Passwords do not match."); return; }
    setSaving(true);
    try {
      await apiSetPassword(pw);
      toast.success("Password saved! You can now log in with your email and password.");
      onClose();
    } catch (e) {
      toast.error(e.message || "Failed to set password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay} className="tc-modal-backdrop" onClick={onClose}>
      <div style={card} className="tc-tile" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a" }}>Account Settings</h2>
        <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6b7280" }}>
          Add a profile picture, and set a login password so you can also sign in with your
          email and password — not only with Google.
        </p>

        {/* ---------- Profile picture ---------- */}
        <div style={photoRow}>
          <Avatar user={user} size={72} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Profile picture</div>
            <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2, lineHeight: 1.5 }}>
              JPG, PNG, GIF or WEBP — up to 5 MB. It will be cropped to a square automatically.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <label style={{ ...photoBtn, opacity: uploading ? 0.6 : 1 }} className="tc-btn">
                {uploading ? "Working…" : user?.avatar ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }}
                />
              </label>
              {user?.avatar && (
                <button style={photoRemove} className="tc-btn" onClick={dropPhoto} disabled={uploading}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        <label style={label}>Your username (email)</label>
        <input style={{ ...input, background: "#f8fafc", color: "#6b7280" }} value={emailAsUsername} disabled />

        <label style={label}>New password</label>
        <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Create a strong password" />

        {pw && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: pwStrength(pw).pct + "%", background: pwStrength(pw).color, transition: "width .2s ease" }} />
            </div>
            {pwStrength(pw).label && <div style={{ fontSize: 12, fontWeight: 700, color: pwStrength(pw).color, marginBottom: 8 }}>{pwStrength(pw).label} password</div>}
            {pwChecks(pw).map((c) => (
              <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.ok ? "#16a34a" : "#9ca3af", marginBottom: 4 }}>
                <span style={{ width: 14, textAlign: "center", fontWeight: 700 }}>{c.ok ? "✓" : "•"}</span>{c.label}
              </div>
            ))}
          </div>
        )}

        <label style={label}>Confirm password</label>
        <input style={input} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Re-type your password" />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button style={cancelBtn} className="tc-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button style={saveBtn} className="tc-btn tc-btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Password"}</button>
        </div>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 };
const card = { background: "#fff", borderRadius: 16, padding: 26, width: 420, maxWidth: "100%", boxShadow: "0 20px 50px rgba(2,6,23,0.25)" };
const label = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const photoRow = { display: "flex", gap: 16, alignItems: "flex-start", padding: "16px", background: "#F7FAFF", border: "1px solid #E6ECF5", borderRadius: 14, marginBottom: 6 };
const photoBtn = { background: "linear-gradient(135deg,#1D4ED8,#123471)", color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-block" };
const photoRemove = { background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const input = { width: "100%", padding: "11px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box" };
const cancelBtn = { background: "#F5F8FC", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14, color: "#374151", fontWeight: 600 };
const saveBtn = { background: "#1D4ED8", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 14, fontWeight: 700 };
