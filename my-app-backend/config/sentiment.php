<?php
/*
  Lexicon-based sentiment analyzer for TCIMS tourist feedback.
  Handles English + Filipino/Taglish words and simple negation
  ("not clean", "hindi maganda"). Combines lexicon score with the
  star rating to produce: Positive / Neutral / Negative.
*/

function tcims_sentiment($comment, $rating = null) {
    $pos = [
        // English
        "clean","great","good","friendly","nice","excellent","accessible","beautiful",
        "love","loved","amazing","wonderful","helpful","safe","affordable","comfortable",
        "recommend","recommended","best","fast","organized","fun","enjoy","enjoyed",
        "satisfied","awesome","perfect","smooth","worth","quiet","spacious","modern",
        "informative","knowledgeable","professional","courteous","punctual","efficient",
        "responsive","hospitable",
        "picturesque","scenic","charming","welcoming","attentive","pristine","top-notch",
        "immaculate","breathtaking","must-visit","authentic","vibrant","lively",
        "instagrammable","iconic","well-maintained","stunning","cozy","peaceful","refreshing",
        // Filipino / Taglish
        "maganda","malinis","mabait","masarap","ayos","maayos","magaling","sulit",
        "masaya","panalo","galing","mabilis","ligtas","mura","presko","malamig",
        "magalang","maalaga","maasikaso","maaasahan","mabuti","matulungin",
        // bare roots (catch "sobrang ganda", "napakaganda" after prefix-stripping)
        "ganda","sarap","bait","linis","saya","bilis","lamig","galang","alaga",
        "asikaso","asa","tulong","lakas",
    ];
    // "okay"/"ok" are lukewarm, not a positive signal on their own — a review
    // that's "okay lang" while complaining about something else should not be
    // pulled toward Positive just because it contains the word "okay".
    $neg = [
        // English
        "dirty","bad","poor","hard","rude","slow","expensive","crowded","noisy","hassle",
        "worst","terrible","awful","disappointing","disappointed","unsafe","broken","smelly",
        "confusing","delay","delayed","dark","cramped","old","boring","overpriced","scam",
        "underwhelming","overcrowded","understaffed","disorganized","unorganized",
        "inefficient","mismanaged","unresponsive",
        "unwelcoming","unfriendly","unhelpful","neglected","abandoned","run-down","rundown",
        "dilapidated","overrated","subpar","mediocre","filthy","grimy","shabby","outdated",
        "creepy","sketchy","unsanitary","moldy","musty",
        // Filipino / Taglish
        "pangit","panget","marumi","bastos","mabagal","mahal","magulo","baho","masikip",
        "nakakainis","ingay","sira","madumi","delikado","init","mainit","sayang",
        "matagal","hirap","mahirap","kulang","masama","mahina",
        // bare roots (catch "sobrang bagal", "napakadumi" after prefix-stripping)
        "dumi","bagal","gulo","sikip","sama","hina","tagal",
        // insults / derogatory (negative, but not vulgar — shown uncensored)
        "bading","bobo","boba","tanga","engot","gunggong","inutil","hangal","hangag",
        "baduy","chaka","panghi","bwakanghari","kadiri","nakakadiri","walanghiya",
        // profanity / cursing — always a strong negative signal (English)
        "fuck","fucking","fucker","fuckin","motherfucker","shit","shitty","bullshit",
        "bitch","asshole","damn","dick","crap","bastard","cunt","wtf","dumbass","prick",
        "fuckyou","fucku","fucku",
        // profanity / cursing (Filipino / Taglish + phonetic variants)
        "putangina","putang","puta","tangina","tanginamo","gago","gaga","ulol",
        "bwisit","buwiset","leche","letse","pakshet","pakshit","pakyou","pakyu","paku",
        "fakyou","fakyu","tarantado","hinayupak","punyeta","lintik","yawa","kingina",
        "kupal","peste","demonyo","ungas","siraulo","pucha","putcha","shet","shunga",
    ];
    $negators = ["not","no","never","without","walang","wala","hindi","di","di","huwag",
                 "don't","didn't","wasn't","isn't","aren't","cannot","can't","wouldn't"];

    // Intensifiers that can sit between a negator and its target word without
    // breaking the negation ("hindi masyadong maganda", "not really clean").
    $intensifiers = ["very","really","too","so","masyado","masyadong","sobra","sobrang",
                      "talaga","gaano","gaanong","medyo","medjo","naman"];

    // Softener words ("medyo/medjo maayos" = "kind of okay", not a full "okay!").
    // When one of these sits immediately before a pos/neg word with no negator
    // in play, that word's contribution is dampened to 0 instead of a full
    // +-1 — it shouldn't swing the review to a clean Positive/Negative on its
    // own, matching how a person would actually read "medyo maayos naman" as
    // lukewarm rather than enthusiastic.
    $softeners = ["medyo","medjo","konti","kaunti","somewhat","slightly"];

    // Idiomatic phrases a per-token lexicon can't catch on its own, matched
    // against the raw text rather than individual tokens.
    $negPhrases = ["wouldn't go again","wouldn't recommend","would not recommend",
                   "would not go back","never again","not worth it","waste of time",
                   "waste of money","hindi ko na babalikan","ayaw ko nang bumalik",
                   "hindi na ako babalik","hindi ko rekomendado","matagal kami naghintay",
                   "mahabang pila","sobrang haba ng pila"];
    $posPhrases = ["would go back","will come back","would recommend","babalik ako",
                   "babalikan ko ito","sulit na sulit","worth every peso"];

    // Lukewarm/hedging phrases ("it's just okay", "nothing new", "just adequate")
    // signal genuine ambivalence. Even with zero pos/neg lexicon hits elsewhere,
    // these should stay Neutral rather than get pulled to Positive by a high
    // star rating — a common mismatch where a reviewer taps 4-5 stars out of
    // habit but the comment itself reads as unimpressed, not enthusiastic.
    $neutralPhrases = ["okay lang","ok lang","okay na lang","ayos lang","sakto lang",
                        "pwede na","pwede na rin","ganun lang","ganon lang",
                        "wala namang bago","walang bago","as expected","nothing special",
                        "nothing new","so-so","average lang","just okay","just ok"];

    // Distinctive profanity roots — matched as substrings so misspellings and
    // run-together variants ("pvtangina", "putanginamo", "tanginamo") are caught.
    // Only long, unambiguous roots to avoid flagging clean words.
    $profanityRoots = ["tangina","putang","punyeta","tarantado","hinayupak","kingina",
                       "motherfuck","putragis","pakshet","pakshit","pakyou","fakyou",
                       "bwiset","buwiset"];

    /*
      English slurs and abuse — matched as WHOLE WORDS, not substrings.

      Added after real feedback rows containing racial slurs were classified
      POSITIVE: Filipino profanity was covered, the English equivalents were
      not, so abuse carrying a 5-star rating reached CCAT as positive feedback.

      Why exact matching here, when the Filipino list above uses substrings:
      Filipino profanity fuses with affixes and pronouns ("putangina",
      "tanginamo"), so a substring test is the only thing that catches it.
      English does not do that, and substring matching creates real false
      positives — "nigga" would also flag "niggardly", and "retard" would flag
      "retardant" (as in fire retardant). Both would force an innocent review
      to Negative. Listing the actual forms avoids that entirely.

      Excluded on purpose: "chink" and "negro" — both have ordinary innocent
      meanings, and "negro" appears in Philippine place names (Negros).
    */
    $englishSlurs = ["nigga","niggas","niggaz","nigger","niggers","niggah",
                     "faggot","faggots","retard","retards","retarded",
                     "whore","whores","slut","sluts"];

    $text = strtolower((string)$comment);
    $tokens = preg_split("/[^a-z']+/", $text, -1, PREG_SPLIT_NO_EMPTY);

    // ---- HARD OVERRIDE: any profanity => Negative, regardless of star rating ----
    // A 5-star review that curses is contradictory; the cursing is the true signal.
    foreach ($tokens as $t) {
        if (in_array($t, $neg, true) && _tcims_is_curse($t)) {
            return ["sentiment" => "Negative", "score" => -99, "pos" => 0, "neg" => 1];
        }
        // whole-word English slurs
        if (in_array($t, $englishSlurs, true)) {
            return ["sentiment" => "Negative", "score" => -99, "pos" => 0, "neg" => 1];
        }
        foreach ($profanityRoots as $root) {
            if (strpos($t, $root) !== false) {
                return ["sentiment" => "Negative", "score" => -99, "pos" => 0, "neg" => 1];
            }
        }
    }

    // $softenedHits counts sentiment words that were deliberately hedged
    // ("medyo maganda"). They contribute no score, but the fact that the writer
    // hedged is itself a signal — see the decision block at the end.
    $score = 0; $posHits = 0; $negHits = 0; $softenedHits = 0;
    for ($i = 0; $i < count($tokens); $i++) {
        $w = $tokens[$i];

        // Filipino morphology normalization: strip a leading superlative/intensifier
        // prefix ("napaka-", "pinaka-": "napakaganda" -> "ganda") and/or a trailing
        // "-ng" linker ("magandang" -> "maganda", "gandang" -> "ganda") if the raw
        // token isn't already in either lexicon but the stripped form is.
        if (!in_array($w, $pos, true) && !in_array($w, $neg, true)) {
            $stripped = $w;
            foreach (["napaka", "pinaka"] as $prefix) {
                if (strpos($stripped, $prefix) === 0 && strlen($stripped) > strlen($prefix) + 2) {
                    $stripped = substr($stripped, strlen($prefix));
                    break;
                }
            }
            if (substr($stripped, -2) === "ng") {
                $maybe = substr($stripped, 0, -2);
                if (in_array($maybe, $pos, true) || in_array($maybe, $neg, true)) {
                    $stripped = $maybe;
                }
            }
            if (in_array($stripped, $pos, true) || in_array($stripped, $neg, true)) {
                $w = $stripped;
            }
        }

        // Look back past intensifiers ("hindi masyadong maganda") to find a negator.
        // $hedged tracks whether an intensifier sat BETWEEN the negator and this
        // word — "hindi gaanong maganda" ("not that beautiful") is a softer, more
        // hedged complaint than a bare "hindi maganda" ("not beautiful").
        $flip = false;
        $hedged = false;
        $j = $i - 1;
        while ($j >= 0) {
            if (in_array($tokens[$j], $negators, true)) { $flip = true; break; }
            if (!in_array($tokens[$j], $intensifiers, true)) break;
            $hedged = true;
            $j--;
        }

        // Dampened when: a softener sits directly before this word with no
        // negator ("medyo maayos"), OR the negation itself was hedged
        // ("hindi gaanong/masyadong maganda"). Either way it's a mild, lukewarm
        // signal, not a full-strength positive/negative one.
        $softened = (!$flip && $i > 0 && in_array($tokens[$i - 1], $softeners, true)) || ($flip && $hedged);

        if (in_array($w, $pos, true)) {
            if ($softened)   { $softenedHits++; /* dampened — no score change */ }
            elseif ($flip)   { $score -= 1; $negHits++; }
            else              { $score += 1; $posHits++; }
        } elseif (in_array($w, $neg, true)) {
            if ($softened)   { $softenedHits++; /* dampened — no score change */ }
            elseif ($flip)   { $score += 1; $posHits++; }
            else              { $score -= 1; $negHits++; }
        }
    }

    // Idiomatic phrases the token pass can't see on its own.
    foreach ($negPhrases as $p) {
        if (strpos($text, $p) !== false) { $score -= 2; $negHits++; }
    }
    foreach ($posPhrases as $p) {
        if (strpos($text, $p) !== false) { $score += 2; $posHits++; }
    }
    $lukewarm = false;
    foreach ($neutralPhrases as $p) {
        if (strpos($text, $p) !== false) { $lukewarm = true; break; }
    }

    // Emoji sentiment — tourists often lean on these instead of words. Matched
    // against the raw comment (tokenization above already dropped non-letters).
    $posEmoji = ["😊","🙂","😄","😃","😁","👍","❤️","😍","🥰","😆","🤩","👏","💯","😀","☺️","✨"];
    $negEmoji = ["😡","😠","👎","💩","😢","😭","🤮","😞","😤","🙁","😒","😑","😩","😫"];
    $raw = (string)$comment;
    foreach ($posEmoji as $e) {
        $c = substr_count($raw, $e);
        if ($c > 0) { $score += $c; $posHits += $c; }
    }
    foreach ($negEmoji as $e) {
        $c = substr_count($raw, $e);
        if ($c > 0) { $score -= $c; $negHits += $c; }
    }

    // The written comment is the primary signal. A star rating can only break a
    // tie when the text itself is neutral — it must NOT override clear wording.
    // (This is why "panget mo" with 5 stars is Negative, not cancelled out.)
    $r = ($rating !== null && $rating !== "") ? (int)$rating : null;

    if ($score < 0) {
        $label = "Negative";            // any net-negative wording stays negative
    } elseif ($score > 0) {
        $label = "Positive";            // any net-positive wording stays positive
    } elseif ($lukewarm) {
        $label = "Neutral";             // explicit hedging ("okay lang") stays neutral, rating doesn't override
    } elseif ($softenedHits > 0 && $posHits === 0 && $negHits === 0) {
        /*
          Every sentiment word in the comment was hedged, and nothing else scored.
          "medyo maganda naman" — the writer chose to qualify their praise, so a
          4-star rating must not promote it to a full Positive. Adjudicated by the
          CCAT team; the same rule covers "medyo maayos", "medyo malinis naman",
          and any other softened wording.

          Deliberately narrow: it only applies when NOTHING scored. A comment that
          also contains an unhedged word ("medyo maganda pero panget ang CR") still
          follows that word, which is the correct reading.
        */
        $label = "Neutral";
    } elseif ($r !== null && $r >= 4) {
        $label = "Positive";            // text neutral -> trust a high rating
    } elseif ($r !== null && $r <= 2) {
        $label = "Negative";            // text neutral -> trust a low rating
    } else {
        $label = "Neutral";
    }

    return ["sentiment" => $label, "score" => $score, "pos" => $posHits, "neg" => $negHits];
}

// Exact-match check against the curse words (subset of the negative lexicon).
function _tcims_is_curse($w) {
    static $curses = ["fuck","fucking","fucker","fuckin","motherfucker","fuckyou","fucku",
        "shit","shitty","bullshit","bitch","asshole","damn","dick","crap","bastard","cunt",
        "wtf","dumbass","prick","putangina","putang","puta","tangina","tanginamo","gago",
        "gaga","ulol","bwisit","buwiset","leche","letse","pakshet","pakshit","pakyou","pakyu",
        "fakyou","fakyu","tarantado","hinayupak","punyeta","lintik","yawa","kingina","kupal",
        "peste","demonyo","ungas","siraulo","pucha","putcha","shet","shunga"];
    return in_array($w, $curses, true);
}
