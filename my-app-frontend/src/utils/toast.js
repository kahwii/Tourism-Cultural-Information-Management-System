/* ============================================================
   Lightweight toast notifications (no dependency).
   Usage:  import { toast } from "../utils/toast";
           toast.success("Saved!"); toast.error("..."); toast.info("...");
============================================================ */

let container = null;
function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:360px;width:calc(100% - 40px);pointer-events:none;";
  document.body.appendChild(container);
  return container;
}

const THEME = {
  success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", bar: "#16a34a" },
  error:   { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", bar: "#dc2626" },
  info:    { bg: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a", bar: "#2563eb" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", bar: "#f59e0b" },
};

export function showToast(message, type = "info", ms = 3800) {
  if (typeof document === "undefined" || !message) return () => {};
  const c = ensureContainer();
  const col = THEME[type] || THEME.info;

  const el = document.createElement("div");
  el.style.cssText =
    `pointer-events:auto;display:flex;align-items:flex-start;gap:10px;background:${col.bg};` +
    `border:1px solid ${col.border};border-left:5px solid ${col.bar};color:${col.text};` +
    `padding:12px 14px;border-radius:10px;box-shadow:0 10px 30px rgba(2,6,23,0.15);` +
    `font:600 14px/1.45 'Segoe UI',system-ui,sans-serif;white-space:pre-line;` +
    `opacity:0;transform:translateX(24px);transition:opacity .25s ease, transform .25s ease;cursor:pointer;`;
  el.textContent = message; // textContent = safe from HTML injection
  c.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateX(0)"; });

  let done = false;
  const dismiss = () => {
    if (done) return; done = true;
    clearTimeout(timer);
    el.style.opacity = "0"; el.style.transform = "translateX(24px)";
    setTimeout(() => el.remove(), 260);
  };
  el.addEventListener("click", dismiss);
  const timer = setTimeout(dismiss, ms);
  return dismiss;
}

export const toast = {
  success: (m, ms) => showToast(m, "success", ms),
  error:   (m, ms) => showToast(m, "error", ms),
  info:    (m, ms) => showToast(m, "info", ms),
  warning: (m, ms) => showToast(m, "warning", ms),
};

export default toast;
