// Builds a continuous month-by-month series for "reviews per month" charts.
//
// Grouping reviews into a map keyed by month and only emitting months that
// actually have a review looks fine with dense, recent data, but it silently
// SKIPS empty months. A category-axis chart (Recharts XAxis with a string
// dataKey) spaces every data point evenly regardless of the real calendar
// gap between them — so a 3-year gap between two review dates renders as
// exactly one "step," identical in width to a genuine one-month gap
// elsewhere in the same chart. The result is a badly misleading trend line
// (years of history compressed flat, then a distorted spike). Filling every
// month in the range with 0 fixes that: spacing on screen then actually
// matches elapsed time.
const parseDate = (d) => { const dt = new Date(String(d).replace(" ", "T")); return isNaN(dt) ? null : dt; };

export function buildMonthlyTrend(reviews, { extendToToday = true } = {}) {
  const counts = {}; // "YYYY-MM" -> count
  let minTs = null, maxTs = null;

  reviews.forEach((r) => {
    const d = parseDate(r.created_at);
    if (!d) return;
    const y = d.getFullYear(), m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    counts[key] = (counts[key] || 0) + 1;
    const ts = new Date(y, m, 1).getTime();
    if (minTs === null || ts < minTs) minTs = ts;
    if (maxTs === null || ts > maxTs) maxTs = ts;
  });
  if (minTs === null) return [];

  if (extendToToday) {
    const now = new Date();
    const nowTs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    if (nowTs > maxTs) maxTs = nowTs;
  }

  const out = [];
  let cursor = new Date(minTs);
  while (cursor.getTime() <= maxTs) {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    out.push({
      month: cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      reviews: counts[key] || 0,
    });
    cursor = new Date(y, m + 1, 1);
  }
  return out;
}
