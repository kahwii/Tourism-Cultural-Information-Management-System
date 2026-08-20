<?php
/*
  REGRESSION SUITE — not an accuracy measure.

  Every case below is a real misclassification found by the CCAT team while
  using the live system, which was then fixed in config/sentiment.php. They are
  kept so that a future change to the lexicon cannot silently reintroduce a bug
  that was already solved.

  ------------------------------------------------------------------------
  IMPORTANT — how this must be reported
  ------------------------------------------------------------------------
  These cases pass BY CONSTRUCTION: the engine was modified until they passed.
  Counting them toward an accuracy figure would be circular reasoning and
  would inflate the result.

  Report them as: "N of N regression cases still pass", i.e. evidence that the
  known defects stay fixed. Report ACCURACY only from the held-out sample of
  real reviews that the engine was never tuned against.
  ------------------------------------------------------------------------

  Each entry records where it came from, so the provenance is auditable.

  "source" is either:
    "field"  — a real misclassification observed in live use and adjudicated by
               the CCAT team. These are authoritative.
    "review" — proposed while building the suite and NOT yet adjudicated by a
               human. Treat the expected label as a hypothesis until someone
               confirms it. A failure here may mean the LABEL is wrong rather
               than the engine, and must be checked before "fixing" anything.
*/

$TCIMS_REGRESSION_SET = [
    [
        "comment"  => "okay lang wala namang bago sakto lang",
        "rating"   => 5,
        "expected" => "Neutral",
        "source"   => "field",
        "issue"    => "Lukewarm phrasing was classified Positive because the 5-star rating broke the tie. Fixed with a neutral-phrase lock that the rating cannot override.",
    ],
    [
        "comment"  => "okay lang medjo maayos",
        "rating"   => 5,
        "expected" => "Neutral",
        "source"   => "field",
        "issue"    => "'medjo' (a misspelling of 'medyo') was not recognised as a softener, so 'maayos' scored at full strength. Fixed by adding the spelling variant and dampening softened words.",
    ],
    [
        "comment"  => "medyo maganda naman",
        "rating"   => 4,
        "expected" => "Neutral",
        "source"   => "field",
        "issue"    => "Adjudicated by the CCAT team as Neutral. Every sentiment word was hedged, so nothing scored, and the 4-star rating then promoted it to Positive. Fixed with a rule that locks a fully-hedged comment to Neutral so the rating cannot override it.",
    ],
    [
        "comment"  => "hindi gaanong maganda",
        "rating"   => 3,
        "expected" => "Neutral",
        "source"   => "review",
        "issue"    => "Hedged negation ('not that good') was scored identically to a flat 'not good'. Fixed by tracking intensifiers between the negator and the word.",
    ],
    [
        "comment"  => "okay naman hindi maganda at panget tama lang",
        "rating"   => 5,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "Verified by the CCAT team as correctly Negative: 'panget' stands alone and unhedged, so the hedging elsewhere must not rescue it.",
    ],
    [
        "comment"  => "sobrang ganda tangina",
        "rating"   => 5,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "Profanity must hard-override the result regardless of positive wording or star rating.",
    ],
    [
        "comment"  => "panget mo",
        "rating"   => 5,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "A 5-star rating must never override explicit negative wording.",
    ],
    [
        "comment"  => "pwede na rin",
        "rating"   => 4,
        "expected" => "Neutral",
        "source"   => "review",
        "issue"    => "Grudging acceptance is neutral, not positive.",
    ],
    [
        "comment"  => "wala namang bago",
        "rating"   => 3,
        "expected" => "Neutral",
        "source"   => "review",
        "issue"    => "'Nothing new' carries no polarity.",
    ],
    [
        "comment"  => "as expected lang, nothing special",
        "rating"   => 3,
        "expected" => "Neutral",
        "source"   => "review",
        "issue"    => "English lukewarm phrasing, same class of problem as the Filipino cases.",
    ],

    /* ------------------------------------------------------------------
       English slurs. Taken verbatim from rows 11, 20 and 21 of the live
       `reviews` table, where each was classified POSITIVE because of a high
       star rating. Filipino profanity was already overridden; the English
       equivalents were not, so abuse was being reported to CCAT as positive
       feedback. Adjudicated by the CCAT team as Negative.
       ------------------------------------------------------------------ */
    [
        "comment"  => "nigga",
        "rating"   => 5,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "Live row id 11: a racial slur with a 5-star rating was reported as Positive.",
    ],
    [
        "comment"  => "nigga church",
        "rating"   => 4,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "Live row id 20: slur attached to a place name, classified Positive.",
    ],
    [
        "comment"  => "mega mall niggas",
        "rating"   => 5,
        "expected" => "Negative",
        "source"   => "field",
        "issue"    => "Live row id 21: plural form, so the override has to match substrings rather than whole words.",
    ],
];
