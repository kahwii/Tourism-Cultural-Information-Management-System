/* ============================================================
   Contact-info helpers for the Tourism Directory (1.4).

   Shared so the four directory pages and the tourist-facing views
   agree on what counts as valid and how a value is displayed.
============================================================ */

// Philippine numbers arrive in many shapes: 0917 123 4567, +63 917 1234567,
// (02) 8123 4567, or several separated by "/". Rather than force one format
// on CCAT staff copying from a business card, accept anything that is mostly
// digits and long enough to be a real number.
export function isValidPhone(v) {
  const s = String(v || "").trim();
  if (s === "") return true;               // optional field
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 24 && /^[0-9+()\-.\s/]+$/.test(s);
}

export function isValidEmail(v) {
  const s = String(v || "").trim();
  if (s === "") return true;               // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Accepts "example.com", "www.example.com", or a full URL. Staff rarely type
// the scheme, so requiring https:// would reject most real input.
export function isValidWebsite(v) {
  const s = String(v || "").trim();
  if (s === "") return true;               // optional field
  return /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s);
}

// Add the scheme only for the href — the visible text stays as typed, so a
// listing shows "visitmandaluyong.ph" rather than a noisy full URL.
export function websiteHref(v) {
  const s = String(v || "").trim();
  if (s === "") return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

// Strip formatting for tel: links so the dialer gets clean digits.
export function telHref(v) {
  const s = String(v || "").trim();
  if (s === "") return "";
  // keep a leading + (country code) but drop spaces, dashes, and brackets
  const cleaned = s.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

// True when a record has at least one way to be contacted — used to decide
// whether to render a contact block at all instead of an empty heading.
export function hasContact(r) {
  return !!(String(r?.contact_no || "").trim()
    || String(r?.email || "").trim()
    || String(r?.website || "").trim());
}
