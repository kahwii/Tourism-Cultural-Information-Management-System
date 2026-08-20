<?php
/*
  Sentiment Analyser — Model Evaluation

  Reports THREE things separately, on purpose. Blending them would produce a
  flattering number that does not survive questioning.

    A. Reference test set (45 samples)
       Written independently for the mobile app's Dart classifier, before this
       PHP engine existed. Useful, but the samples are largely unambiguous —
       treat a high score here as a sanity check, not as proof.

    B. Regression suite (10 cases)
       Real defects found in live use and then fixed. These pass BY
       CONSTRUCTION — the engine was changed until they did. Reported as
       "still passing", never folded into accuracy.

    C. Held-out sample of real reviews
       Randomly drawn from the database and hand-labelled without seeing the
       engine's prediction. This is the ONLY figure that should be quoted as
       the classifier's accuracy.

  Usage:
    /api/sentiment_eval.php?key=tcims_eval
    /api/sentiment_eval.php?key=tcims_eval&format=json
*/

require_once "../config/sentiment.php";
require_once "../config/sentiment_testset.php";
require_once "../config/sentiment_regression.php";

const EVAL_KEY = "tcims_eval";

if (($_GET['key'] ?? '') !== EVAL_KEY) {
    http_response_code(403);
    header("Content-Type: application/json");
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

$CLASSES = ["Positive", "Neutral", "Negative"];

/**
 * Scores a set of ["comment", "expected", (optional) "rating"] rows.
 *
 * $useRating: the star rating is passed to the engine only where the rating is
 * genuinely part of the case being tested (the regression suite). For accuracy
 * measurement it is withheld, so that what is measured is the reading of the
 * TEXT rather than the rating doing the work.
 */
function tcims_score_set(array $set, array $CLASSES, bool $useRating = false): array {
    $confusion = [];
    foreach ($CLASSES as $a) foreach ($CLASSES as $p) $confusion[$a][$p] = 0;

    $rows = [];
    foreach ($set as $s) {
        $rating    = $useRating ? ($s['rating'] ?? null) : null;
        $result    = tcims_sentiment($s['comment'], $rating);
        $predicted = $result['sentiment'];
        $actual    = $s['expected'];

        if (!in_array($actual, $CLASSES, true)) continue;   // skip unlabelled rows
        $confusion[$actual][$predicted] = ($confusion[$actual][$predicted] ?? 0) + 1;

        $rows[] = [
            "comment"   => $s['comment'],
            "expected"  => $actual,
            "predicted" => $predicted,
            "score"     => $result['score'] ?? null,
            "issue"     => $s['issue'] ?? null,
            "source"    => $s['source'] ?? null,
            "correct"   => $predicted === $actual,
        ];
    }

    $total   = count($rows);
    $correct = count(array_filter($rows, fn($r) => $r['correct']));

    $perClass = [];
    foreach ($CLASSES as $c) {
        $tp = $confusion[$c][$c] ?? 0;
        $predictedAsC = 0; foreach ($CLASSES as $a) $predictedAsC += $confusion[$a][$c] ?? 0;
        $actualC      = 0; foreach ($CLASSES as $p) $actualC      += $confusion[$c][$p] ?? 0;

        $precision = $predictedAsC ? $tp / $predictedAsC : 0.0;
        $recall    = $actualC ? $tp / $actualC : 0.0;
        $f1        = ($precision + $recall) ? 2 * $precision * $recall / ($precision + $recall) : 0.0;

        $perClass[$c] = ["precision" => $precision, "recall" => $recall, "f1" => $f1, "support" => $actualC];
    }

    // Macro average: unweighted mean across classes, so a large class cannot
    // mask poor performance on a small one.
    $macro = [
        "precision" => array_sum(array_column($perClass, 'precision')) / count($CLASSES),
        "recall"    => array_sum(array_column($perClass, 'recall')) / count($CLASSES),
        "f1"        => array_sum(array_column($perClass, 'f1')) / count($CLASSES),
    ];

    return [
        "total" => $total, "correct" => $correct,
        "accuracy" => $total ? $correct / $total : 0,
        "per_class" => $perClass, "macro" => $macro,
        "confusion" => $confusion, "rows" => $rows,
    ];
}

// ---- A. reference set, B. regression suite ------------------------------
$A = tcims_score_set($TCIMS_TEST_SET, $CLASSES, false);
$B = tcims_score_set($TCIMS_REGRESSION_SET, $CLASSES, true);

// ---- C. held-out sample, pasted in as CSV --------------------------------
$C = null;
$csvError = "";
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['labelled_csv'])) {
    $raw = trim((string) $_POST['labelled_csv']);
    if ($raw !== "") {
        $set = [];
        $skipped = [];          // rows dropped, with the reason — never drop silently
        $lines = preg_split('/\r\n|\r|\n/', $raw);

        foreach ($lines as $i => $line) {
            if (trim($line) === "") continue;
            $cols = str_getcsv($line);
            if ($i === 0 && stripos($cols[0] ?? '', 'id') === 0) continue;   // header
            if (count($cols) < 2) continue;

            /*
              Excel commonly shifts typed values into the next column, so the
              label can land in D instead of C. Rather than reporting "no rows
              found", scan every column after the comment for something that
              looks like a label and use the first one.
            */
            $expected = "";
            $rawLabel = "";
            for ($c = 2; $c < count($cols); $c++) {
                $v = trim($cols[$c]);
                if ($v === "") continue;
                $rawLabel = $v;
                $norm = ucfirst(strtolower($v));
                if (in_array($norm, $CLASSES, true)) { $expected = $norm; break; }
            }

            if ($expected === "") {
                $skipped[] = [
                    "comment" => $cols[1] ?? '',
                    "reason"  => $rawLabel === ""
                        ? "no label found in any column"
                        : "unrecognised label \"" . $rawLabel . "\" — must be Positive, Neutral or Negative",
                ];
                continue;
            }
            $set[] = ["comment" => $cols[1], "expected" => $expected];
        }

        if (!$set) {
            $csvError = "No labelled rows found. Each line needs id,comment,expected with expected set to Positive, Neutral or Negative.";
        } else {
            $C = tcims_score_set($set, $CLASSES, false);
            $C['skipped'] = $skipped;
        }
    }
}

if (($_GET['format'] ?? '') === 'json') {
    header("Content-Type: application/json");
    echo json_encode([
        "reference_set" => ["accuracy" => round($A['accuracy'], 4), "total" => $A['total'], "macro_f1" => round($A['macro']['f1'], 4)],
        "regression"    => ["passing" => $B['correct'], "total" => $B['total']],
        "held_out"      => $C ? ["accuracy" => round($C['accuracy'], 4), "total" => $C['total'], "macro_f1" => round($C['macro']['f1'], 4)] : null,
        "note"          => "Quote held_out as the accuracy figure. The regression suite passes by construction and is not an accuracy measure.",
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$pct = fn($v) => number_format($v * 100, 2) . "%";

function render_block(array $R, array $CLASSES, callable $pct, string $id): void {
    $misses = array_values(array_filter($R['rows'], fn($r) => !$r['correct']));
    ?>
    <div class="kpis">
      <div class="kpi"><div class="l">Accuracy</div><div class="v"><?= $pct($R['accuracy']) ?></div></div>
      <div class="kpi"><div class="l">Correct</div><div class="v"><?= $R['correct'] ?> / <?= $R['total'] ?></div></div>
      <div class="kpi"><div class="l">Macro F1</div><div class="v"><?= $pct($R['macro']['f1']) ?></div></div>
    </div>

    <table style="margin-top:18px">
      <tr><th>Class</th><th class="num">Precision</th><th class="num">Recall</th><th class="num">F1</th><th class="num">Support</th></tr>
      <?php foreach ($R['per_class'] as $c => $m): ?>
      <tr><td><strong><?= $c ?></strong></td>
        <td class="num"><?= $pct($m['precision']) ?></td>
        <td class="num"><?= $pct($m['recall']) ?></td>
        <td class="num"><?= $pct($m['f1']) ?></td>
        <td class="num"><?= $m['support'] ?></td></tr>
      <?php endforeach; ?>
      <tr><td><strong>Macro average</strong></td>
        <td class="num"><strong><?= $pct($R['macro']['precision']) ?></strong></td>
        <td class="num"><strong><?= $pct($R['macro']['recall']) ?></strong></td>
        <td class="num"><strong><?= $pct($R['macro']['f1']) ?></strong></td>
        <td class="num"><strong><?= $R['total'] ?></strong></td></tr>
    </table>

    <h3>Confusion matrix</h3>
    <table>
      <tr><th>Actual \ Predicted</th><?php foreach ($CLASSES as $c): ?><th class="num"><?= $c ?></th><?php endforeach; ?></tr>
      <?php foreach ($CLASSES as $a): ?>
      <tr><td><strong><?= $a ?></strong></td>
        <?php foreach ($CLASSES as $p): ?>
          <td class="num <?= $a === $p ? 'diag' : ($R['confusion'][$a][$p] ? 'off' : '') ?>"><?= $R['confusion'][$a][$p] ?></td>
        <?php endforeach; ?>
      </tr>
      <?php endforeach; ?>
    </table>

    <h3>Misclassified (<?= count($misses) ?>)</h3>
    <?php if (!$misses): ?>
      <p style="color:#16a34a;font-weight:600;margin:0;">None.</p>
    <?php else: ?>
      <table>
        <tr><th>Comment</th><th>Expected</th><th>Predicted</th><th class="num">Score</th></tr>
        <?php foreach ($misses as $m): ?>
        <tr><td><?= htmlspecialchars($m['comment']) ?></td>
          <td><?= $m['expected'] ?></td>
          <td class="off"><strong><?= $m['predicted'] ?></strong></td>
          <td class="num"><?= $m['score'] ?></td></tr>
        <?php endforeach; ?>
      </table>
    <?php endif;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TCIMS — Sentiment Analyser Evaluation</title>
<style>
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#F5F8FC; color:#0F172A; margin:0; padding:32px; }
  .wrap { max-width:1000px; margin:0 auto; }
  h1 { font-size:26px; margin:0 0 4px; }
  .sub { color:#64748B; margin:0 0 24px; font-size:14.5px; }
  .card { background:#fff; border:1px solid #eef2f8; border-radius:16px; padding:24px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,.04); }
  h2 { font-size:18px; margin:0 0 6px; }
  h3 { font-size:14px; margin:22px 0 10px; color:#334155; }
  .tag { display:inline-block; font-size:11px; font-weight:800; letter-spacing:.5px; text-transform:uppercase; padding:3px 9px; border-radius:999px; margin-left:8px; vertical-align:middle; }
  .tag-a { background:#EFF5FF; color:#1D4ED8; }
  .tag-b { background:#fef3c7; color:#92400e; }
  .tag-c { background:#dcfce7; color:#166534; }
  .lead { color:#475569; font-size:13.5px; line-height:1.65; margin:0 0 16px; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:14px; }
  .kpi { background:#F7FAFF; border:1px solid #eef2f8; border-radius:12px; padding:14px 16px; }
  .kpi .l { font-size:11.5px; letter-spacing:.4px; text-transform:uppercase; color:#6b7280; font-weight:700; }
  .kpi .v { font-size:26px; font-weight:800; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th,td { padding:9px 12px; border-bottom:1px solid #f1f5f9; text-align:left; }
  th { font-size:12px; letter-spacing:.4px; color:#9ca3af; text-transform:uppercase; }
  td.num,th.num { text-align:right; }
  .diag { background:#dcfce7; font-weight:700; }
  .off { color:#dc2626; }
  .warn { background:#fffbeb; border:1px solid #fde68a; color:#92400e; border-radius:10px; padding:14px 16px; font-size:13.5px; line-height:1.65; }
  .note { background:#F7FAFF; border:1px solid #eef2f8; border-radius:10px; padding:13px 15px; font-size:13.5px; color:#475569; line-height:1.65; margin-top:16px; }
  textarea { width:100%; min-height:170px; padding:12px; border:1px solid #d1d5db; border-radius:10px; font-family:ui-monospace,Consolas,monospace; font-size:12.5px; box-sizing:border-box; }
  button { background:#1D4ED8; color:#fff; border:none; border-radius:10px; padding:12px 22px; font-size:14.5px; font-weight:700; cursor:pointer; margin-top:12px; }
  a { color:#1D4ED8; }
  code { background:#f1f5f9; padding:1px 5px; border-radius:4px; }
  ol { margin:10px 0 0 18px; padding:0; font-size:13.5px; color:#475569; line-height:1.9; }
</style>
</head>
<body><div class="wrap">

<h1>Sentiment Analyser — Model Evaluation</h1>
<p class="sub">TCIMS lexicon-based classifier (<code>config/sentiment.php</code>). Three measures, reported separately.</p>

<!-- ============ C: the one that counts ============ -->
<div class="card">
  <h2>Held-out sample — real reviews <span class="tag tag-c">quote this one</span></h2>
  <p class="lead">
    Randomly drawn from the <code>reviews</code> table and labelled by hand without seeing
    the engine's prediction or the star rating. The engine was never tuned against these,
    so this is the only figure that can honestly be called its accuracy.
  </p>

  <?php if ($C): ?>
    <?php render_block($C, $CLASSES, $pct, 'c'); ?>
    <div class="note">
      Scored <?= $C['total'] ?> labelled comments. For a tighter estimate, label more —
      30 gives a rough figure, 100 gives a reasonably stable one.
    </div>
    <?php if (!empty($C['skipped'])): ?>
      <div class="warn" style="margin-top:14px">
        <strong><?= count($C['skipped']) ?> row(s) were not scored.</strong> They are excluded
        from the accuracy above, so fix and re-score if they matter:
        <table style="margin-top:10px">
          <tr><th>Comment</th><th>Problem</th></tr>
          <?php foreach ($C['skipped'] as $s): ?>
          <tr><td><?= htmlspecialchars($s['comment']) ?></td>
              <td style="font-size:12.5px"><?= htmlspecialchars($s['reason']) ?></td></tr>
          <?php endforeach; ?>
        </table>
      </div>
    <?php endif; ?>
  <?php else: ?>
    <?php if ($csvError): ?><div class="warn" style="margin-bottom:14px"><?= htmlspecialchars($csvError) ?></div><?php endif; ?>
    <ol>
      <li>Download a random sample:
        <a href="sentiment_sample.php?key=tcims_eval&n=30" target="_blank">30 reviews</a> ·
        <a href="sentiment_sample.php?key=tcims_eval&n=60" target="_blank">60 reviews</a></li>
      <li>Open the CSV and fill the <code>expected</code> column with Positive, Neutral or Negative.
        Judge the wording only — do not look up the star rating.</li>
      <li>Paste the whole file below and score it.</li>
    </ol>
    <form method="post" style="margin-top:16px">
      <textarea name="labelled_csv" placeholder="id,comment,expected&#10;12,&quot;Maganda ang simbahan&quot;,Positive"></textarea>
      <button type="submit">Score this sample</button>
    </form>
  <?php endif; ?>
</div>

<!-- ============ A: reference set ============ -->
<div class="card">
  <h2>Reference test set <span class="tag tag-a">sanity check</span></h2>
  <p class="lead">
    <?= $A['total'] ?> hand-labelled comments in English, Filipino and Taglish, written
    independently for the mobile app's Dart classifier before this engine existed.
    Balanced 15 per class, so blind guessing scores 33.33%.
  </p>
  <?php render_block($A, $CLASSES, $pct, 'a'); ?>
  <?php if ($A['accuracy'] >= 0.99): ?>
  <div class="warn" style="margin-top:16px">
    <strong>A perfect score here is not evidence of a perfect classifier.</strong>
    These samples carry unambiguous sentiment words, and the neutral ones are plain
    statements of fact with no polarity at all — cases a lexicon handles trivially.
    The harder cases the engine actually struggled with in live use are in the
    regression suite below. Report the held-out figure, not this one.
  </div>
  <?php endif; ?>
</div>

<!-- ============ B: regression ============ -->
<div class="card">
  <h2>Regression suite <span class="tag tag-b">not an accuracy measure</span></h2>
  <p class="lead">
    Real misclassifications found by the CCAT team in live use, each then fixed.
    These pass <em>by construction</em> — the engine was changed until they did — so
    counting them toward accuracy would be circular. They exist to prove the known
    defects stay fixed when the lexicon is edited.
  </p>
  <?php
  $fieldRows = array_values(array_filter($B['rows'], fn($r) => ($r['source'] ?? '') === 'field'));
  $fieldOk   = count(array_filter($fieldRows, fn($r) => $r['correct']));
  ?>
  <div class="kpis">
    <div class="kpi"><div class="l">Confirmed defects fixed</div><div class="v"><?= $fieldOk ?> / <?= count($fieldRows) ?></div></div>
    <div class="kpi"><div class="l">All cases passing</div><div class="v"><?= $B['correct'] ?> / <?= $B['total'] ?></div></div>
  </div>
  <div class="note">
    Only the <strong>confirmed</strong> figure means anything: those are defects the CCAT
    team actually reported and adjudicated. The rest are unverified proposals kept for
    discussion, and are counted separately for that reason.
  </div>
  <?php
  $bMiss     = array_values(array_filter($B['rows'], fn($r) => !$r['correct']));
  $fieldMiss = array_values(array_filter($bMiss, fn($r) => ($r['source'] ?? '') === 'field'));
  $revMiss   = array_values(array_filter($bMiss, fn($r) => ($r['source'] ?? '') !== 'field'));
  ?>
  <?php if ($fieldMiss): ?>
    <div class="warn" style="margin-top:16px;background:#fef2f2;border-color:#fecaca;color:#991b1b">
      <strong>A previously fixed defect has come back.</strong> These were real
      misclassifications reported from live use and confirmed by the CCAT team, so the
      expected label is authoritative — the engine has regressed:
      <table style="margin-top:10px">
        <tr><th>Comment</th><th>Expected</th><th>Got</th><th>Original issue</th></tr>
        <?php foreach ($fieldMiss as $m): ?>
        <tr><td><?= htmlspecialchars($m['comment']) ?></td>
          <td><?= $m['expected'] ?></td>
          <td class="off"><strong><?= $m['predicted'] ?></strong></td>
          <td style="font-size:12.5px"><?= htmlspecialchars($m['issue'] ?? '') ?></td></tr>
        <?php endforeach; ?>
      </table>
    </div>
  <?php endif; ?>

  <?php if ($revMiss): ?>
    <div class="warn" style="margin-top:16px">
      <strong>Unconfirmed expectation — decide which one is wrong.</strong>
      These cases were proposed while building the suite and have <em>not</em> been
      adjudicated by a human. A mismatch here may mean the expected label is wrong
      rather than the engine. Judge the wording yourself before changing any code:
      <table style="margin-top:10px">
        <tr><th>Comment</th><th>Proposed label</th><th>Engine says</th><th>Reasoning behind the proposal</th></tr>
        <?php foreach ($revMiss as $m): ?>
        <tr><td><?= htmlspecialchars($m['comment']) ?></td>
          <td><?= $m['expected'] ?></td>
          <td class="off"><strong><?= $m['predicted'] ?></strong></td>
          <td style="font-size:12.5px"><?= htmlspecialchars($m['issue'] ?? '') ?></td></tr>
        <?php endforeach; ?>
      </table>
      <div style="margin-top:10px">
        If the engine is right, correct the <code>expected</code> value in
        <code>config/sentiment_regression.php</code> and mark it
        <code>"source" =&gt; "field"</code> once you have judged it. Do not change the
        lexicon to satisfy an unverified label.
      </div>
    </div>
  <?php endif; ?>

  <?php if (!$bMiss): ?>
    <p style="color:#16a34a;font-weight:600;margin:14px 0 0;">All known defects remain fixed.</p>
  <?php endif; ?>
</div>

<div class="card">
  <h2>How to report this in the paper</h2>
  <div class="note" style="margin-top:0">
    State the held-out accuracy as the headline figure, with the sample size.
    Mention the reference set as a sanity check and say plainly that its samples are
    unambiguous. Present the regression suite as software-quality evidence, not accuracy.
    Then discuss the misclassified held-out cases — naming where a lexicon fails
    (sarcasm, unfamiliar slang, context it cannot see) is stronger than claiming it
    never does.
  </div>
</div>

</div></body></html>
