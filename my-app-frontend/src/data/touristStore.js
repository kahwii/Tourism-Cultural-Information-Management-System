/* ============================================================
   Tourist activity store (Be@Mandaluyong)
   Uses localStorage so visited spots, feedback, and badge
   progress persist across pages and refresh.
    Replace with real API calls when the backend is connected.
============================================================ */

const VISITED_KEY = "tcims_visited";
const FEEDBACK_KEY = "tcims_feedback";

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* ---- visited spots (check-ins) ---- */
export function getVisited() {
  return read(VISITED_KEY);
}
export function isVisited(name) {
  return read(VISITED_KEY).includes(name);
}
export function toggleVisited(name) {
  const list = read(VISITED_KEY);
  const next = list.includes(name) ? list.filter(n => n !== name) : [...list, name];
  write(VISITED_KEY, next);
  return next;
}

/* ---- feedback / ratings ---- */
export function getFeedback() {
  return read(FEEDBACK_KEY);
}
export function addFeedback(entry) {
  const list = read(FEEDBACK_KEY);
  const item = {
    id: list.length ? Math.max(...list.map(f => f.id)) + 1 : 1,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    ...entry
  };
  write(FEEDBACK_KEY, [item, ...list]);
  return item;
}

/* ---- simple keyword-based sentiment (placeholder for NLP) ---- */
export function quickSentiment(rating, comment = "") {
  const neg = /(dirty|bad|poor|hard|rude|slow|expensive|crowded|noisy|hassle)/i;
  const pos = /(clean|great|good|friendly|nice|excellent|accessible|beautiful|love|amazing)/i;
  if (rating >= 4 || pos.test(comment)) return "Positive";
  if (rating <= 2 || neg.test(comment)) return "Negative";
  return "Neutral";
}
