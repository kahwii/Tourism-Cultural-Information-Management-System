<?php
/*
  Machine Learning sentiment classifier — plain PHP inference.

  This is NOT training code. Training happens offline on a developer's
  machine (see ml_training/train_sentiment.py, run with scikit-learn) and
  produces ml_training/model_weights.json. This file just loads those
  learned numbers and does the same math scikit-learn's MultinomialNB does
  internally, so the live server can classify a comment without needing
  Python or scikit-learn installed anywhere in production.

  STATUS: shadow mode only. This model currently scores lower on
  human-verified evaluation (see ml_training/README.md and SCALING_PLAN.md)
  than the rule-based lexicon (config/sentiment.php), which remains the
  sentiment shown to users and staff. Every new review is ALSO scored here
  and stored (see the `ml_sentiment` column) purely so we can keep measuring
  the ML model against real field data as the training set grows, and make
  a data-driven call later about when (or whether) to promote it to primary.

  HOW THE MATH WORKS (matches scikit-learn's MultinomialNB.predict):
  For each candidate class, start from that class's log-prior (how common
  the class is overall), then for every word/word-pair in the comment that
  the model actually learned during training, add (how many times it
  appears x how "expected" that word is for this class, in log form).
  Whichever class ends with the highest total wins. Words the model never
  saw during training are simply skipped — they contribute nothing either
  way, which is the same as scikit-learn's behavior for out-of-vocabulary
  tokens at prediction time.
*/

/**
 * Tokenize the same way scikit-learn's CountVectorizer does by default:
 * lowercase, then extract runs of 2+ word characters (letters/digits/
 * underscore). This intentionally drops punctuation, emoji, and single
 * letters, matching the vocabulary the Python side actually trained on.
 */
function tcims_ml_tokenize($text) {
    $text = mb_strtolower($text, 'UTF-8');
    preg_match_all('/[\p{L}\p{N}_]{2,}/u', $text, $matches);
    return $matches[0];
}

/** Remove stopwords, then build n-grams from what's left — in that order,
 *  because that's the order scikit-learn applies them in. */
function tcims_ml_features($tokens, $stopWords, $ngramRange) {
    if (!empty($stopWords)) {
        $stopSet = array_flip($stopWords);
        $tokens = array_values(array_filter($tokens, function ($t) use ($stopSet) {
            return !isset($stopSet[$t]);
        }));
    }

    [$lo, $hi] = $ngramRange;
    $features = [];
    $n = count($tokens);
    for ($size = $lo; $size <= $hi; $size++) {
        for ($i = 0; $i + $size <= $n; $i++) {
            $features[] = implode(' ', array_slice($tokens, $i, $size));
        }
    }
    return $features;
}

/**
 * Classify a comment with the trained ML model.
 * Returns ["sentiment" => "Positive"|"Neutral"|"Negative", "score" => float]
 * or null if no trained model is available yet (e.g. train_sentiment.py
 * hasn't been run, or model_weights.json wasn't deployed with this build).
 */
function tcims_sentiment_ml($comment) {
    static $weights = false; // false = not loaded yet, null = load attempted and failed

    if ($weights === false) {
        $path = __DIR__ . '/../ml_training/model_weights.json';
        $weights = null;
        if (file_exists($path)) {
            $raw = file_get_contents($path);
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && isset($decoded['vocabulary'], $decoded['classes'])) {
                $weights = $decoded;
            }
        }
    }

    if ($weights === null) return null; // no model trained/deployed — caller should skip storing ml_sentiment

    $tokens = tcims_ml_tokenize((string)$comment);
    $ngramRange = $weights['ngram_range'] ?? [1, 1];
    $stopWords = $weights['stop_words'] ?? [];
    $features = tcims_ml_features($tokens, $stopWords, $ngramRange);

    // Count how many times each in-vocabulary feature appears (bag of words).
    $counts = [];
    foreach ($features as $f) {
        if (isset($weights['vocabulary'][$f])) {
            $idx = $weights['vocabulary'][$f];
            $counts[$idx] = ($counts[$idx] ?? 0) + 1;
        }
    }

    // If not a single word/phrase in the comment matched anything the model
    // was trained on, scikit-learn's own predict() would still confidently
    // pick a class purely from class_log_prior — i.e. whichever label was
    // most common in training data (currently Negative, 45/112). That's a
    // real, observed failure mode (see sentiment_ml_test.php: "😊", a lone
    // "maganda", an address with no sentiment words all got called
    // Negative for this reason), not a considered judgment about the text.
    // Reporting "Neutral — no signal" here instead is a deliberate business
    // rule on TOP of the raw model, not a change to the trained model
    // itself; train_sentiment.py's accuracy numbers are unaffected.
    if (empty($counts)) {
        return ["sentiment" => "Neutral", "score" => null, "no_signal" => true];
    }

    $bestClass = null;
    $bestScore = -INF;
    foreach ($weights['classes'] as $ci => $className) {
        $score = (float)$weights['class_log_prior'][$ci];
        foreach ($counts as $idx => $cnt) {
            $score += $cnt * (float)$weights['feature_log_prob'][$ci][$idx];
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestClass = $className;
        }
    }

    if ($bestClass === null) return null;
    return ["sentiment" => $bestClass, "score" => $bestScore];
}
