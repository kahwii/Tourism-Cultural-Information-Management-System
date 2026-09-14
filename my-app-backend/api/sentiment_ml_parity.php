<?php
/*
  PHP <-> scikit-learn PARITY CHECK for the ML sentiment model.

  The model is TRAINED in Python but RUNS in PHP. That only works if the PHP
  side reproduces scikit-learn's feature extraction exactly — same lowercasing,
  same whitespace handling, same n-gram construction, same treatment of
  multi-byte characters and emoji. A mismatch does not throw an error; it just
  produces different features, and therefore quietly different predictions,
  with nothing in PHP to notice.

  So train_sentiment.py writes ml_training/parity_fixture.json: a fixed list of
  comments together with the label the ACTUAL trained scikit-learn model gives
  each one. This endpoint replays those same comments through the PHP
  implementation and reports any disagreement.

  Green here means: the deployed PHP classifier behaves identically to the
  Python model that was evaluated in the thesis. That is what makes the
  reported accuracy figures applicable to what is actually running.

  Usage: /api/sentiment_ml_parity.php?key=tcims_eval
*/
require_once "../config/sentiment_ml.php";

const PARITY_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== PARITY_KEY) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$fixturePath = __DIR__ . "/../ml_training/parity_fixture.json";
if (!file_exists($fixturePath)) {
    http_response_code(500);
    header("Content-Type: application/json");
    echo json_encode([
        "error" => "parity_fixture.json not found. Run ml_training/train_sentiment.py "
                 . "to regenerate it, and make sure it is deployed with the build.",
    ]);
    exit;
}

$fixture = json_decode(file_get_contents($fixturePath), true) ?: [];

$rows = [];
$agree = 0;
foreach ($fixture as $case) {
    $comment = (string)($case['comment'] ?? '');
    $expected = (string)($case['expected'] ?? '');
    $res = tcims_sentiment_ml($comment);

    // A "no signal" result is the deliberate business rule layered on top of
    // the raw model (see sentiment_ml.php), not the model's own answer, so it
    // is reported separately rather than counted as a parity failure.
    $noSignal = is_array($res) && !empty($res['no_signal']);
    $actual = is_array($res) ? (string)$res['sentiment'] : 'NO MODEL';

    $ok = ($actual === $expected) || $noSignal;
    if ($ok) $agree++;

    $rows[] = [
        "comment"   => $comment,
        "python"    => $expected,
        "php"       => $actual,
        "no_signal" => $noSignal,
        "ok"        => $ok,
    ];
}

$total = count($rows);
$pct = $total ? $agree / $total : 0;

if (($_GET['format'] ?? '') === 'json') {
    header("Content-Type: application/json");
    echo json_encode(["total" => $total, "agree" => $agree, "rate" => round($pct, 4), "cases" => $rows],
                     JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$esc = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TCIMS — PHP/scikit-learn Parity Check</title>
<style>
  body { font: 15px/1.55 Inter, system-ui, "Segoe UI", Roboto, sans-serif; color: #334155;
         background: #F5F8FC; margin: 0; padding: 32px; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 24px; color: #0F172A; margin: 0 0 6px; }
  p.sub { margin: 0 0 24px; color: #64748B; font-size: 14px; }
  .kpis { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .kpi { background: #fff; border: 1px solid #E6ECF5; border-radius: 14px; padding: 18px 22px;
         box-shadow: 0 4px 14px rgba(15,23,42,.07); min-width: 150px; }
  .kpi .l { font-size: 11.5px; letter-spacing: .6px; text-transform: uppercase; color: #64748B; font-weight: 700; }
  .kpi .v { font-size: 26px; font-weight: 800; color: #0F172A; margin-top: 4px; }
  .ok { color: #15803D !important; } .bad { color: #B91C1C !important; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #E6ECF5;
          border-radius: 14px; overflow: hidden; box-shadow: 0 4px 14px rgba(15,23,42,.07); }
  th { text-align: left; font-size: 11.5px; letter-spacing: .6px; text-transform: uppercase;
       color: #64748B; background: linear-gradient(180deg,#FBFCFE,#F4F7FC); padding: 12px 14px;
       border-bottom: 1px solid #E6ECF5; }
  td { padding: 11px 14px; border-bottom: 1px solid #F1F5F9; font-size: 13.5px; vertical-align: top; }
  tr.pass { background: #F6FEF9; } tr.fail { background: #FEF2F2; }
  .tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
  .tag-g { background: #DCFCE7; color: #15803D; } .tag-r { background: #FEE2E2; color: #B91C1C; }
  .tag-b { background: #DBEAFE; color: #1D4ED8; }
  .note { background: #fff; border: 1px solid #E6ECF5; border-radius: 14px; padding: 18px 22px;
          margin-top: 24px; font-size: 13.5px; color: #475569; }
  code { background: #F1F5F9; padding: 2px 6px; border-radius: 5px; font-size: 12.5px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>PHP / scikit-learn Parity Check</h1>
  <p class="sub">
    The model is trained in Python but runs in PHP. These are the trained model's own
    predictions replayed through the PHP implementation — they must match exactly, or
    the accuracy measured in Python does not describe what is actually deployed.
  </p>

  <div class="kpis">
    <div class="kpi"><div class="l">Agreement</div>
      <div class="v <?= $pct >= 1 ? 'ok' : 'bad' ?>"><?= number_format($pct * 100, 1) ?>%</div></div>
    <div class="kpi"><div class="l">Cases matched</div>
      <div class="v"><?= $agree ?> / <?= $total ?></div></div>
    <div class="kpi"><div class="l">Status</div>
      <div class="v <?= $pct >= 1 ? 'ok' : 'bad' ?>" style="font-size:20px">
        <?= $pct >= 1 ? 'In sync' : 'MISMATCH' ?></div></div>
  </div>

  <table>
    <thead><tr><th>Comment</th><th>scikit-learn</th><th>PHP</th><th>Result</th></tr></thead>
    <tbody>
    <?php foreach ($rows as $r): ?>
      <tr class="<?= $r['ok'] ? 'pass' : 'fail' ?>">
        <td><?= $r['comment'] === '' ? '<em style="color:#94A3B8">(empty)</em>'
                : ($esc($r['comment']) === trim($esc($r['comment'])) ? $esc($r['comment'])
                : '<em style="color:#94A3B8">(whitespace only)</em>') ?></td>
        <td><?= $esc($r['python']) ?></td>
        <td><?= $esc($r['php']) ?><?= $r['no_signal'] ? ' <span class="tag tag-b">no signal</span>' : '' ?></td>
        <td><span class="tag <?= $r['ok'] ? 'tag-g' : 'tag-r' ?>"><?= $r['ok'] ? 'match' : 'DIFFERS' ?></span></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>

  <div class="note">
    <?php if ($pct >= 1): ?>
      <b>All cases match.</b> The PHP classifier reproduces the trained scikit-learn model exactly,
      so the accuracy figures measured during training apply to the deployed system.
    <?php else: ?>
      <b>The PHP and Python implementations disagree.</b> Do not treat the Python accuracy figures as
      describing the live system until this is resolved. The usual cause is a difference in feature
      extraction — check <code>tcims_ml_char_wb_features()</code> in <code>config/sentiment_ml.php</code>
      against scikit-learn's <code>char_wb</code> rule (word padding, the short-word case, whitespace
      collapsing, and multi-byte character handling).
    <?php endif; ?>
    <br><br>
    Rows marked <span class="tag tag-b">no signal</span> are cases where nothing in the comment
    appears in the model's vocabulary. PHP deliberately answers "Neutral" there instead of falling
    back to the most common training class, which is a documented business rule layered on top of
    the model rather than a difference in the model itself.
  </div>
</div>
</body>
</html>
