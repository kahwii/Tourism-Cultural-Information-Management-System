// Minimal RFC-4180-ish CSV parser (handles quoted fields with embedded
// commas/newlines/escaped quotes) — no external dependency needed for a
// simple "upload a spreadsheet of past feedback" import feature.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushField(); pushRow();
    } else if (c === "\r") {
      // skip; \n (if present) handles the row break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { pushField(); pushRow(); }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
}

// Historical spreadsheets rarely use our exact column names — accept common
// aliases so admins don't have to reformat their file first.
const ALIASES = {
  place: ["place", "location", "spot", "destination", "establishment", "tourist spot"],
  reviewer: ["reviewer", "name", "reviewer name", "respondent", "guest"],
  rating: ["rating", "star", "stars", "score"],
  comment: ["comment", "feedback", "review", "remarks", "comments"],
  date: ["date", "created_at", "timestamp", "date submitted", "date of visit"],
};

export function mapFeedbackRow(row) {
  const out = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const a of aliases) {
      if (row[a] !== undefined && row[a] !== "") { out[key] = row[a]; break; }
    }
  }
  return out;
}
