<?php
/*
  Verification page for config/format.php.

  Open it in a browser (local XAMPP or the live host) and every rule is shown
  running against a fixed set of inputs, with the expected output next to the
  actual one. It exposes no data and touches no table — the cases below are
  hardcoded — so it is safe to leave in place as evidence that the
  normalisation behaves as documented.

      http://localhost/my-app-backend/api/format_preview.php
*/
require_once "../config/format.php";
header("Content-Type: text/html; charset=utf-8");

$cases = [
    ["Caps Lock",             "name",  "JUAN DELA CRUZ",              "Juan dela Cruz"],
    ["all lowercase",         "name",  "juan dela cruz",              "Juan dela Cruz"],
    ["double spaces",         "name",  "maria   clara  santos",       "Maria Clara Santos"],
    ["leading/trailing space","name",  "   Ana Reyes   ",             "Ana Reyes"],
    ["Spanish particle",      "name",  "ferdinand de los santos",     "Ferdinand de los Santos"],
    ["particle goes first",   "name",  "de la salle",                 "De la Salle"],
    ["Filipino particle",     "name",  "simbahan ng mandaluyong",     "Simbahan ng Mandaluyong"],
    ["English particle",      "name",  "our lady of peace",           "Our Lady of Peace"],
    ["enye",                  "name",  "sto. niño de guia",           "Sto. Niño de Guia"],
    ["known acronym",         "name",  "sm megamall",                 "SM Megamall"],
    ["acronym already right", "name",  "SM Megamall",                 "SM Megamall"],
    ["initials",              "name",  "j.p. rizal street",           "J.P. Rizal Street"],
    ["suffix",                "name",  "jose rizal iii",              "Jose Rizal III"],
    ["suffix, shouted",       "name",  "JOSE RIZAL III",              "Jose Rizal III"],
    ["apostrophe",            "name",  "o'brien",                     "O'Brien"],
    ["Mc",                    "name",  "mcdonald's ortigas",          "McDonald's Ortigas"],
    ["possessive stays small", "name", "aling nena's carinderia",     "Aling Nena's Carinderia"],
    ["one-letter particle",   "name",  "d'mall shaw",                 "D'Mall Shaw"],
    ["brand kept as typed",   "name",  "ABS-CBN Studio",              "ABS-CBN Studio"],
    ["lowercase brand caps",  "name",  "iHop Shaw",                   "iHop Shaw"],
    ["hyphenated given name", "name",  "mary-jane lopez",             "Mary-Jane Lopez"],
    ["digits left alone",     "name",  "7-Eleven shaw blvd.",         "7-Eleven Shaw Blvd."],
    ["address",               "name",  "123 shaw boulevard, brgy. wack-wack",
                                       "123 Shaw Boulevard, Brgy. Wack-Wack"],
    ["empty",                 "name",  "",                            ""],
    ["spaces only",           "name",  "    ",                        ""],
    ["email casing",          "email", "  Juan.Cruz@GMAIL.com ",      "juan.cruz@gmail.com"],
    ["single-line value",     "single","  https://example.com/a  b ", "https://example.com/a b"],
];

$run = function ($kind, $in) {
    if ($kind === 'email')  return tcims_clean_email($in);
    if ($kind === 'single') return tcims_collapse_spaces($in);
    return tcims_proper_name($in);
};

$pass = 0;
$rows = [];
foreach ($cases as [$label, $kind, $in, $want]) {
    $got = $run($kind, $in);
    $ok  = ($got === $want);
    if ($ok) $pass++;
    $rows[] = [$label, $kind, $in, $want, $got, $ok];
}
$total = count($cases);
$allOk = ($pass === $total);
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TCIMS — name formatting check</title>
<style>
  body { font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 32px; color: #0F172A; background: #F7FAFF; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { color: #6b7280; margin: 0 0 20px; }
  .score { display: inline-block; padding: 8px 16px; border-radius: 10px; font-weight: 700; margin-bottom: 18px; }
  .ok { background: #dcfce7; color: #16a34a; }
  .bad { background: #fee2e2; color: #dc2626; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,.04); }
  th { text-align: left; font-size: 12px; letter-spacing: .5px; color: #9ca3af; padding: 10px 12px; border-bottom: 1px solid #eef2f8; }
  td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  code { background: #F7FAFF; border: 1px solid #e6ecf5; border-radius: 6px; padding: 1px 6px; white-space: pre-wrap; }
  .fail td { background: #fef2f2; }
  .mark { font-weight: 700; }
</style>
</head>
<body>
  <h1>Name formatting</h1>
  <p class="sub">config/format.php, run against fixed inputs. Nothing here reads the database.</p>

  <div class="score <?= $allOk ? 'ok' : 'bad' ?>">
    <?= $pass ?> / <?= $total ?> <?= $allOk ? 'passing' : 'passing — see the highlighted rows' ?>
  </div>

  <table>
    <tr><th>RULE</th><th>KIND</th><th>TYPED</th><th>EXPECTED</th><th>STORED</th><th></th></tr>
    <?php foreach ($rows as [$label, $kind, $in, $want, $got, $ok]): ?>
      <tr class="<?= $ok ? '' : 'fail' ?>">
        <td><?= htmlspecialchars($label) ?></td>
        <td style="color:#6b7280"><?= htmlspecialchars($kind) ?></td>
        <td><code><?= htmlspecialchars($in === '' ? '(empty)' : $in) ?></code></td>
        <td><code><?= htmlspecialchars($want === '' ? '(empty)' : $want) ?></code></td>
        <td><code><?= htmlspecialchars($got === '' ? '(empty)' : $got) ?></code></td>
        <td class="mark" style="color:<?= $ok ? '#16a34a' : '#dc2626' ?>"><?= $ok ? '✓' : '✕' ?></td>
      </tr>
    <?php endforeach; ?>
  </table>
</body>
</html>
