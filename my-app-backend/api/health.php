<?php
/*
  Health check for uptime monitoring.

  Deliberately does NOT touch the database:
   - Render's free tier sleeps after 15 minutes idle, and a monitor pinging
     this every 5-10 minutes keeps it awake. That ping should be as cheap as
     possible — waking the database on every hit would burn the free TiDB
     quota for no benefit.
   - It also separates "the web service is up" from "the database is up",
     which matters when diagnosing a failed deploy.

  Use ?db=1 when you actually want the database checked too.
*/
require_once "../config/cors.php";

$out = [
    "ok"      => true,
    "service" => "tcims-backend",
    "time"    => gmdate("c"),
    "php"     => PHP_VERSION,
];

// Opt-in database probe: /api/health.php?db=1
if (isset($_GET['db'])) {
    // db.php exits with a 500 on failure, so reaching the next line means the
    // connection succeeded.
    require_once "../config/db.php";
    $res = @mysqli_query($conn, "SELECT 1");
    $out["database"] = $res ? "connected" : "query failed";
}

echo json_encode($out);
