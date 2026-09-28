<?php
/*
  ============================================================
   INPUT NORMALISATION — names, places and emails
  ============================================================

  Data entry is inconsistent by nature. The same establishment arrives as
  "jollibee shaw", "JOLLIBEE SHAW" and "Jollibee  Shaw" depending on who typed
  it and whether Caps Lock was on. Stored as-is, the directory looks careless,
  sorting scatters the same place across the list, and duplicate detection
  fails because the strings do not match.

  This is done in PHP, on write, rather than in React on blur, because the
  website is not the only writer: the mobile app posts to the same crud.php,
  and so would any future import. A rule that lives in one form component
  protects one form. A rule that lives here protects the column.

  WHAT IT DELIBERATELY DOES NOT TOUCH
  -----------------------------------
  Free prose — descriptions, remarks, review comments, post-event reports — is
  only trimmed. Title-casing a paragraph would mangle it, and collapsing
  newlines would destroy the writer's paragraphs.

  Usernames are never reformatted: they are credentials, matched exactly at
  login. `reviews.place` and `visits.place` are also left alone — they are join
  keys matched character-for-character against config/heritage_trail.php, so
  "improving" them would silently break trail progress.
*/

/** Collapse any run of whitespace to one space and trim. Safe for single-line values. */
function tcims_collapse_spaces($s) {
    $s = preg_replace('/\s+/u', ' ', (string)$s);
    return trim($s);
}

/*
  Kept uppercase when the rest of the value is being title-cased. Without this
  list, "sm megamall" becomes "Sm Megamall". Only genuinely well-known
  initialisms belong here — a long list starts doing more harm than good.
*/
const TCIMS_ACRONYMS = [
    'SM', 'LRT', 'MRT', 'EDSA', 'CCAT', 'DOT', 'NHCP', 'DPWH', 'DENR', 'DTI',
    'GMA', 'ABS', 'CBN', 'NCR', 'BF', 'JP', 'PUP', 'JRU', 'UST', 'UP', 'ATM',
    'BPI', 'BDO', 'MMDA', 'LGU', 'PNP', 'BFP', 'HOA', 'II', 'III', 'IV', 'VI',
    'VII', 'VIII', 'IX', 'XI', 'XII',
];

/*
  Lowercased when they are not the first word: "Juan dela Cruz", "Our Lady of
  Peace", "Simbahan ng Mandaluyong". Spanish and Filipino particles both appear
  in local names, so both are listed.
*/
const TCIMS_PARTICLES = [
    'de', 'del', 'dela', 'delas', 'delos', 'dels', 'da', 'das', 'di', 'do',
    'dos', 'du', 'la', 'las', 'le', 'los', 'van', 'von', 'der', 'den', 'y',
    'ng', 'nang', 'sa', 'ni', 'at', 'of', 'the', 'and', 'in', 'on', 'for',
];

/**
 * Capitalise every run of letters in a token: the first letter up, the rest
 * down. Done on letter-runs rather than on the whole token so punctuation is
 * handled for free — "o'brien" → "O'Brien", "j.p." → "J.P.", "mary-jane" →
 * "Mary-Jane", "(santuario" → "(Santuario" — with no special cases.
 */
function tcims_cap_letters($token) {
    $out = preg_replace_callback('/\p{L}[\p{L}\p{M}]*/u', function ($m) {
        $w = $m[0];
        return mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8')
             . mb_strtolower(mb_substr($w, 1, null, 'UTF-8'), 'UTF-8');
    }, $token);
    // "Mcdonald" → "McDonald". Applied after the pass above, not instead of it.
    $out = preg_replace_callback('/\bMc(\p{Ll})/u', function ($m) {
        return 'Mc' . mb_strtoupper($m[1], 'UTF-8');
    }, $out);

    /*
      An apostrophe starts a new letter-run, so the pass above capitalises what
      follows it — right for "O'Brien", wrong for "McDonald'S".

      What separates the two is the length of the run BEFORE the apostrophe:
      one letter means a name particle ("O'", "D'"), two or more means the
      apostrophe is possessive or a contraction, and the letter after it stays
      small. Only a lone trailing letter is lowered, so "Dell'Arte" is safe.
    */
    return preg_replace_callback("/(\p{L}{2,})'(\p{L})\\b/u", function ($m) {
        return $m[1] . "'" . mb_strtolower($m[2], 'UTF-8');
    }, $out);
}

/**
 * Proper-case a person, establishment, venue or address line.
 *
 * The one judgement call worth knowing about: a token that already carries an
 * uppercase letter somewhere after the first character is assumed to be
 * deliberate and is left exactly as typed — "ABS-CBN", "McDonald's", "iHop",
 * "DoubleDragon". That trust is withdrawn when the WHOLE value is uppercase,
 * because then the capitals carry no information: "MARIA SANTOS" is Caps Lock,
 * not a brand, and becomes "Maria Santos".
 *
 * Tokens containing digits are returned untouched ("7-Eleven", "Bldg. 2A").
 */
function tcims_proper_name($raw) {
    $s = tcims_collapse_spaces($raw);
    if ($s === '') return '';

    $hasUpper  = (bool)preg_match('/\p{Lu}/u', $s);
    $hasLower  = (bool)preg_match('/\p{Ll}/u', $s);
    $isShouted = $hasUpper && !$hasLower;   // "MARIA SANTOS"

    $words = explode(' ', $s);
    $out   = [];

    foreach ($words as $i => $w) {
        if ($w === '') continue;

        // Leave anything with a digit alone.
        if (preg_match('/\p{N}/u', $w)) { $out[] = $w; continue; }

        $bare  = preg_replace('/[^\p{L}]/u', '', $w);   // strip punctuation for lookups
        $upper = mb_strtoupper($bare, 'UTF-8');

        if ($bare !== '' && in_array($upper, TCIMS_ACRONYMS, true)) {
            // Preserve the token's punctuation, uppercase its letters.
            $out[] = preg_replace_callback('/\p{L}+/u', function ($m) {
                return mb_strtoupper($m[0], 'UTF-8');
            }, $w);
            continue;
        }

        // Deliberate internal capitals — but only when the value isn't shouted.
        if (!$isShouted && preg_match('/^.\S*\p{Lu}/u', $w)) { $out[] = $w; continue; }

        if ($i > 0 && in_array(mb_strtolower($bare, 'UTF-8'), TCIMS_PARTICLES, true)) {
            $out[] = mb_strtolower($w, 'UTF-8');
            continue;
        }

        $out[] = tcims_cap_letters($w);
    }

    return implode(' ', $out);
}

/** Emails are case-insensitive in practice; store them lowercase so they compare. */
function tcims_clean_email($raw) {
    return mb_strtolower(tcims_collapse_spaces($raw), 'UTF-8');
}

/** Free prose: trim the ends, leave the middle — including newlines — alone. */
function tcims_clean_prose($raw) {
    return trim((string)$raw);
}

/**
 * Apply a column → formatter map to a request body, in place.
 * Only keys actually present are touched, so a PUT that updates one field
 * does not resurrect the others.
 */
function tcims_format_body(array $body, array $map) {
    foreach ($map as $col => $kind) {
        if (!array_key_exists($col, $body) || !is_string($body[$col])) continue;
        if ($kind === 'name')       $body[$col] = tcims_proper_name($body[$col]);
        elseif ($kind === 'email')  $body[$col] = tcims_clean_email($body[$col]);
        elseif ($kind === 'prose')  $body[$col] = tcims_clean_prose($body[$col]);
        elseif ($kind === 'single') $body[$col] = tcims_collapse_spaces($body[$col]);
    }
    return $body;
}
