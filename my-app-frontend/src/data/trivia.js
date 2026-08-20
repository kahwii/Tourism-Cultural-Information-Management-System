/* ============================================================
   Trivia questions for the gamified check-in challenge.
   A tourist must answer correctly to complete a check-in.
============================================================ */

// General Mandaluyong trivia (stable facts).
const GENERAL = [
  { q: "In which region is Mandaluyong located?", choices: ["Central Luzon", "Metro Manila (NCR)", "CALABARZON", "Ilocos Region"], answer: 1 },
  { q: "Which major highway passes through Mandaluyong?", choices: ["Roxas Boulevard", "Katipunan Avenue", "EDSA", "Commonwealth Avenue"], answer: 2 },
  { q: "Which is one of the largest shopping malls in Mandaluyong?", choices: ["SM Megamall", "Ayala Center Cebu", "SM Mall of Asia", "Robinsons Galleria Cebu"], answer: 0 },
  { q: "What is the well-known nickname of Mandaluyong?", choices: ["Summer Capital", "City of Pines", "Tiger City of the Philippines", "Queen City of the South"], answer: 2 },
  { q: "Mandaluyong is what type of city?", choices: ["Component City", "Highly Urbanized City", "Municipality", "Barangay"], answer: 1 },
  { q: "Which boulevard is one of the main roads in Mandaluyong?", choices: ["Shaw Boulevard", "Taft Avenue", "Session Road", "Osmeña Boulevard"], answer: 0 },
  { q: "Mandaluyong is part of which group of cities?", choices: ["Greater Cebu", "Metro Davao", "Metro Manila", "Metro Iloilo"], answer: 2 },
  { q: "Which business district is part of Mandaluyong?", choices: ["Ortigas Center", "Makati CBD", "Bonifacio Global City", "Eastwood City"], answer: 0 },
];

// Optional place-specific questions (matched loosely by keyword in the name).
const BY_KEYWORD = [
  { match: /church|parish|santuario/i, q: "What type of heritage site is this?", choices: ["Church", "Museum", "Market", "School"], answer: 0 },
  { match: /school|university|college|lourdes|la salle|don bosco|rizal/i, q: "What type of institution is this?", choices: ["Hospital", "School", "Bank", "Hotel"], answer: 1 },
  { match: /mall|podium|megamall|shangri|greenfield/i, q: "What type of establishment is this?", choices: ["Church", "Shopping / Commercial", "Farm", "Factory"], answer: 1 },
  { match: /park|plaza|garden|hardin/i, q: "What type of place is this?", choices: ["Park / Open space", "Airport", "Hospital", "Market"], answer: 0 },
];

// Return a random trivia question appropriate for the place.
export function getTrivia(placeName = "") {
  const specific = BY_KEYWORD.filter(k => k.match.test(placeName));
  const pool = specific.length
    ? [...specific.map(({ q, choices, answer }) => ({ q, choices, answer })), ...GENERAL]
    : GENERAL;
  return pool[Math.floor(Math.random() * pool.length)];
}
