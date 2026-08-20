// Shared password policy (modern complexity rules) used by Register + Account.
export const PW_RULES = [
  { key: "length",  label: "At least 8 characters",            test: (p) => (p || "").length >= 8 },
  { key: "upper",   label: "One uppercase letter (A–Z)",       test: (p) => /[A-Z]/.test(p || "") },
  { key: "lower",   label: "One lowercase letter (a–z)",       test: (p) => /[a-z]/.test(p || "") },
  { key: "number",  label: "One number (0–9)",                 test: (p) => /[0-9]/.test(p || "") },
  { key: "special", label: "One special symbol (@ ! # $ % …)", test: (p) => /[^A-Za-z0-9]/.test(p || "") },
];

export const pwChecks = (p) => PW_RULES.map((r) => ({ key: r.key, label: r.label, ok: r.test(p) }));
export const pwValid  = (p) => PW_RULES.every((r) => r.test(p));

export function pwStrength(p) {
  if (!p) return { pct: 0, label: "", color: "#e5e7eb" };
  const n = PW_RULES.filter((r) => r.test(p)).length;
  if (n <= 2) return { pct: 34, label: "Weak", color: "#ef4444" };
  if (n <= 4) return { pct: 67, label: "Medium", color: "#f59e0b" };
  return { pct: 100, label: "Strong", color: "#16a34a" };
}
