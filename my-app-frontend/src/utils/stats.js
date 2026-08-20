/* ============================================================
   Descriptive statistics for the Tourism Report Analytics Dashboard.

   Kept separate from the dashboard component so the formulas can be
   read, checked, and cited on their own — for a thesis the definition
   used matters as much as the number produced.
============================================================ */

// Arithmetic mean.
export function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// Median — middle value; average of the two middle values when even.
// Reported alongside the mean because ratings are usually skewed: a few
// 1-star reviews drag the mean down more than they do the median, and the
// gap between the two is itself informative.
export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Mode — most frequent value(s). Returns an array, since a distribution
// can legitimately be bimodal (e.g. lots of 5s AND lots of 1s, which is a
// meaningful finding rather than an inconvenience to hide).
export function mode(nums) {
  if (!nums.length) return [];
  const freq = {};
  nums.forEach((n) => { freq[n] = (freq[n] || 0) + 1; });
  const max = Math.max(...Object.values(freq));
  return Object.keys(freq).filter((k) => freq[k] === max).map(Number).sort((a, b) => a - b);
}

// Population standard deviation (divide by N).
// The reviews on hand are the whole population of feedback received for the
// period, not a sample drawn from a larger pool, so N is correct here — using
// N-1 would be the sample estimator and would overstate the spread slightly.
export function stdDev(nums) {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length);
}

// How tightly ratings cluster, in plain language — so the number is usable
// by readers who don't work with standard deviations day to day.
export function spreadLabel(sd) {
  if (sd === 0) return "identical";
  if (sd < 0.6) return "very consistent";
  if (sd < 1.0) return "fairly consistent";
  if (sd < 1.4) return "mixed";
  return "highly polarised";
}

// Counts per star value, 1..5, always returning all five buckets so the
// histogram keeps its shape even when a rating never occurs.
export function ratingDistribution(nums) {
  const buckets = [1, 2, 3, 4, 5].map((star) => ({ star, count: 0 }));
  nums.forEach((n) => {
    const i = Math.round(n) - 1;
    if (i >= 0 && i < 5) buckets[i].count++;
  });
  const total = nums.length || 1;
  return buckets.map((b) => ({ ...b, pct: Math.round((b.count / total) * 100) }));
}

// Everything the dashboard needs, in one pass.
export function describe(nums) {
  const clean = nums.filter((n) => Number.isFinite(n) && n > 0);
  const sd = stdDev(clean);
  return {
    n: clean.length,
    mean: mean(clean),
    median: median(clean),
    mode: mode(clean),
    stdDev: sd,
    spread: spreadLabel(sd),
    min: clean.length ? Math.min(...clean) : 0,
    max: clean.length ? Math.max(...clean) : 0,
    distribution: ratingDistribution(clean),
  };
}

/* ---------- period-over-period ---------- */

// Percentage change from `prev` to `curr`.
// Returns null when there's no baseline: "+100%" from zero is misleading,
// and the dashboard renders that case as "no prior data" instead.
export function pctChange(curr, prev) {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

// Formats a delta for display, e.g. { text: "+23%", dir: "up" }.
// `higherIsBetter` lets a rise in negative sentiment read as bad, not good.
export function formatDelta(curr, prev, higherIsBetter = true) {
  const pct = pctChange(curr, prev);
  if (pct === null) return { text: "no prior data", dir: "flat", good: null };
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) return { text: "no change", dir: "flat", good: null };
  const up = pct > 0;
  return {
    text: `${up ? "+" : "−"}${rounded}%`,
    dir: up ? "up" : "down",
    good: higherIsBetter ? up : !up,
  };
}
