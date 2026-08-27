<?php
/*
  Functional/black-box test suite for the ML shadow deployment
  (config/sentiment_ml.php), run side-by-side against the lexicon
  (config/sentiment.php) on the SAME inputs.

  This is NOT an accuracy benchmark — sentiment_eval.php already covers
  that on the 45-sample reference set and the held-out real-review sample.
  This is a functional test: does the newly deployed ML inference code
  actually run correctly and produce sane output across a deliberately
  varied set of inputs (negation, Taglish, emoji, profanity, edge cases),
  and where do the two engines agree or disagree?

  Usage: /api/sentiment_ml_test.php?key=tcims_eval
*/

require_once "../config/sentiment.php";
require_once "../config/sentiment_ml.php";

const TEST_KEY = "tcims_eval";
if (($_GET['key'] ?? '') !== TEST_KEY) {
    http_response_code(403);
    echo json_encode(["error" => "Forbidden."]);
    exit;
}

/*
  Each case: [category, comment, expected]. "expected" is the researcher's
  own judgment of the TEXT alone (no rating) — used to grade both engines
  on the same standard. Categories are chosen to probe specific behaviors,
  not to be a balanced accuracy sample.
*/
$CASES = [
    ["Clear positive (EN)",      "The staff were friendly and the place was very clean.", "Positive"],
    ["Clear positive (FIL)",     "Napakaganda ng lugar, babalik ako ulit dito.", "Positive"],
    ["Clear negative (EN)",      "Terrible service, the whole place was dirty and disorganized.", "Negative"],
    ["Clear negative (FIL)",     "Sobrang dumi ng banyo, nakakadiri talaga.", "Negative"],
    ["Clear neutral (fact)",     "The event starts at 9am and ends at 5pm.", "Neutral"],
    ["Clear neutral (fact, FIL)","Pumunta kami sa simbahan noong Linggo.", "Neutral"],
    ["Negation (FIL)",           "Hindi maganda ang serbisyo dito.", "Negative"],
    ["Negation (EN)",            "The place was not clean at all.", "Negative"],
    ["Double negation/softened", "Hindi naman masama, pwede na.", "Neutral"],
    ["Taglish mixed",            "Grabe ang ganda, sobrang worth it talaga!", "Positive"],
    ["Taglish mixed negative",   "Ang bagal ng service, sobrang nakakainis.", "Negative"],
    ["Emoji-heavy positive",     "Ang ganda dito 😍😍😍", "Positive"],
    ["Emoji-only",               "😊", "Positive"],
    ["Profanity (should hard-override to Negative)", "Ang panget dito putangina.", "Negative"],
    ["Mild profanity as emphasis (ambiguous)", "Sobrang ganda tangina, ang saya!", "Positive"],
    ["Very short",               "okay lang", "Neutral"],
    ["Single word positive",     "maganda", "Positive"],
    ["Single word negative",     "pangit", "Negative"],
    ["Out-of-vocabulary slang",  "Petmalu talaga ang lugar na 'to, solid!", "Positive"],
    ["Misspelling/informal",     "sobrang gandaaa dto grabe", "Positive"],
    ["Sarcasm (hard case)",      "Wow, ang bagal talaga, sulit na sulit ang paghihintay.", "Negative"],
    ["Empty comment",            "", "Neutral"],
    ["Numbers/no sentiment words","Room 204, 3rd floor.", "Neutral"],
    ["Mixed sentiment",          "Maganda ang view pero sobrang mahal at madumi ang CR.", "Negative"],
    ["Long rambling comment",    "Kami po ay nagpunta dito noong huling linggo ng Hulyo kasama ang buong pamilya at medyo malayo ang biyahe pero pagdating namin doon ay nagulat kami kung gaano kaganda ang lugar, malinis ang paligid at napakabait ng mga tauhan doon kaya naman lubos kaming nasiyahan sa aming pagbisita.", "Positive"],
];

$results = [];
$lexCorrect = 0; $mlCorrect = 0; $agree = 0; $mlScored = 0;

foreach ($CASES as [$category, $comment, $expected]) {
    $lex = tcims_sentiment($comment, null);
    $ml  = tcims_sentiment_ml($comment);

    $lexPred = $lex['sentiment'] ?? null;
    $mlPred  = $ml['sentiment'] ?? null;

    $lexOk = $lexPred === $expected;
    $mlOk  = $mlPred === $expected;
    if ($lexOk) $lexCorrect++;
    if ($mlPred !== null) {
        $mlScored++;
        if ($mlOk) $mlCorrect++;
    }
    if ($lexPred === $mlPred) $agree++;

    $results[] = [
        "category"   => $category,
        "comment"    => $comment,
        "expected"   => $expected,
        "lexicon"    => $lexPred,
        "lexicon_ok" => $lexOk,
        "ml"         => $mlPred,
        "ml_ok"      => $mlOk,
        "agree"      => $lexPred === $mlPred,
    ];
}

$total = count($CASES);

if (($_GET['format'] ?? '') === 'json') {
    header("Content-Type: application/json");
    echo json_encode([
        "total" => $total,
        "lexicon_accuracy" => round($lexCorrect / $total, 4),
        "ml_accuracy" => $mlScored ? round($mlCorrect / $mlScored, 4) : null,
        "ml_scored" => $mlScored,
        "agreement_rate" => round($agree / $total, 4),
        "results" => $results,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$pct = fn($v) => number_format($v * 100, 1) . "%";
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TCIMS — ML Shadow Deployment Functional Test</title>
<style>
  body { font-family:'Segoe UI',system-ui,sans-serif; background:#F5F8FC; color:#0F172A; margin:0; padding:32px; }
  .wrap { max-width:1150px; margin:0 auto; }
  h1 { font-size:24px; margin:0 0 4px; }
  .sub { color:#64748B; margin:0 0 20px; font-size:13.5px; }
  .card { background:#fff; border:1px solid #eef2f8; border-radius:16px; padding:22px; margin-bottom:18px; box-shadow:0 4px 12px rgba(0,0,0,.04); }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:6px; }
  .kpi { background:#F7FAFF; border:1px solid #eef2f8; border-radius:12px; padding:12px 14px; }
  .kpi .l { font-size:11px; letter-spacing:.4px; text-transform:uppercase; color:#6b7280; font-weight:700; }
  .kpi .v { font-size:22px; font-weight:800; margin-top:4px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { padding:8px 10px; border-bottom:1px solid #f1f5f9; text-align:left; vertical-align:top; }
  th { font-size:10.5px; letter-spacing:.4px; color:#9ca3af; text-transform:uppercase; }
  .ok { color:#16a34a; font-weight:700; }
  .bad { color:#dc2626; font-weight:700; }
  .cat { font-size:11px; color:#6b7280; }
  .agree { background:#f0fdf4; }
  .disagree { background:#fffbeb; }
</style>
</head>
<body><div class="wrap">
<h1>ML Shadow Deployment — Functional Test</h1>
<p class="sub">24 hand-picked cases probing negation, Taglish, emoji, profanity, and edge cases — run through both engines on identical input. Not an accuracy benchmark (see sentiment_eval.php for that); this checks the deployed code behaves sanely.</p>

<div class="card">
  <div class="kpis">
    <div class="kpi"><div class="l">Lexicon accuracy</div><div class="v"><?= $pct($lexCorrect / $total) ?></div></div>
    <div class="kpi"><div class="l">ML accuracy</div><div class="v"><?= $mlScored ? $pct($mlCorrect / $mlScored) : "n/a" ?></div></div>
    <div class="kpi"><div class="l">Engines agree</div><div class="v"><?= $pct($agree / $total) ?></div></div>
    <div class="kpi"><div class="l">ML model loaded</div><div class="v"><?= $mlScored > 0 ? "Yes" : "NO — check deployment" ?></div></div>
  </div>
</div>

<div class="card">
  <table>
    <tr><th>Category</th><th>Comment</th><th>Expected</th><th>Lexicon</th><th>ML</th></tr>
    <?php foreach ($results as $r): ?>
    <tr class="<?= $r['agree'] ? 'agree' : 'disagree' ?>">
      <td class="cat"><?= htmlspecialchars($r['category']) ?></td>
      <td><?= htmlspecialchars($r['comment']) ?: '<em>(empty)</em>' ?></td>
      <td><strong><?= $r['expected'] ?></strong></td>
      <td class="<?= $r['lexicon_ok'] ? 'ok' : 'bad' ?>"><?= $r['lexicon'] ?? 'null' ?></td>
      <td class="<?= $r['ml_ok'] ? 'ok' : 'bad' ?>"><?= $r['ml'] ?? 'null' ?></td>
    </tr>
    <?php endforeach; ?>
  </table>
</div>

<div class="card">
  <p style="font-size:13px;color:#475569;line-height:1.6;margin:0">
    Green rows: both engines agree. Yellow rows: they disagree — worth reading individually,
    since these are exactly the cases that show what each approach is (and isn't) capturing.
  </p>
</div>

</div></body></html>
