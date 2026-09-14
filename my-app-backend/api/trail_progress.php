<?php
/*
  Heritage Trail progress, per tourist — admin only.

  WHY THIS EXISTS
  ---------------
  The Rewards page only ever showed tourists who FINISHED the trail, because
  a row in `rewards` is only created on completion. CCAT had no way to see
  who was partway through (1 of 9, 5 of 9), which is exactly the number they
  need when deciding whether the trail is actually being walked.

  Counting is deliberately identical to the reward gate: it reuses
  config/heritage_trail.php's trail_churches() for the list, and counts only
  verified = 1 rows — the GPS + selfie/site-photo check-ins from
  api/checkin.php. The casual Explore taps (api/visits.php, verified = 0) are
  reported SEPARATELY rather than being folded in or hidden, so staff can see
  "9 taps, 0 verified" for what it is instead of mistaking it for progress.
  Doing it any other way would let this page disagree with claim_reward.php
  about who has completed the trail, which is the bug class this whole area
  has already been bitten by twice.

  Usage: GET /api/trail_progress.php
  Returns:
    {
      "total": 9,
      "churches": [...],
      "summary": { "walkers": n, "completed": n, "in_progress": n, "verified_checkins": n },
      "tourists": [
        { "user_id", "username", "email", "done", "total", "status",
          "unverified", "started", "last_check_in", "places", "has_reward", "reward_code" }
      ]
    }
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";
require_once "../config/heritage_trail.php"; // $TRAIL_CHURCHES + trail_status()

$authUser = require_auth($conn);
if (!is_admin_role($authUser['role'] ?? '')) {
    http_response_code(403);
    echo json_encode(["error" => "Admins only."]);
    exit;
}

$total = count($TRAIL_CHURCHES);
if ($total === 0) {
    echo json_encode([
        "total" => 0, "churches" => [], "tourists" => [],
        "summary" => ["walkers" => 0, "completed" => 0, "in_progress" => 0, "verified_checkins" => 0],
        "warning" => "No heritage_sites rows with category = 'Church' — the trail is undefined, so nothing can be completed.",
    ]);
    exit;
}

$in = "'" . implode("','", array_map(fn($c) => mysqli_real_escape_string($conn, $c), $TRAIL_CHURCHES)) . "'";

// One pass over the trail-church visits, split by verified. Grouping in SQL
// rather than pulling every row keeps this fine as `visits` grows.
$sql = "SELECT v.user_id,
               u.username,
               u.email,
               SUM(v.verified = 1)                                  AS done,
               SUM(v.verified = 0)                                  AS unverified,
               MIN(CASE WHEN v.verified = 1 THEN v.visited_at END)  AS started,
               MAX(CASE WHEN v.verified = 1 THEN v.visited_at END)  AS last_check_in,
               GROUP_CONCAT(CASE WHEN v.verified = 1 THEN v.place END
                            ORDER BY v.visited_at SEPARATOR '||')   AS places
        FROM (SELECT DISTINCT user_id, place, verified, visited_at FROM visits WHERE place IN ($in)) v
        LEFT JOIN users u ON u.id = v.user_id
        GROUP BY v.user_id, u.username, u.email
        ORDER BY done DESC, last_check_in DESC";

$res = mysqli_query($conn, $sql);
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => mysqli_error($conn)]);
    exit;
}

// Rewards already issued, so the page can show who still needs their mug.
$rewards = [];
$rr = mysqli_query($conn, "SELECT user_id, code, status FROM rewards");
if ($rr) { while ($r = mysqli_fetch_assoc($rr)) $rewards[(string)$r['user_id']] = $r; }

$tourists = [];
$completed = 0; $inProgress = 0; $verifiedCheckins = 0;

while ($row = mysqli_fetch_assoc($res)) {
    $done = (int)$row['done'];
    $verifiedCheckins += $done;
    $status = $done >= $total ? "Completed" : ($done > 0 ? "In progress" : "Not started");
    if ($status === "Completed") $completed++;
    elseif ($status === "In progress") $inProgress++;

    $uid = (string)$row['user_id'];
    $tourists[] = [
        "user_id"       => $row['user_id'],
        "username"      => $row['username'],
        "email"         => $row['email'],
        "done"          => $done,
        "total"         => $total,
        "status"        => $status,
        // Explore taps on trail churches: not progress, but worth seeing.
        "unverified"    => (int)$row['unverified'],
        "started"       => $row['started'],
        "last_check_in" => $row['last_check_in'],
        "places"        => $row['places'] ? explode('||', $row['places']) : [],
        "has_reward"    => isset($rewards[$uid]),
        "reward_code"   => $rewards[$uid]['code']   ?? null,
        "reward_status" => $rewards[$uid]['status'] ?? null,
    ];
}

echo json_encode([
    "total"    => $total,
    "churches" => $TRAIL_CHURCHES,
    "summary"  => [
        "walkers"           => count($tourists),
        "completed"         => $completed,
        "in_progress"       => $inProgress,
        "verified_checkins" => $verifiedCheckins,
    ],
    "tourists" => $tourists,
], JSON_UNESCAPED_UNICODE);
