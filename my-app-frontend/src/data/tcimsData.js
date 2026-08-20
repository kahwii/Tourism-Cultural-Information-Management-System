/* ============================================================
   TCIMS reference data — Mandaluyong City
   Source: CCAT Dept. printed lists (Calendar of Activities 2026
   + List of Tourist Attractions).
   Use these arrays to populate Events and Tourism Directory pages.
============================================================ */

/* ---------- CALENDAR OF ACTIVITIES 2026 ---------- */
export const EVENTS_2026 = [
  { month: "January", event: "Regular Monday Morning Programs", category: "Morning Programs" },
  { month: "January", event: "Sto. Niño Images Exhibit", category: "Cultural & Religious Exhibit" },

  { month: "February", event: "Mandaluyong Liberation & Cityhood Anniversary", category: "Historical Event" },
  { month: "February", event: "Miss Mandaluyong Pageant", category: "Beauty Pageant" },
  { month: "February", event: "Bilbiling Mandaluyong Pageant", category: "Beauty Pageant" },
  { month: "February", event: "Kasalang Bayan", category: "Community Program" },
  { month: "February", event: "Mandaluyong Hymn Making Contest", category: "Music Competition" },
  { month: "February", event: "Trade Fair Exhibits", category: "Trade Fair" },
  { month: "February", event: "National Arts Month", category: "Cultural & Arts Program" },

  { month: "March/April", event: "Lenten Season Presentation", category: "Religious Festival" },
  { month: "March/April", event: "Pabasa ng Bayan / Cenakulo / Visita Iglesia", category: "Religious Festival" },
  { month: "March/April", event: "Carozza-Lenten Images Exhibit", category: "Cultural & Religious Exhibit" },
  { month: "March/April", event: "Araw ng Kagitingan", category: "Historical Event" },
  { month: "March/April", event: "Cultural & Arts Workshop", category: "Cultural & Arts Program" },
  { month: "March/April", event: "National Women's Month (March)", category: "National Observance" },
  { month: "March/April", event: "National Literature Month (April)", category: "Cultural & Arts Program" },
  { month: "March/April", event: "Flavors of NCR (Food Festival - ATO-NCR)", category: "Food Trade Fair" },

  { month: "May", event: "Maytime Festivals", category: "Religious/Fashion Events" },
  { month: "May", event: "Santa Cruzan / Flores de Mayo", category: "Religious/Fashion Events" },
  { month: "May", event: "National Heritage Month", category: "Cultural & Arts Program" },

  { month: "June", event: "Araw ng Kalayaan", category: "National Observance" },
  { month: "June", event: "Dr. Jose Rizal's Birth Anniversary", category: "National Observance" },
  { month: "June", event: "Filipino-Chinese Friendship Day", category: "National Observance" },

  { month: "July", event: "Saints Images Exhibit", category: "Cultural & Religious Exhibit" },
  { month: "July", event: "National Nutrition Month", category: "National Observance" },
  { month: "July", event: "National Culture Consciousness Week", category: "National Observance" },
  { month: "July", event: "Linggo ng Musikang Pilipino", category: "National Observance" },
  { month: "July", event: "Iglesia ni Cristo Day", category: "National Observance" },

  { month: "August", event: "29 de Agosto - Araw ng mga Bayani", category: "Historical Event" },
  { month: "August", event: "Buwan ng Wikang Pambansa", category: "National Observance" },
  { month: "August", event: "National History Month", category: "National Observance" },

  { month: "September", event: "Our Lady of Peñafrancia Feast", category: "Religious Event" },
  { month: "September", event: "National Tourism Week", category: "National Observance" },
  { month: "September", event: "National Literacy Day", category: "Cultural & Arts Program" },

  { month: "October", event: "Annual Convention of Association of Tourism Officers", category: "Conference" },
  { month: "October", event: "Marian Images Exhibit", category: "Cultural & Religious Exhibit" },
  { month: "October", event: "Museums and Galleries Month", category: "National Observance" },
  { month: "October", event: "National Archives Day", category: "National Observance" },

  { month: "November", event: "All Soul's Day", category: "Religious Event" },
  { month: "November", event: "Lavandero Festival", category: "City Festival" },
  { month: "November", event: "Pistang Daluyong", category: "Cultural Event" },
  { month: "November", event: "Library and Information Services Month", category: "National Observance" },
  { month: "November", event: "Bonifacio Day", category: "National Observance" },

  { month: "December", event: "Paskuhan sa Lungsod", category: "Christmas Festival / Trade Fair" },
  { month: "December", event: "Daluyong sa Mandaluyong", category: "Christmas Festival / Trade Fair" },
  { month: "December", event: "Christmas Parol Contest", category: "Christmas Festival / Trade Fair" },
  { month: "December", event: "Rizal Day", category: "National Observance" }
];

/* ---------- LIST OF TOURIST ATTRACTIONS ---------- */
export const TOURIST_SPOTS = [
  { id: 1,  name: "Tatlong Bayani Monument",            type: "History and Culture",              region: "NCR", city: "Mandaluyong City", brgy: "Hagdang Bato", coordinates: "14.5880, 121.0330" },
  { id: 2,  name: "Liberation Plaza / Liwasang Katubusan", type: "History and Culture",           region: "NCR", city: "Mandaluyong City", brgy: "Pag-Asa", coordinates: "14.5903, 121.0246" },
  { id: 3,  name: "San Felipe Neri Church",             type: "History and Culture",              region: "NCR", city: "Mandaluyong City", brgy: "Poblacion", coordinates: "14.5861, 121.0263" },
  { id: 4,  name: "Wack-Wack Golf & Country Club",      type: "Sports and Recreation Facilities", region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5931, 121.0496" },
  { id: 5,  name: "National Center for Mental Health",  type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Mauway", coordinates: "14.5814, 121.0437" },
  { id: 6,  name: "Correctional Institution for Women", type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Addition Hills", coordinates: "14.5820, 121.0384" },
  { id: 7,  name: "San Miguel Corporation Head Office", type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5817, 121.0582" },
  { id: 8,  name: "Don Bosco Museum",                   type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Pag-Asa", coordinates: "14.5901, 121.0256" },
  { id: 9,  name: "Lourdes School of Mandaluyong",      type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5794, 121.0570" },
  { id: 10, name: "La Salle Greenhills",                type: "Others",                           region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5971, 121.0552" },
  { id: 11, name: "SM Megamall",                        type: "Shopping",                         region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5844, 121.0568" },
  { id: 12, name: "Shangri-La Plaza Mall",             type: "Shopping",                         region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5812, 121.0551" },
  { id: 13, name: "The Podium",                         type: "Shopping",                         region: "NCR", city: "Mandaluyong City", brgy: "Wack-Wack", coordinates: "14.5859, 121.0596" },
  { id: 14, name: "Greenfield District Central Park",   type: "Special Events",                   region: "NCR", city: "Mandaluyong City", brgy: "Highway Hills", coordinates: "14.5775, 121.0544" }
];

/* ---------- CULTURAL HERITAGE SITES (CHIMS) ----------
   Source: City of Mandaluyong Tourism — Table 2.26 "Places of Interest"
   (https://mandaluyong.gov.ph/travel/). Establishment years and notes
   added where historically known; others marked "—".
*/
export const HERITAGE_SITES = [
  {
    id: 1, name: 'San Felipe Neri Parish Church', category: 'Church', est: '1863',
    tagline: 'Established 1863 · Oldest in the city',
    location: 'Boni Avenue cor. Aglipay St., Poblacion, Mandaluyong City',
    description: 'One of the oldest churches in the metropolis, established in 1863 as the core of the original pueblo of San Felipe Neri.',
    significance: "The birthplace of the city's religious and cultural identity.",
    status: "Well-maintained", coordinates: "14.5861, 121.0263", image: ""
  },
  {
    id: 2, name: 'San Roque de Barangka Parish Church', category: 'Church', est: '—',
    tagline: 'Historic riverside district',
    location: 'Pulog St., Brgy. Barangka Ilaya, Mandaluyong City',
    description: 'Parish church serving the Barangka Ilaya community.',
    significance: 'A long-standing community parish.',
    status: "Well-maintained", coordinates: "14.5727, 121.0449", image: ""
  },
  {
    id: 3, name: "Villa San Miguel - Archbishop's Place", category: 'Abbey', est: '—',
    location: 'Shaw Blvd. cor. E. Rodriguez St., Mandaluyong City',
    description: 'Official residence of the Archbishop of Manila.',
    significance: 'Important ecclesiastical seat of the Archdiocese of Manila.',
    status: "Well-maintained", coordinates: "14.5815, 121.0525", image: ""
  },
  {
    id: 4, name: 'St. Francis of Assisi Parish Church', category: 'Church', est: '—',
    tagline: 'Franciscan heritage',
    location: 'Behind Shangri-La Plaza, Ortigas Center (Shaw Blvd.), Mandaluyong City',
    description: 'Parish church along Shaw Boulevard.',
    significance: 'A prominent place of worship in the city.',
    status: "Well-maintained", coordinates: "14.5794, 121.0570", image: ""
  },
  {
    id: 5, name: 'Santuario de San Jose Parish Church', category: 'Church', est: '—',
    tagline: 'Devoted to St. Joseph',
    location: 'Greenhills, Mandaluyong City',
    description: 'Parish church serving the Greenhills community.',
    significance: 'Center of worship in the Greenhills area.',
    status: "Well-maintained", coordinates: "14.6003, 121.0531", image: ""
  },
  {
    id: 6, name: 'Our Lady of the Abandoned Parish', category: 'Church', est: '—',
    tagline: 'Marian parish',
    location: 'Coronado St., Brgy. Hulo, Mandaluyong City',
    description: 'Riverside parish in Barangay Hulo.',
    significance: 'A historic parish near the Pasig River.',
    status: "Well-maintained", coordinates: "14.5679, 121.0343", image: ""
  },
  {
    id: 7, name: 'Our Lady of Fatima Parish Church', category: 'Church', est: '—',
    tagline: 'Marian parish',
    location: 'Liko St. cor. Mariveles St., Brgy. Highway Hills, Mandaluyong City',
    description: 'Parish church serving Highway Hills.',
    significance: 'Community church of the Highway Hills district.',
    status: "Well-maintained", coordinates: "14.5807, 121.0471", image: ""
  },
  {
    id: 8, name: 'Sacred Heart of Jesus Parish Church', category: 'Church', est: '—',
    tagline: 'Welfareville community',
    location: 'Welfareville Compound, Mandaluyong City',
    description: 'Parish church devoted to the Sacred Heart of Jesus.',
    significance: 'A center of devotion in the city.',
    status: "Well-maintained", coordinates: "14.5859, 121.0342", image: ""
  },
  {
    id: 9, name: 'St. Dominic Savio Parish Church', category: 'Church', est: '—',
    tagline: 'Salesian community',
    location: 'Pag-Asa St., beside Don Bosco, Mandaluyong City',
    description: 'Parish church named after St. Dominic Savio.',
    significance: 'A community place of worship.',
    status: "Well-maintained", coordinates: "14.5904, 121.0276", image: ""
  },
  {
    id: 10, name: 'Archdiocesan Shrine of the Divine Mercy', category: 'Church', est: '—',
    tagline: 'Pilgrimage shrine',
    location: 'Maysilo Circle, near Mandaluyong City Hall, Mandaluyong City',
    description: 'Shrine devoted to the Divine Mercy at Maysilo Circle.',
    significance: 'Focal point of religious devotion in the city center.',
    status: "Well-maintained", coordinates: "14.5766, 121.0339", image: ""
  },
  {
    id: 12, name: 'Tatlong Bayani Statue', category: 'Historical Landmark', est: '—',
    location: 'Plaza Tatlong Bayani, Brgy. Hagdang Bato Itaas, Mandaluyong City',
    description: 'Statue honoring three local heroes of Mandaluyong.',
    significance: 'Commemorates Mandaleño heroism.',
    status: "Well-maintained", coordinates: "14.5880, 121.0330", image: ""
  },
  {
    id: 13, name: 'Liberation Marker', category: 'Historical Landmark', est: '—',
    location: 'Gen. Kalentong St., Brgy. Pag-Asa, Mandaluyong City',
    description: 'Marker commemorating the liberation of Mandaluyong.',
    significance: "Reminder of the city's wartime history.",
    status: "Well-maintained", coordinates: "14.5903, 121.0246", image: ""
  },
  {
    id: 14, name: 'Dambana ng Ala-Ala', category: 'Historical Landmark', est: '—',
    location: 'Maysilo Circle, Mandaluyong City',
    description: 'Memorial shrine of remembrance.',
    significance: 'Honors the memory of fallen Mandaleños.',
    status: "Well-maintained", coordinates: "14.5781, 121.0331", image: ""
  },
  {
    id: 15, name: 'Dove of Peace', category: 'Historical Landmark', est: '—',
    location: 'Mandaluyong City',
    description: 'Monument symbolizing peace.',
    significance: 'A symbol of unity and peace for the city.',
    status: "Well-maintained", coordinates: "14.5834, 121.0559", image: ""
  },
  {
    id: 16, name: 'Bantayog ng Kabataan', category: 'Historical Landmark', est: '—',
    location: 'Mandaluyong City Hall Complex',
    description: 'Monument dedicated to the youth.',
    significance: 'Celebrates the role of the youth in the community.',
    status: "Well-maintained", coordinates: "14.5779, 121.0342", image: ""
  },
  {
    id: 17, name: 'National Center for Mental Health', category: 'Institution', est: '—',
    location: '9 de Pebrero St., Mandaluyong City',
    description: "The country's main psychiatric hospital.",
    significance: 'A major national health institution based in the city.',
    status: "Well-maintained", coordinates: "14.5814, 121.0437", image: ""
  },
  {
    id: 18, name: 'Correctional Institution for Women', category: 'Institution', est: '—',
    location: 'Welfareville Compound, Mandaluyong City',
    description: 'Historic penal institution for women.',
    significance: 'A notable institutional landmark in Welfareville.',
    status: "Well-maintained", coordinates: "14.5820, 121.0384", image: ""
  },
  {
    id: 19, name: 'Asian Development Bank', category: 'Institution', est: '—',
    location: 'ADB Ave., Ortigas Center, Mandaluyong City',
    description: 'Headquarters of the Asian Development Bank.',
    significance: 'A globally significant institution located in the city.',
    status: "Well-maintained", coordinates: "14.5873, 121.0597", image: ""
  },
  {
    id: 20, name: 'Wack-Wack Golf and Country Club', category: 'Institution', est: '—',
    location: 'Wack-Wack, Mandaluyong City',
    description: 'Internationally known private golf course.',
    significance: 'A premier sports and recreation landmark.',
    status: "Well-maintained", coordinates: "14.5931, 121.0496", image: ""
  },
  {
    id: 21, name: 'San Miguel Main Office', category: 'Institution', est: '—',
    location: 'Mandaluyong City',
    description: 'Corporate office of San Miguel.',
    significance: 'A major corporate landmark in the city.',
    status: "Well-maintained", coordinates: "14.5817, 121.0582", image: ""
  },
  {
    id: 22, name: 'Don Bosco Technical College', category: 'School', est: '—',
    location: 'Mandaluyong City',
    description: 'Catholic technical college.',
    significance: 'A long-established educational institution.',
    status: "Well-maintained", coordinates: "14.5901, 121.0256", image: ""
  },
  {
    id: 23, name: 'Jose Rizal University', category: 'School', est: '—',
    location: 'Shaw Blvd., Mandaluyong City',
    description: 'Private university along Shaw Boulevard.',
    significance: "One of the city's notable universities.",
    status: "Well-maintained", coordinates: "14.5925, 121.0285", image: ""
  },
  {
    id: 24, name: 'Rizal Technological University', category: 'School', est: '—',
    location: 'Boni Avenue, Mandaluyong City',
    description: 'State university offering technical programs.',
    significance: 'A key public higher-education institution.',
    status: "Well-maintained", coordinates: "14.5742, 121.0420", image: ""
  },
  {
    id: 25, name: 'La Salle Greenhills', category: 'School', est: '—',
    location: 'Ortigas Ave., Mandaluyong City',
    description: 'Private Catholic school for boys.',
    significance: 'A prominent educational institution.',
    status: "Well-maintained", coordinates: "14.5971, 121.0552", image: ""
  },
  {
    id: 26, name: 'Lourdes School of Mandaluyong', category: 'School', est: '—',
    location: 'Shaw Blvd., Mandaluyong City',
    description: 'Private Catholic school.',
    significance: 'A well-known school in the city.',
    status: "Well-maintained", coordinates: "14.5794, 121.0570", image: ""
  },
  {
    id: 27, name: 'Arellano University - Plaridel', category: 'School', est: '—',
    location: 'Mandaluyong City',
    description: 'Campus of Arellano University.',
    significance: 'A notable educational institution.',
    status: "Well-maintained", coordinates: "14.5914, 121.0246", image: ""
  },
  {
    id: 28, name: 'Mandaluyong Elementary School', category: 'School', est: '—',
    location: 'Mandaluyong City',
    description: 'Public elementary school.',
    significance: "One of the city's foundational public schools.",
    status: "Well-maintained", coordinates: "14.5863, 121.0258", image: ""
  },
  {
    id: 29, name: 'Hardin ng Pag-Asa', category: 'Park', est: '—',
    location: 'Mandaluyong City',
    description: 'Public garden park.',
    significance: 'A green public space for residents.',
    status: "Well-maintained", coordinates: "14.5897, 121.0241", image: ""
  },
  {
    id: 30, name: 'Vergara Linear Park', category: 'Park', est: '—',
    location: 'Brgy. Vergara, Mandaluyong City',
    description: 'Linear park in Barangay Vergara.',
    significance: 'A community recreational space.',
    status: "Well-maintained", coordinates: "14.5765, 121.0236", image: ""
  },
  {
    id: 31, name: 'Garden of Life Park', category: 'Park', est: '—',
    location: 'Brgy. Vergara, Mandaluyong City',
    description: 'Public park promoting greenery.',
    significance: 'An environmental and recreational landmark.',
    status: "Well-maintained", coordinates: "14.5781, 121.0266", image: ""
  }
];

/* ---------- helper lists ---------- */
export const EVENT_CATEGORIES = [...new Set(EVENTS_2026.map(e => e.category))];
export const SPOT_TYPES = [...new Set(TOURIST_SPOTS.map(s => s.type))];
export const HERITAGE_CATEGORIES = [...new Set(HERITAGE_SITES.map(h => h.category))];
