/* ============================================================
   Hand-rolled EN / Filipino dictionary for the tourist-facing portal.
   Scope is intentionally limited (per product decision) to: navigation
   labels, key headings/buttons on Explore + Trail, and the heritage
   church descriptions/taglines. The admin side and Events/Feedback
   body copy stay English-only for now.
============================================================ */

// { en, fil } pairs for short UI strings. Use `{n}` as a placeholder token.
export const UI = {
  navExplore: { en: "Explore", fil: "Galugarin" },
  navTrail: { en: "Trail", fil: "Paglalakbay" },
  navEvents: { en: "Events", fil: "Mga Kaganapan" },
  navFeedback: { en: "Feedback", fil: "Puna" },

  // Explore page
  exploreTitle: { en: "Explore Mandaluyong", fil: "Galugarin ang Mandaluyong" },
  exploreSubtitle: {
    en: "Discover {n} tourist spots & heritage sites. Check in when you visit.",
    fil: "Tuklasin ang {n} tourist spot at heritage site. Mag-check-in kapag bumisita ka.",
  },
  placesVisited: { en: "of {n} places visited", fil: "sa {n} lugar ang nabisita na" },
  searchPlaces: { en: "Search places...", fil: "Maghanap ng lugar..." },
  noPlacesFound: { en: "No places found.", fil: "Walang nahanap na lugar." },

  bucketAll: { en: "All", fil: "Lahat" },
  bucketChurches: { en: "Churches", fil: "Mga Simbahan" },
  bucketLandmarks: { en: "Landmarks", fil: "Mga Tanawin" },
  bucketInstitutions: { en: "Institutions", fil: "Mga Institusyon" },
  bucketSchools: { en: "Schools", fil: "Mga Paaralan" },
  "bucketParks & Rec": { en: "Parks & Rec", fil: "Mga Parke" },
  bucketShopping: { en: "Shopping", fil: "Mga Mall" },
  bucketDining: { en: "Dining", fil: "Mga Kainan" },
  bucketHotels: { en: "Hotels", fil: "Mga Hotel" },
  "bucketShops & Business": { en: "Shops & Business", fil: "Mga Tindahan at Negosyo" },
  bucketOthers: { en: "Others", fil: "Iba Pa" },

  checkIn: { en: "Check in", fil: "Mag-check-in" },
  visited: { en: "Visited", fil: "Nabisita na" },
  locating: { en: "Locating…", fil: "Hinahanap ang lokasyon…" },
  feedbackBtn: { en: "Feedback", fil: "Magbigay ng Puna" },
  leaveFeedback: { en: "Leave Feedback", fil: "Magbigay ng Puna" },
  viewOnMap: { en: "View on Map", fil: "Tingnan sa Mapa" },
  about: { en: "About", fil: "Tungkol Dito" },
  recentReviews: { en: "Recent Reviews", fil: "Mga Kamakailang Puna" },
  rateVisit: { en: "How was your visit?", fil: "Kumusta ang bisita mo?" },
  shareExperience: { en: "Share your experience (optional)...", fil: "Ibahagi ang karanasan mo (opsyonal)..." },
  cancel: { en: "Cancel", fil: "Kanselahin" },
  submit: { en: "Submit", fil: "Isumite" },
  submitting: { en: "Submitting…", fil: "Isinusumite…" },

  // Trail page
  trailTitle: { en: "Heritage Church Trail", fil: "Paglalakbay sa mga Makasaysayang Simbahan" },
  trailSubtitle: {
    en: "Visit all {n} parish churches of Mandaluyong to earn your Digital Tourist Badge!",
    fil: "Bisitahin ang lahat ng {n} parish churches ng Mandaluyong para makuha ang iyong Digital Tourist Badge!",
  },
  badgeUnlocked: { en: "Badge unlocked — congratulations!", fil: "Nakuha na ang badge — congrats!" },
  moreChurches: { en: "more church(es) to unlock your badge", fil: "pang simbahan bago makuha ang badge" },
  yourHeritageJourney: { en: "Your Heritage Journey", fil: "Ang Iyong Paglalakbay" },
  nextStop: { en: "Next stop", fil: "Susunod na hintuan" },
  digitalBadge: { en: "Digital Tourist Badge", fil: "Digital Tourist Badge" },
  badgeUnlockedTitle: { en: "Digital Tourist Badge Unlocked!", fil: "Nakuha ang Digital Tourist Badge!" },
  progressPct: { en: "Progress: {n}% complete", fil: "Progreso: {n}% tapos na" },
  completedTrail: { en: "You completed the Mandaluyong Heritage Church Trail.", fil: "Nakumpleto mo na ang Heritage Church Trail ng Mandaluyong." },
  trailVisitedLabel: { en: "visited", fil: "nabisita" },
};

// Filter/category "type" labels used by TOURIST_SPOTS (see tcimsData.js).
export const SPOT_TYPE_NAMES = {
  "History and Culture": { en: "History and Culture", fil: "Kasaysayan at Kultura" },
  "Sports and Recreation Facilities": { en: "Sports and Recreation Facilities", fil: "Palakasan at Libangan" },
  "Others": { en: "Others", fil: "Iba pa" },
  "Shopping": { en: "Shopping", fil: "Pamimili" },
  "Special Events": { en: "Special Events", fil: "Mga Espesyal na Kaganapan" },
};

// Every distinct raw `category`/`type` value across HERITAGE_SITES + TOURIST_SPOTS,
// used for the small category label shown on each Explore card.
export const CATEGORY_FIL = {
  "Church": { en: "Church", fil: "Simbahan" },
  "Abbey": { en: "Abbey", fil: "Abbey" },
  "Historical Landmark": { en: "Historical Landmark", fil: "Makasaysayang Tanawin" },
  "Institution": { en: "Institution", fil: "Institusyon" },
  "School": { en: "School", fil: "Paaralan" },
  "Park": { en: "Park", fil: "Parke" },
  ...SPOT_TYPE_NAMES,
};

// Pick the localized category label, falling back to the raw value.
export function categoryLabel(raw, lang) {
  const pair = CATEGORY_FIL[raw];
  return pair ? pair[lang] || pair.en : raw;
}

// Localized label for a filter-chip "bucket" name (All/Churches/Landmarks/...).
const BUCKET_KEYS = {
  "All": "bucketAll", "Churches": "bucketChurches", "Landmarks": "bucketLandmarks",
  "Institutions": "bucketInstitutions", "Schools": "bucketSchools",
  "Parks & Rec": "bucketParks & Rec", "Shopping": "bucketShopping",
  "Dining": "bucketDining", "Hotels": "bucketHotels", "Shops & Business": "bucketShops & Business",
  "Others": "bucketOthers",
};
export function bucketLabel(bucket, lang) {
  const key = BUCKET_KEYS[bucket];
  if (!key) return bucket;
  return t(key, lang);
}

// Auto-generated TOURIST_SPOTS description template, e.g.
// "A popular Shopping destination in Mandaluyong City."
export function spotDescription(type, city, lang) {
  const typeName = SPOT_TYPE_NAMES[type] ? SPOT_TYPE_NAMES[type][lang] : type;
  return lang === "fil"
    ? `Isang sikat na destinasyon (${typeName}) sa ${city}.`
    : `A popular ${type.toLowerCase()} destination in ${city}.`;
}

// Filipino tagline/description overrides for the 10 heritage churches,
// keyed by the exact `name` field in tcimsData.js HERITAGE_SITES.
export const HERITAGE_FIL = {
  "San Felipe Neri Parish Church": {
    tagline: "Itinatag noong 1863 · Pinakaluma sa lungsod",
    description: "Isa sa pinakalumang simbahan sa metropolis, itinatag noong 1863 bilang sentro ng orihinal na bayan ng San Felipe Neri.",
  },
  "San Roque de Barangka Parish Church": {
    tagline: "Makasaysayang pook sa tabing-ilog",
    description: "Parokya na naglilingkod sa komunidad ng Barangka Ilaya.",
  },
  "Villa San Miguel - Archbishop's Place": {
    description: "Opisyal na tirahan ng Arsobispo ng Maynila.",
  },
  "St. Francis of Assisi Parish Church": {
    tagline: "Pamanang Pransiskano",
    description: "Parokya sa tabi ng Shaw Boulevard.",
  },
  "Santuario de San Jose Parish Church": {
    tagline: "Nakatalaga kay San Jose",
    description: "Parokya na naglilingkod sa komunidad ng Greenhills.",
  },
  "Our Lady of the Abandoned Parish": {
    tagline: "Parokyang Marian",
    description: "Parokya sa tabing-ilog sa Barangay Hulo.",
  },
  "Our Lady of Fatima Parish Church": {
    tagline: "Parokyang Marian",
    description: "Parokya na naglilingkod sa Highway Hills.",
  },
  "Sacred Heart of Jesus Parish Church": {
    tagline: "Komunidad ng Welfareville",
    description: "Parokyang nakatalaga sa Banal na Puso ni Hesus.",
  },
  "St. Dominic Savio Parish Church": {
    tagline: "Komunidad Salesian",
    description: "Parokyang pinangalanan kay St. Dominic Savio.",
  },
  "Archdiocesan Shrine of the Divine Mercy": {
    tagline: "Dambanang pilgrimahan",
    description: "Dambanang nakatalaga sa Divine Mercy sa Maysilo Circle.",
  },
};

// Small helper: pick "en" or "fil" from a UI dictionary entry, filling {n}.
export function t(key, lang, vars = {}) {
  const entry = UI[key];
  let str = entry ? (entry[lang] || entry.en) : key;
  Object.keys(vars).forEach((k) => {
    str = str.replaceAll(`{${k}}`, vars[k]);
  });
  return str;
}
