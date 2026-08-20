<?php
/*
  Count of unanswered visitor inquiries — powers the sidebar badge.

  Deliberately tiny and separate from inquiries.php: the admin layout polls
  this on every page load, so it must never pull down the full inquiry list.
*/
require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/auth.php";

require_admin($conn);

$res = mysqli_query($conn, "SELECT COUNT(*) AS c FROM inquiries WHERE status = 'Open'");
$open = $res ? (int) (mysqli_fetch_assoc($res)['c'] ?? 0) : 0;

echo json_encode(["open" => $open]);
