// Live status of an event derived from its date (not a stored, stale field).
// An admin can still mark an event "Cancelled" and that is respected.
export function eventStatus(ev = {}) {
  if (ev.status === "Cancelled") return { key: "cancelled", label: "Cancelled" };

  const raw = ev.event_date;
  const d = raw ? new Date(String(raw) + "T00:00:00") : null;
  if (!d || isNaN(d)) return { key: "scheduled", label: ev.status || "Scheduled" };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  if (day > today.getTime()) return { key: "upcoming", label: "Upcoming" };
  if (day === today.getTime()) return { key: "today", label: "Happening Today" };
  return { key: "ended", label: "Ended" };
}

// Already finished — hidden from tourists by default.
export const isPastEvent = (ev) => eventStatus(ev).key === "ended";

// What tourists should see: not ended and not cancelled.
export const isLiveForTourist = (ev) => {
  const k = eventStatus(ev).key;
  return k !== "ended" && k !== "cancelled";
};
