import { useState, useCallback, useEffect } from "react";

/*
  Branded replacement for window.confirm().

  Usage:
    const [confirm, ConfirmUI] = useConfirm();
    ...
    if (!(await confirm({ title, message, confirmLabel, tone }))) return;
    ...
    return (<> ... {ConfirmUI} </>);
*/
export function useConfirm() {
  const [state, setState] = useState(null); // { opts, resolve }

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => setState({ opts, resolve }));
  }, []);

  const close = useCallback((result) => {
    setState((s) => { s?.resolve(result); return null; });
  }, []);

  // Esc cancels, Enter confirms
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  const ui = state ? <ConfirmDialog {...state.opts} onCancel={() => close(false)} onConfirm={() => close(true)} /> : null;
  return [confirm, ui];
}

export default function ConfirmDialog({
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  tone = "danger",          // "danger" | "primary"
  onConfirm,
  onCancel,
}) {
  const t = tone === "danger"
    ? { bg: "#FEF2F2", fg: "#B91C1C", btn: "linear-gradient(135deg,#DC2626,#991B1B)", shadow: "rgba(220,38,38,.28)" }
    : { bg: "#EFF5FF", fg: "#1D4ED8", btn: "linear-gradient(135deg,#1D4ED8,#123471)", shadow: "rgba(29,78,216,.28)" };

  return (
    <div style={overlay} className="tc-modal-backdrop" onClick={onCancel}>
      <div style={card} className="tc-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div style={{ ...iconWrap, background: t.bg, color: t.fg }}>
          {tone === "danger" ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
            </svg>
          )}
        </div>

        <h3 style={titleStyle}>{title}</h3>
        <p style={msgStyle}>{message}</p>

        <div style={row}>
          <button style={cancelBtn} className="tc-btn" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            style={{ ...okBtn, background: t.btn, boxShadow: `0 8px 20px ${t.shadow}` }}
            className="tc-btn tc-btn-primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */
const overlay = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20,
};
const card = {
  background: "#fff", borderRadius: 18, padding: "28px 26px", width: 420, maxWidth: "100%",
  textAlign: "center", boxShadow: "0 24px 56px rgba(10,37,89,.24)",
};
const iconWrap = {
  width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const titleStyle = { margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: "#0F172A" };
const msgStyle = { margin: 0, fontSize: 14, color: "#64748B", lineHeight: 1.6 };
const row = { display: "flex", gap: 10, marginTop: 22 };
const cancelBtn = {
  flex: 1, background: "#F1F5F9", color: "#334155", border: "none",
  borderRadius: 11, padding: "12px", fontSize: 14.5, fontWeight: 600, cursor: "pointer",
};
const okBtn = {
  flex: 1, color: "#fff", border: "none",
  borderRadius: 11, padding: "12px", fontSize: 14.5, fontWeight: 700, cursor: "pointer",
};
