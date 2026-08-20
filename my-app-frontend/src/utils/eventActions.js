// Helpers for the two tourist-facing event actions: "Add to Calendar" (.ics
// download, works with Google/Apple/Outlook calendar apps) and "View on Map"
// (Google Maps search link). Both are pure client-side — no backend needed.

const pad = (n) => String(n).padStart(2, "0");

// "HH:MM" (24h, from a <input type="time"> / DB TIME column) -> {h, m} or null.
function parseTime(t) {
  if (!t) return null;
  const [h, m] = String(t).split(":").map((x) => parseInt(x, 10));
  if (isNaN(h)) return null;
  return { h, m: isNaN(m) ? 0 : m };
}

// Escapes text per the iCalendar spec (comma, semicolon, backslash, newline).
const icsEscape = (s = "") =>
  String(s).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");

export function buildICS(ev) {
  const dateStr = ev.event_date; // "YYYY-MM-DD"
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const start = parseTime(ev.start_time);
  const end = parseTime(ev.end_time);

  let dtStart, dtEnd;
  if (start) {
    dtStart = `${y}${pad(mo)}${pad(d)}T${pad(start.h)}${pad(start.m)}00`;
    const e = end || { h: Math.min(start.h + 1, 23), m: start.m }; // default 1-hour block
    dtEnd = `${y}${pad(mo)}${pad(d)}T${pad(e.h)}${pad(e.m)}00`;
  } else {
    // All-day event: DTEND is exclusive, so it's the next calendar day.
    const next = new Date(y, mo - 1, d + 1);
    dtStart = `${y}${pad(mo)}${pad(d)}`;
    dtEnd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  }

  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const uid = `tcims-event-${ev.id || Math.random().toString(36).slice(2)}@mandaluyong`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TCIMS//Be@Mandaluyong Events//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    start ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${icsEscape(ev.name || "Mandaluyong Event")}`,
    ev.venue ? `LOCATION:${icsEscape(ev.venue)}` : "",
    ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

// Triggers a browser download of the event as a .ics file.
export function downloadICS(ev) {
  const ics = buildICS(ev);
  if (!ics) return false;
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.name || "event").replace(/[^\w\- ]+/g, "").trim() || "event"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

// Google Maps search link for an event's venue (falls back gracefully if no venue).
export function mapsUrlFor(venue) {
  if (!venue) return null;
  const q = encodeURIComponent(`${venue}, Mandaluyong City, Philippines`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// Direct "Add event" link into Google Calendar (no file download/import step —
// works on any device signed into Google, which covers most Android users).
export function googleCalendarUrlFor(ev) {
  const dateStr = ev.event_date;
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  const start = parseTime(ev.start_time);
  const end = parseTime(ev.end_time);

  let dates;
  if (start) {
    const e = end || { h: Math.min(start.h + 1, 23), m: start.m };
    dates = `${y}${pad(mo)}${pad(d)}T${pad(start.h)}${pad(start.m)}00/${y}${pad(mo)}${pad(d)}T${pad(e.h)}${pad(e.m)}00`;
  } else {
    const next = new Date(y, mo - 1, d + 1);
    dates = `${y}${pad(mo)}${pad(d)}/${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.name || "Mandaluyong Event",
    dates,
    details: ev.description || "",
    location: ev.venue ? `${ev.venue}, Mandaluyong City, Philippines` : "Mandaluyong City, Philippines",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
