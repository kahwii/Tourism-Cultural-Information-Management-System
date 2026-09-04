<?php
/*
  Single source of truth for "what counts as the Heritage Church Trail" on
  the backend: the heritage_sites DB rows with category = 'Church'.

  Used by both:
    - api/claim_reward.php (Heritage Mug — must require ALL trail churches)
    - api/certificate.php  (Trail Certificate — must require ALL trail churches)
  Previously these two used DIFFERENT completion criteria (one queried
  heritage_sites across 4 categories, the other didn't query it at all), so
  a tourist could see "9/9" on the Trail page yet still get "Trail not yet
  complete" when claiming the mug. Fixed by having both call trail_status()
  with the same list, built here.

  IMPORTANT — this used to be a hardcoded PHP list of the 9 church names,
  kept in sync BY HAND with the frontend's Trail page. That was safe only
  because the Trail page's data source (src/data/tcimsData.js) was also
  hardcoded and never changed at runtime. Once heritage_sites became
  admin-editable (Heritage Sites CRUD + the Trail page reading from the
  same table via apiList), a hardcoded copy here would go stale the moment
  an admin renamed a church, fixed a typo, or changed its category —
  silently reintroducing the exact bug this file was written to prevent.
  So this now reads the SAME table the Trail page reads, live, every call:
  whatever 9 rows have category = 'Church' right now is the trail, on both
  sides, always in agreement.
*/

// Requires config/db.php to already be included ($conn in scope).
function trail_churches($conn) {
    $res = mysqli_query($conn, "SELECT name FROM heritage_sites WHERE category = 'Church' ORDER BY name");
    $out = [];
    if ($res) { while ($r = mysqli_fetch_assoc($res)) $out[] = $r['name']; }
    return $out;
}

// Populated once per request, right after config/db.php + this file are
// both loaded — existing callers can keep using $TRAIL_CHURCHES unchanged.
$TRAIL_CHURCHES = trail_churches($conn);

// Returns ["done" => int, "total" => int, "completed" => bool, "date" => string|null (latest visit)]
//
// Only counts verified = 1 rows — i.e. check-ins that went through
// checkin.php's GPS-proximity + selfie/site-photo flow. The Explore page's
// casual check-in (api/visits.php) writes verified = 0 rows precisely so it
// can NEVER satisfy trail completion here; see add_visit_verification.sql
// for the incident this fixes (a tester "completed" the trail, and became
// eligible for the real physical mug, just by tapping Explore's check-in
// button on each church — no GPS, no photo, no actual visit).
function trail_status($conn, $uid, $churches) {
    if (!$churches) return ["done" => 0, "total" => 0, "completed" => false, "date" => null];
    $in = "'" . implode("','", array_map(fn($c) => mysqli_real_escape_string($conn, $c), $churches)) . "'";
    $res = mysqli_query($conn,
        "SELECT place, MAX(visited_at) AS last_visit FROM visits
         WHERE user_id = $uid AND place IN ($in) AND verified = 1 GROUP BY place");
    $visitedCount = 0;
    $latest = null;
    while ($r = mysqli_fetch_assoc($res)) {
        $visitedCount++;
        if ($latest === null || $r['last_visit'] > $latest) $latest = $r['last_visit'];
    }
    $total = count($churches);
    return ["done" => $visitedCount, "total" => $total, "completed" => $visitedCount >= $total, "date" => $latest];
}
