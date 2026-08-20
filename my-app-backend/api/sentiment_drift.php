<?php
/*
  Reclassification drift check.

  Runs the CURRENT engine over every stored review and compares the result with
  the sentiment value already saved in the database.

  ------------------------------------------------------------------------
  THIS IS NOT AN ACCURACY MEASURE.
  ------------------------------------------------------------------------
  The stored sentiment was produced by the engine itself, at whatever version
  was live when the review was submitted. Comparing the engine against its own
  earlier output says nothing about whether either answer is correct — only
  whether the two agree.

  What it IS good for: finding rows classified by an older version of the
  lexicon. Every fix made to config/sentiment.php changes future results but
  leaves past rows untouched, so a dashboard can end up mixing verdicts from
  several engine versions. Anything reported in the paper should come from one
  consistent version, which means re-running the reclassifier before the final
  export.

  Accuracy comes only from human-labelled samples — see sentiment_eval.php.

  Usage: /api/sentiment_drift.php?key=tcims_eval
*/

require_once "../config/cors.php";
require_once "../config/db.php";
require_once "../config/sentiment.php";

const DRIFT_KEY = "tcims_eval";

if (($_GET['key'] ?? '') !== DRIFT_KEY) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$res = mysqli_query($conn, "SELECT id, place, rating, sentiment, comment FROM reviews ORDER BY id");
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => mysqli_error($conn)]);
    exit;
}

$rows = [];
$changed = [];
$agree = 0;
$matrix = [];   // stored -> now

while ($r = mysqli_fetch_assoc($res)) {
    // Pass the rating, because that is how the value was produced when the
    // review was saved — this compares like with like.
    $now    = tcims_sentiment($r['comment'], $r['rating'])['sentiment'];
    $stored = $r['sentiment'];

    $matrix[$stored][$now] = ($matrix[$stored][$now] ?? 0) + 1;

    $row = [
        "id" => $r['id'], "place" => $r['place'], "rating" => $r['rating'],
        "comment" => $r['comment'], "stored" => $stored, "now" => $now,
    ];
    $rows[] = $row;
    if ($stored === $now) $agree++; else $changed[] = $row;
}

$total = count($rows);
$pct   = fn($v) => $total ? number_format($v / $total * 100, 2) . "%" : "0%";
$CLASSES = ["Positive", "Neutral", "Negative"];
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TCIMS — Reclassification Drift</title>
<style>
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#F5F8FC; color:#0F172A; margin:0; padding:32px; }
  .wrap { max-width:1050px; margin:0 auto; }
  h1 { font-size:26px; margin:0 0 4px; }
  .sub { color:#64748B; margin:0 0 24px; font-size:14.5px; }
  .card { background:#fff; border:1px solid #eef2f8; border-radius:16px; padding:24px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,.04); }
  h2 { font-size:18px; margin:0 0 14px; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
  .kpi { background:#F7FAFF; border:1px solid #eef2f8; border-radius:12px; padding:14px 16px; }
  .kpi .l { font-size:11.5px; letter-spacing:.4px; text-transform:uppercase; color:#6b7280; font-weight:700; }
  .kpi .v { font-size:26px; font-weight:800; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th,td { padding:9px 11px; border-bottom:1px solid #f1f5f9; text-align:left; vertical-align:top; }
  th { font-size:11.5px; letter-spacing:.4px; color:#9ca3af; text-transform:uppercase; }
  td.num,th.num { text-align:right; }
  .diag { background:#dcfce7; font-weight:700; }
  .off { color:#dc2626; font-weight:700; }
  .warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; padding:14px 16px; font-size:13.5px; line-height:1.65; }
  .note { background:#F7FAFF; border:1px solid #eef2f8; border-radius:10px; padding:13px 15px; font-size:13.5px; color:#475569; line-height:1.65; margin-top:16px; }
  code { background:#f1f5f9; padding:1px 5px; border-radius:4px; }
</style>
</head>
<body><div class="wrap">

<h1>Reclassification Drift</h1>
<p class="sub">Current engine vs. the sentiment already stored for each of the <?= $total ?> reviews.</p>

<div class="card">
  <div class="warn">
    <strong>This is not an accuracy measure.</strong> The stored value was produced by the
    engine itself, so this compares the engine with its own earlier output. It shows how
    many rows were classified by an older version of the lexicon — nothing about whether
    either verdict is correct. Accuracy comes only from human-labelled samples.
  </div>
</div>

<div class="card">
  <h2>Summary</h2>
  <div class="kpis">
    <div class="kpi"><div class="l">Reviews checked</div><div class="v"><?= $total ?></div></div>
    <div class="kpi"><div class="l">Unchanged</div><div class="v"><?= $agree ?></div></div>
    <div class="kpi"><div class="l">Would change</div><div class="v" style="color:<?= count($changed) ? '#dc2626' : '#16a34a' ?>"><?= count($changed) ?></div></div>
    <div class="kpi"><div class="l">Drift</div><div class="v"><?= $pct(count($changed)) ?></div></div>
  </div>
  <?php if (count($changed)): ?>
  <div class="note">
    <?= count($changed) ?> stored verdict(s) came from an older version of the lexicon.
    Run <strong>Re-run sentiment on all existing reviews</strong> on the Sentiment Analysis
    page before taking the final export, so every figure in the paper comes from one
    consistent version of the engine.
  </div>
  <?php else: ?>
  <div class="note">Every stored verdict matches the current engine. The database is consistent.</div>
  <?php endif; ?>
</div>

<div class="card">
  <h2>Stored vs. current</h2>
  <table>
    <tr><th>Stored \ Current</th><?php foreach ($CLASSES as $c): ?><th class="num"><?= $c ?></th><?php endforeach; ?></tr>
    <?php foreach ($CLASSES as $s): ?>
    <tr><td><strong><?= $s ?></strong></td>
      <?php foreach ($CLASSES as $n): $v = $matrix[$s][$n] ?? 0; ?>
        <td class="num <?= $s === $n ? 'diag' : ($v ? 'off' : '') ?>"><?= $v ?></td>
      <?php endforeach; ?>
    </tr>
    <?php endforeach; ?>
  </table>
  <div class="note">
    The diagonal is agreement. Off-diagonal cells are rows whose verdict would change —
    read the direction: a Positive that becomes Negative is the profanity and slur
    override now catching something it previously missed.
  </div>
</div>

<?php if (count($changed)): ?>
<div class="card">
  <h2>Rows that would change (<?= count($changed) ?>)</h2>
  <table>
    <tr><th class="num">ID</th><th>Comment</th><th class="num">Rating</th><th>Stored</th><th>Current</th></tr>
    <?php foreach ($changed as $c): ?>
    <tr>
      <td class="num"><?= (int)$c['id'] ?></td>
      <td><?= htmlspecialchars($c['comment']) ?></td>
      <td class="num"><?= (int)$c['rating'] ?></td>
      <td><?= htmlspecialchars($c['stored']) ?></td>
      <td class="off"><?= htmlspecialchars($c['now']) ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
</div>
<?php endif; ?>

</div></body></html>
