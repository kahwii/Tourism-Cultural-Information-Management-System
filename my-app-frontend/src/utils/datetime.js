/*
  Dates coming back from the API are MySQL DATETIME/TIMESTAMP strings in UTC
  ("2026-09-14 13:58:05"), because the server runs in UTC.

  `new Date("2026-09-14T13:58:05")` — no timezone marker — is interpreted by
  the browser as LOCAL time, so a report filed at 9:58 PM in Manila was being
  displayed as 1:58 PM. Every timestamp in the admin panel was eight hours
  out, which is the kind of wrong that looks like a data problem rather than a
  formatting one: it made a report appear to arrive before it was sent.

  Appending "Z" tells the browser the value is UTC. Formatting is then pinned
  to Asia/Manila rather than the viewer's machine, so a printed report says
  Manila time no matter where it is opened — which is what a CCAT record
  should say.

  Use these instead of hand-rolling `new Date(...)` on an API value.
*/

export const MANILA = "Asia/Manila";

/** Parse a UTC datetime string from the API into a Date. Returns null if unusable. */
export function parseServerDate(d) {
  if (!d) return null;
  const raw = String(d).trim();
  // Already carries a zone/offset (ISO from some endpoints) — don't add another.
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
  const dt = new Date(raw.replace(" ", "T") + (hasZone ? "" : "Z"));
  return isNaN(dt) ? null : dt;
}

/** "Sep 14, 2026, 9:58 PM" in Manila time. */
export function fmtDateTime(d, fallback = "—") {
  const dt = parseServerDate(d);
  if (!dt) return d || fallback;
  return dt.toLocaleString("en-PH", {
    timeZone: MANILA,
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/** "Sep 14, 2026" in Manila time. */
export function fmtDate(d, fallback = "—") {
  const dt = parseServerDate(d);
  if (!dt) return d || fallback;
  return dt.toLocaleDateString("en-PH", {
    timeZone: MANILA,
    month: "short", day: "numeric", year: "numeric",
  });
}
