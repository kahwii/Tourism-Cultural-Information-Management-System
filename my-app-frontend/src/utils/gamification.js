/* ============================================================
   Gamification scoring — points & tiers derived from real
   DB activity (check-ins + reviews). No separate storage needed.
============================================================ */

export const POINTS_PER_CHECKIN = 10;
export const POINTS_PER_REVIEW = 5;

export function computePoints({ checkins = 0, reviews = 0 }) {
  return checkins * POINTS_PER_CHECKIN + reviews * POINTS_PER_REVIEW;
}

// Tiers based on number of check-ins.
const TIERS = [
  { name: "Explorer",  icon: "", color: "#64748b", min: 0 },
  { name: "Bronze",    icon: "", color: "#b45309", min: 3 },
  { name: "Silver",    icon: "", color: "#6b7280", min: 6 },
  { name: "Gold",      icon: "", color: "#f59e0b", min: 10 },
  { name: "Heritage Master", icon: "", color: "#7c3aed", min: 16 },
];

export function tierFor(checkins = 0) {
  let current = TIERS[0], next = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (checkins >= TIERS[i].min) { current = TIERS[i]; next = TIERS[i + 1] || null; }
  }
  const toNext = next ? Math.max(0, next.min - checkins) : 0;
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(100, Math.round(((checkins - current.min) / span) * 100)) : 100;
  return { current, next, toNext, progress };
}
