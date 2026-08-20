// Tourist's "Interested" events — a lightweight, per-device saved list (no
// backend table yet) used to (a) star events on the Events page and
// (b) power the day-of open-app notification in TouristLayout.jsx.
const KEY = "tcims_interested_events";

export function getInterested() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function isInterested(id) {
  return getInterested().includes(Number(id));
}

export function toggleInterested(id) {
  const n = Number(id);
  const cur = getInterested();
  const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
