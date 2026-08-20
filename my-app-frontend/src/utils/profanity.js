// Profanity list (English + Filipino/Taglish) used to:
//   1. censor bad words when displaying feedback  (fuck -> fu*k)
//   2. force such words to the negative colour in the word cloud
// The backend sentiment engine also treats these as negative signals.
const PROFANITY = new Set([
  // English
  "fuck", "fucking", "fucker", "fuckin", "motherfucker", "shit", "shitty", "bullshit",
  "bitch", "asshole", "ass", "damn", "dick", "piss", "pissed", "crap", "bastard",
  "slut", "whore", "cunt", "wtf", "stfu", "dumbass", "jackass", "prick", "douche",
  "fuckyou", "fucku",
  // Filipino / Taglish (+ phonetic variants)
  "putangina", "putang", "puta", "tangina", "tanginamo", "gago", "gaga",
  "ulol", "bwisit", "buwiset", "buset", "leche", "letse", "pakshet", "pakshit",
  "pakyou", "pakyu", "fakyou", "fakyu", "tarantado", "hinayupak", "punyeta", "lintik",
  "yawa", "kingina", "kupal", "peste", "demonyo", "ungas", "siraulo",
  "putcha", "pucha", "shet", "shunga",
]);

// Distinctive profanity "roots" — matched as substrings so misspellings and
// run-together variants are still caught (e.g. "pvtangina", "putanginamo",
// "tanginamo" all contain "tangina"). Only long, unambiguous roots go here so
// clean words are never falsely flagged.
const ROOTS = [
  "tangina", "putang", "punyeta", "tarantado", "hinayupak", "kingina",
  "motherfuck", "putragis", "pakshet", "pakshit", "pakyou", "fakyou", "bwiset", "buwiset",
];

export function isProfane(word = "") {
  const w = String(word).toLowerCase();
  if (PROFANITY.has(w)) return true;
  return ROOTS.some((r) => w.includes(r));
}

// f**k-style mask that keeps the word recognisable but censored.
//   fuck -> fu*k   ·   shit -> sh*t   ·   putangina -> pu******a   ·   ass -> a*s
export function maskWord(word = "") {
  const w = String(word);
  if (w.length <= 2) return w;
  if (w.length === 3) return w[0] + "*" + w[2];
  return w.slice(0, 2) + "*".repeat(w.length - 3) + w.slice(-1);
}

// Censor any profanity found inside a longer comment, leaving the rest intact.
export function maskText(text = "") {
  return String(text).replace(/[A-Za-zÁÉÍÓÚáéíóúÑñ]+/g, (t) =>
    isProfane(t) ? maskWord(t) : t
  );
}
