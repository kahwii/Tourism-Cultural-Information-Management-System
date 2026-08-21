<?php
/*
  ONE-TIME MIGRATION — seeds tourist_spots and heritage_sites from the
  hardcoded list that used to live only in the frontend
  (my-app-frontend/src/data/tcimsData.js: TOURIST_SPOTS + HERITAGE_SITES).

  Why this exists: until now, the public Explore/Trail pages read that
  hardcoded list directly, completely bypassing these two database tables.
  The admin "Tourist Spots" / "Heritage Sites" pages edited a database that
  nothing public ever read. This script backfills the tables with the same
  39 places (+ ~44 photos already sitting in uploads/places, copied from
  the frontend's public/places/ folder) so the frontend can be switched to
  read from the database instead — see TouristExplore.jsx / TouristTrail.jsx.

  SAFE TO RUN MORE THAN ONCE: matches existing rows by normalised name and
  only fills in columns that are still empty. It will never overwrite a
  name, category, contact info, or status that CCAT staff already edited
  through the admin pages — it only fills gaps (coordinates, image,
  description, etc.) and inserts places that aren't in the table yet.

  Usage: visit /api/migrate_places.php?key=tcims_eval in a browser once,
  locally and again after deploying. Remove this file once both tables are
  confirmed seeded on the live host — it's a setup tool, not something that
  should stay reachable indefinitely (see .gitignore).
*/

require_once "../config/cors.php";
require_once "../config/db.php";

const MIGRATE_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== MIGRATE_KEY) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

function tcims_slug($s) {
    $s = strtolower($s);
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-');
}
function tcims_normalize($s) {
    $s = strtolower($s);
    $s = preg_replace('/\bparish\b/', '', $s);
    $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
    return trim($s);
}
// Photos already copied into uploads/places/<slug>.jpg (from the old
// public/places/ folder) — reuse them as the initial `image` value.
function tcims_seed_image($name) {
    $slug = tcims_slug($name);
    $rel  = "uploads/places/{$slug}.jpg";
    $abs  = realpath(__DIR__ . "/..") . "/" . $rel;
    return is_file($abs) ? $rel : null;
}

/* ---------------------------------------------------------------
   Source data — transcribed verbatim from tcimsData.js.
   --------------------------------------------------------------- */
$TOURIST_SPOTS = [
    ["name" => "Tatlong Bayani Monument",              "type" => "History and Culture",              "brgy" => "Hagdang Bato",     "coordinates" => "14.5880, 121.0330"],
    ["name" => "Liberation Plaza / Liwasang Katubusan", "type" => "History and Culture",              "brgy" => "Pag-Asa",          "coordinates" => "14.5903, 121.0246"],
    ["name" => "San Felipe Neri Church",                "type" => "History and Culture",              "brgy" => "Poblacion",        "coordinates" => "14.5861, 121.0263"],
    ["name" => "Wack-Wack Golf & Country Club",         "type" => "Sports and Recreation Facilities", "brgy" => "Wack-Wack",        "coordinates" => "14.5931, 121.0496"],
    ["name" => "National Center for Mental Health",     "type" => "Others",                           "brgy" => "Mauway",           "coordinates" => "14.5814, 121.0437"],
    ["name" => "Correctional Institution for Women",    "type" => "Others",                           "brgy" => "Addition Hills",   "coordinates" => "14.5820, 121.0384"],
    ["name" => "San Miguel Corporation Head Office",    "type" => "Others",                           "brgy" => "Wack-Wack",        "coordinates" => "14.5817, 121.0582"],
    ["name" => "Don Bosco Museum",                      "type" => "Others",                           "brgy" => "Pag-Asa",          "coordinates" => "14.5901, 121.0256"],
    ["name" => "Lourdes School of Mandaluyong",         "type" => "Others",                           "brgy" => "Wack-Wack",        "coordinates" => "14.5794, 121.0570"],
    ["name" => "La Salle Greenhills",                   "type" => "Others",                           "brgy" => "Wack-Wack",        "coordinates" => "14.5971, 121.0552"],
    ["name" => "SM Megamall",                           "type" => "Shopping",                         "brgy" => "Wack-Wack",        "coordinates" => "14.5844, 121.0568"],
    ["name" => "Shangri-La Plaza Mall",                 "type" => "Shopping",                         "brgy" => "Wack-Wack",        "coordinates" => "14.5812, 121.0551"],
    ["name" => "The Podium",                            "type" => "Shopping",                         "brgy" => "Wack-Wack",        "coordinates" => "14.5859, 121.0596"],
    ["name" => "Greenfield District Central Park",      "type" => "Special Events",                   "brgy" => "Highway Hills",    "coordinates" => "14.5775, 121.0544"],
];
$CITY = "Mandaluyong City";

$HERITAGE_SITES = [
    ["name" => "San Felipe Neri Parish Church", "category" => "Church", "tagline" => "Established 1863 · Oldest in the city", "est" => "1863", "location" => "Boni Avenue cor. Aglipay St., Poblacion, Mandaluyong City", "description" => "One of the oldest churches in the metropolis, established in 1863 as the core of the original pueblo of San Felipe Neri.", "significance" => "The birthplace of the city's religious and cultural identity.", "coordinates" => "14.5861, 121.0263"],
    ["name" => "San Roque de Barangka Parish Church", "category" => "Church", "tagline" => "Historic riverside district", "est" => "—", "location" => "Pulog St., Brgy. Barangka Ilaya, Mandaluyong City", "description" => "Parish church serving the Barangka Ilaya community.", "significance" => "A long-standing community parish.", "coordinates" => "14.5727, 121.0449"],
    ["name" => "Villa San Miguel - Archbishop's Place", "category" => "Abbey", "tagline" => "", "est" => "—", "location" => "Shaw Blvd. cor. E. Rodriguez St., Mandaluyong City", "description" => "Official residence of the Archbishop of Manila.", "significance" => "Important ecclesiastical seat of the Archdiocese of Manila.", "coordinates" => "14.5815, 121.0525"],
    ["name" => "St. Francis of Assisi Parish Church", "category" => "Church", "tagline" => "Franciscan heritage", "est" => "—", "location" => "Behind Shangri-La Plaza, Ortigas Center (Shaw Blvd.), Mandaluyong City", "description" => "Parish church along Shaw Boulevard.", "significance" => "A prominent place of worship in the city.", "coordinates" => "14.5794, 121.0570"],
    ["name" => "Santuario de San Jose Parish Church", "category" => "Church", "tagline" => "Devoted to St. Joseph", "est" => "—", "location" => "Greenhills, Mandaluyong City", "description" => "Parish church serving the Greenhills community.", "significance" => "Center of worship in the Greenhills area.", "coordinates" => "14.6003, 121.0531"],
    ["name" => "Our Lady of the Abandoned Parish", "category" => "Church", "tagline" => "Marian parish", "est" => "—", "location" => "Coronado St., Brgy. Hulo, Mandaluyong City", "description" => "Riverside parish in Barangay Hulo.", "significance" => "A historic parish near the Pasig River.", "coordinates" => "14.5679, 121.0343"],
    ["name" => "Our Lady of Fatima Parish Church", "category" => "Church", "tagline" => "Marian parish", "est" => "—", "location" => "Liko St. cor. Mariveles St., Brgy. Highway Hills, Mandaluyong City", "description" => "Parish church serving Highway Hills.", "significance" => "Community church of the Highway Hills district.", "coordinates" => "14.5807, 121.0471"],
    ["name" => "Sacred Heart of Jesus Parish Church", "category" => "Church", "tagline" => "Welfareville community", "est" => "—", "location" => "Welfareville Compound, Mandaluyong City", "description" => "Parish church devoted to the Sacred Heart of Jesus.", "significance" => "A center of devotion in the city.", "coordinates" => "14.5859, 121.0342"],
    ["name" => "St. Dominic Savio Parish Church", "category" => "Church", "tagline" => "Salesian community", "est" => "—", "location" => "Pag-Asa St., beside Don Bosco, Mandaluyong City", "description" => "Parish church named after St. Dominic Savio.", "significance" => "A community place of worship.", "coordinates" => "14.5904, 121.0276"],
    ["name" => "Archdiocesan Shrine of the Divine Mercy", "category" => "Church", "tagline" => "Pilgrimage shrine", "est" => "—", "location" => "Maysilo Circle, near Mandaluyong City Hall, Mandaluyong City", "description" => "Shrine devoted to the Divine Mercy at Maysilo Circle.", "significance" => "Focal point of religious devotion in the city center.", "coordinates" => "14.5766, 121.0339"],
    ["name" => "Tatlong Bayani Statue", "category" => "Historical Landmark", "tagline" => "", "est" => "—", "location" => "Plaza Tatlong Bayani, Brgy. Hagdang Bato Itaas, Mandaluyong City", "description" => "Statue honoring three local heroes of Mandaluyong.", "significance" => "Commemorates Mandaleño heroism.", "coordinates" => "14.5880, 121.0330"],
    ["name" => "Liberation Marker", "category" => "Historical Landmark", "tagline" => "", "est" => "—", "location" => "Gen. Kalentong St., Brgy. Pag-Asa, Mandaluyong City", "description" => "Marker commemorating the liberation of Mandaluyong.", "significance" => "Reminder of the city's wartime history.", "coordinates" => "14.5903, 121.0246"],
    ["name" => "Dambana ng Ala-Ala", "category" => "Historical Landmark", "tagline" => "", "est" => "—", "location" => "Maysilo Circle, Mandaluyong City", "description" => "Memorial shrine of remembrance.", "significance" => "Honors the memory of fallen Mandaleños.", "coordinates" => "14.5781, 121.0331"],
    ["name" => "Dove of Peace", "category" => "Historical Landmark", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Monument symbolizing peace.", "significance" => "A symbol of unity and peace for the city.", "coordinates" => "14.5834, 121.0559"],
    ["name" => "Bantayog ng Kabataan", "category" => "Historical Landmark", "tagline" => "", "est" => "—", "location" => "Mandaluyong City Hall Complex", "description" => "Monument dedicated to the youth.", "significance" => "Celebrates the role of the youth in the community.", "coordinates" => "14.5779, 121.0342"],
    ["name" => "National Center for Mental Health", "category" => "Institution", "tagline" => "", "est" => "—", "location" => "9 de Pebrero St., Mandaluyong City", "description" => "The country's main psychiatric hospital.", "significance" => "A major national health institution based in the city.", "coordinates" => "14.5814, 121.0437"],
    ["name" => "Correctional Institution for Women", "category" => "Institution", "tagline" => "", "est" => "—", "location" => "Welfareville Compound, Mandaluyong City", "description" => "Historic penal institution for women.", "significance" => "A notable institutional landmark in Welfareville.", "coordinates" => "14.5820, 121.0384"],
    ["name" => "Asian Development Bank", "category" => "Institution", "tagline" => "", "est" => "—", "location" => "ADB Ave., Ortigas Center, Mandaluyong City", "description" => "Headquarters of the Asian Development Bank.", "significance" => "A globally significant institution located in the city.", "coordinates" => "14.5873, 121.0597"],
    ["name" => "Wack-Wack Golf and Country Club", "category" => "Institution", "tagline" => "", "est" => "—", "location" => "Wack-Wack, Mandaluyong City", "description" => "Internationally known private golf course.", "significance" => "A premier sports and recreation landmark.", "coordinates" => "14.5931, 121.0496"],
    ["name" => "San Miguel Main Office", "category" => "Institution", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Corporate office of San Miguel.", "significance" => "A major corporate landmark in the city.", "coordinates" => "14.5817, 121.0582"],
    ["name" => "Don Bosco Technical College", "category" => "School", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Catholic technical college.", "significance" => "A long-established educational institution.", "coordinates" => "14.5901, 121.0256"],
    ["name" => "Jose Rizal University", "category" => "School", "tagline" => "", "est" => "—", "location" => "Shaw Blvd., Mandaluyong City", "description" => "Private university along Shaw Boulevard.", "significance" => "One of the city's notable universities.", "coordinates" => "14.5925, 121.0285"],
    ["name" => "Rizal Technological University", "category" => "School", "tagline" => "", "est" => "—", "location" => "Boni Avenue, Mandaluyong City", "description" => "State university offering technical programs.", "significance" => "A key public higher-education institution.", "coordinates" => "14.5742, 121.0420"],
    ["name" => "La Salle Greenhills", "category" => "School", "tagline" => "", "est" => "—", "location" => "Ortigas Ave., Mandaluyong City", "description" => "Private Catholic school for boys.", "significance" => "A prominent educational institution.", "coordinates" => "14.5971, 121.0552"],
    ["name" => "Lourdes School of Mandaluyong", "category" => "School", "tagline" => "", "est" => "—", "location" => "Shaw Blvd., Mandaluyong City", "description" => "Private Catholic school.", "significance" => "A well-known school in the city.", "coordinates" => "14.5794, 121.0570"],
    ["name" => "Arellano University - Plaridel", "category" => "School", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Campus of Arellano University.", "significance" => "A notable educational institution.", "coordinates" => "14.5914, 121.0246"],
    ["name" => "Mandaluyong Elementary School", "category" => "School", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Public elementary school.", "significance" => "One of the city's foundational public schools.", "coordinates" => "14.5863, 121.0258"],
    ["name" => "Hardin ng Pag-Asa", "category" => "Park", "tagline" => "", "est" => "—", "location" => "Mandaluyong City", "description" => "Public garden park.", "significance" => "A green public space for residents.", "coordinates" => "14.5897, 121.0241"],
    ["name" => "Vergara Linear Park", "category" => "Park", "tagline" => "", "est" => "—", "location" => "Brgy. Vergara, Mandaluyong City", "description" => "Linear park in Barangay Vergara.", "significance" => "A community recreational space.", "coordinates" => "14.5765, 121.0236"],
    ["name" => "Garden of Life Park", "category" => "Park", "tagline" => "", "est" => "—", "location" => "Brgy. Vergara, Mandaluyong City", "description" => "Public park promoting greenery.", "significance" => "An environmental and recreational landmark.", "coordinates" => "14.5781, 121.0266"],
];

$report = ["tourist_spots" => ["inserted" => [], "filled" => [], "skipped" => []], "heritage_sites" => ["inserted" => [], "filled" => [], "skipped" => []]];

/* ---------------------------------------------------------------
   tourist_spots
   --------------------------------------------------------------- */
$existing = [];
$res = mysqli_query($conn, "SELECT id, name, category, address, coordinates, image FROM tourist_spots");
while ($r = mysqli_fetch_assoc($res)) { $existing[tcims_normalize($r['name'])] = $r; }

foreach ($TOURIST_SPOTS as $s) {
    $key = tcims_normalize($s['name']);
    $image = tcims_seed_image($s['name']);
    $address = $s['brgy'] . ", " . $CITY;

    if (isset($existing[$key])) {
        $row = $existing[$key];
        $sets = []; $types = ""; $vals = [];
        if (($row['coordinates'] ?? '') === '' || $row['coordinates'] === null) { $sets[] = "coordinates = ?"; $types .= "s"; $vals[] = $s['coordinates']; }
        if (($row['image'] ?? '') === '' || $row['image'] === null) { $sets[] = "image = ?"; $types .= "s"; $vals[] = $image; }
        if ($sets) {
            $sql = "UPDATE tourist_spots SET " . implode(", ", $sets) . " WHERE id = ?";
            $types .= "i"; $vals[] = $row['id'];
            $stmt = mysqli_prepare($conn, $sql);
            mysqli_stmt_bind_param($stmt, $types, ...$vals);
            mysqli_stmt_execute($stmt);
            $report["tourist_spots"]["filled"][] = $s['name'];
        } else {
            $report["tourist_spots"]["skipped"][] = $s['name'];
        }
    } else {
        $stmt = mysqli_prepare($conn, "INSERT INTO tourist_spots (name, category, address, status, coordinates, image) VALUES (?, ?, ?, 'Active', ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssss", $s['name'], $s['type'], $address, $s['coordinates'], $image);
        mysqli_stmt_execute($stmt);
        $report["tourist_spots"]["inserted"][] = $s['name'];
    }
}

/* ---------------------------------------------------------------
   heritage_sites
   --------------------------------------------------------------- */
$existing = [];
$res = mysqli_query($conn, "SELECT id, name, tagline, est, location, description, significance, coordinates, image FROM heritage_sites");
while ($r = mysqli_fetch_assoc($res)) { $existing[tcims_normalize($r['name'])] = $r; }

foreach ($HERITAGE_SITES as $h) {
    $key = tcims_normalize($h['name']);
    $image = tcims_seed_image($h['name']);

    if (isset($existing[$key])) {
        $row = $existing[$key];
        $sets = []; $types = ""; $vals = [];
        $fillable = ["tagline" => $h['tagline'], "coordinates" => $h['coordinates'], "image" => $image];
        foreach ($fillable as $col => $val) {
            if (($row[$col] ?? '') === '' || $row[$col] === null) {
                if ($val === '' || $val === null) continue; // nothing to fill with either
                $sets[] = "$col = ?"; $types .= "s"; $vals[] = $val;
            }
        }
        if ($sets) {
            $sql = "UPDATE heritage_sites SET " . implode(", ", $sets) . " WHERE id = ?";
            $types .= "i"; $vals[] = $row['id'];
            $stmt = mysqli_prepare($conn, $sql);
            mysqli_stmt_bind_param($stmt, $types, ...$vals);
            mysqli_stmt_execute($stmt);
            $report["heritage_sites"]["filled"][] = $h['name'];
        } else {
            $report["heritage_sites"]["skipped"][] = $h['name'];
        }
    } else {
        $stmt = mysqli_prepare($conn, "INSERT INTO heritage_sites (name, category, tagline, est, location, description, significance, status, coordinates, image) VALUES (?, ?, ?, ?, ?, ?, ?, 'Well-maintained', ?, ?)");
        mysqli_stmt_bind_param($stmt, "sssssssss", $h['name'], $h['category'], $h['tagline'], $h['est'], $h['location'], $h['description'], $h['significance'], $h['coordinates'], $image);
        mysqli_stmt_execute($stmt);
        $report["heritage_sites"]["inserted"][] = $h['name'];
    }
}

header("Content-Type: application/json");
echo json_encode($report, JSON_PRETTY_PRINT);
