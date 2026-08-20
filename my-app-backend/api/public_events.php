<?php
/*
  PUBLIC events feed — no login required.

  This is the only read endpoint that deliberately skips require_auth():
  the CCAT events calendar is public information. It exposes a narrow,
  read-only projection of approved events (no internal approval fields,
  no submitter ids), so nothing sensitive leaks to anonymous visitors.
*/
require_once "../config/cors.php";
require_once "../config/db.php";

// Cancelled events stay listed (visitors need to know they're off), but
// anything still awaiting or refused CCAT review must never show publicly.
$res = mysqli_query($conn, "
  SELECT id, name, event_date, start_time, end_time, month, category,
         venue, description, status, image
  FROM events
  WHERE approval_status = 'Approved'
  ORDER BY event_date ASC, id ASC
");

$rows = [];
while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;

echo json_encode($rows);
