<?php
/*
  Single source of truth for "what counts as the Heritage Church Trail"
  on the backend. Kept as a literal list (not the heritage_sites DB table)
  so it always matches exactly what the tourist sees on their Trail page —
  src/data/tcimsData.js, category === "Church" (9 parish churches).

  Used by both:
    - api/claim_reward.php (Heritage Mug — must require ALL 9, same as here)
    - api/certificate.php  (Trail Certificate — must require ALL 9, same as here)
  Previously these two used DIFFERENT completion criteria (claim_reward.php
  queried the heritage_sites DB table across 4 categories), so a tourist
  could see "9/9" on the Trail page yet still get "Trail not yet complete"
  when claiming the mug. Fixed by having both read from here.
*/

$TRAIL_CHURCHES = [
    "San Felipe Neri Parish Church",
    "San Roque de Barangka Parish Church",
    "St. Francis of Assisi Parish Church",
    "Santuario de San Jose Parish Church",
    "Our Lady of the Abandoned Parish",
    "Our Lady of Fatima Parish Church",
    "Sacred Heart of Jesus Parish Church",
    "St. Dominic Savio Parish Church",
    "Archdiocesan Shrine of the Divine Mercy",
];

// Returns ["done" => int, "total" => int, "completed" => bool, "date" => string|null (latest visit)]
function trail_status($conn, $uid, $churches) {
    $in = "'" . implode("','", array_map(fn($c) => mysqli_real_escape_string($conn, $c), $churches)) . "'";
    $res = mysqli_query($conn,
        "SELECT place, MAX(visited_at) AS last_visit FROM visits
         WHERE user_id = $uid AND place IN ($in) GROUP BY place");
    $visitedCount = 0;
    $latest = null;
    while ($r = mysqli_fetch_assoc($res)) {
        $visitedCount++;
        if ($latest === null || $r['last_visit'] > $latest) $latest = $r['last_visit'];
    }
    $total = count($churches);
    return ["done" => $visitedCount, "total" => $total, "completed" => $visitedCount >= $total, "date" => $latest];
}
