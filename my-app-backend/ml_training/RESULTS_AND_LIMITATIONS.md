# Sentiment Analysis — Results and Limitations

Draft write-up for the thesis results chapter. All figures below were produced
by `train_sentiment.py` and `diagnostic_binary.py` on 2026-09-08, and can be
reproduced by re-running those scripts against `training_data.csv`.

---

## 1. What was evaluated

TCIMS classifies every visitor review as **Positive**, **Neutral**, or
**Negative**. Two classifiers exist in the system:

| Engine | File | Status |
|---|---|---|
| Rule-based lexicon | `config/sentiment.php` | **Live** — this is what users and CCAT staff see |
| Machine learning (Multinomial Naive Bayes) | `config/sentiment_ml.php` + `ml_training/model_weights.json` | **Shadow mode** — scores every review into the `ml_sentiment` column for measurement, but is not shown to anyone |

The ML model is trained offline in Python (`train_sentiment.py`, scikit-learn)
and exported as plain numbers (`model_weights.json`) that the PHP server reads
at runtime, so no Python or scikit-learn is required in production.

Keeping the ML model in shadow mode is a deliberate decision, not an
incomplete feature: it is only promoted to primary if and when it
outperforms the lexicon on human-verified data. That has not happened yet
(see Section 6).

---

## 2. Dataset

| Source | Count | Used for accuracy? |
|---|---|---|
| Human-labelled real visitor reviews + reference sentences (`training_data.csv`) | **126** | **Yes** |
| Synthetic, AI-generated template sentences (`synthetic_data.csv`) | 390 | **No** — production model only |

Class distribution of the 126 human-labelled examples:

| Class | Count | Share |
|---|---|---|
| Negative | 55 | 43.7% |
| Positive | 43 | 34.1% |
| Neutral | 28 | 22.2% |

**Labelling procedure.** Reviews were drawn at random from the live `reviews`
table using `api/sentiment_sample.php`, which deliberately withholds two
things from the labeller: (a) the classifier's own prediction, so the engine
is not graded against itself, and (b) the star rating, so what is measured is
the reading of the *text* rather than the rating doing the work. Labels were
assigned on the wording alone. Comments that were genuinely ambiguous, or that
were test/debug entries rather than real feedback, were left unlabelled and
excluded rather than guessed at.

**Disclosure on synthetic data.** 390 AI-generated, template-based tourism
sentences are mixed in when training the model that actually ships, purely to
give it exposure to common vocabulary (*staff, presyo, kalinisan, tanawin*)
that the small real dataset does not cover. They are **never** used in any
accuracy computation. Every figure reported in this chapter is measured on
human-verified data only. This should be stated plainly in the paper, e.g.:
*"The production model was trained on 126 human-verified reviews plus 390
AI-generated synthetic examples for vocabulary augmentation; all reported
accuracy figures were evaluated exclusively on human-verified data."*

---

## 2b. How the reported figure changed, and why

Three things moved the number during this round. Only one of them was a model
change; the first was a correction, and it is worth reporting as such.

| Stage | Repeated sub-sampling accuracy |
|---|---|
| Word features, vectorizer fit before splitting | 66.79% |
| Same model, **vocabulary leakage fixed** | 69.62% |
| **Character n-grams (3-5)** selected by model search | **76.15%** |

**The leakage fix.** The first version built the feature vocabulary from all
126 comments *before* splitting into train and test, so the model knew the
vocabulary of the held-out rows while training. That is a mild form of
information leakage. Building the vectorizer inside a scikit-learn `Pipeline`
re-fits it on each fold's training rows only. The corrected figure is the one
reported here; the earlier number should not be quoted.

**The feature change.** See Section 5b.

---

## 3. Evaluation method

With only 126 examples, a single 80/20 train/test split produces a test set of
just 26 rows — small enough that which specific rows happen to land in it can
swing the result by 10–20 percentage points. Reporting one such split would be
reporting noise, and re-running it with different random seeds until a
flattering number appeared would be cherry-picking.

Three measures are therefore reported together:

1. **5-fold cross-validation** — trains and tests five times on different
   slices and averages.
2. **Repeated random sub-sampling (30 different 80/20 splits)** — the most
   trustworthy held-out-style estimate at this dataset size, and the figure
   that should be quoted as the headline accuracy.
3. **One fixed split (random_state=42)** — reported only because it yields a
   readable confusion matrix and per-class breakdown, not as the headline.

A grid search over feature and smoothing settings (unigrams vs. unigrams +
bigrams, stopwords on/off, and Laplace smoothing α ∈ {0.1, 0.3, 0.5, 1.0, 2.0})
selects the configuration by cross-validation rather than by assumption.

---

## 4. Results — three-class classification

Winning configuration: **character n-grams (3-5) inside word boundaries,
α = 0.1**, 4,163 distinct features on the real data. (Word-unigram baseline,
α = 1.0: 69.08%.)

| Measure | Result |
|---|---|
| **Repeated random sub-sampling (30 splits) — headline figure** | **76.15%** (min 62%, max 88%) |
| 5-fold cross-validation | 76.98% (folds: 77%, 76%, 92%, 80%, 60%) |

The production model, which additionally sees the synthetic vocabulary data,
contains 5,396 features across 3 classes.

A note on single splits: one fixed 80/20 draw of this dataset returned 53.85%,
which sits outside the 62-88% range of the 30 averaged draws. That is exactly
why a single split is not quoted — with a 26-row test set, one draw is mostly
luck. The averaged figure is the honest one, in either direction.

---

## 5. Key finding — the Neutral class is the bottleneck

To test whether Neutral specifically is what limits accuracy (rather than the
dataset being too small in general), the identical training procedure was
re-run with all Neutral rows removed, leaving 98 Positive/Negative examples
(`diagnostic_binary.py`). This is a diagnostic only — the deployed model
remains three-class.

| Task | Repeated random sub-sampling | 5-fold CV |
|---|---|---|
| Three-class (Positive / Neutral / Negative) | **66.79%** | 73.85% |
| Two-class (Positive / Negative only) | **82.83%** (min 70%, max 95%) | 87.68% |

**Removing Neutral raises accuracy by roughly 16 percentage points.** Two
reasons explain this, and both are worth stating in the discussion:

1. **Data imbalance.** Neutral has only 28 examples, against 55 Negative and
   43 Positive. People who take the time to write a review usually have a
   strong opinion; genuinely lukewarm comments are rarer in the wild, so
   random sampling naturally yields fewer of them.

2. **Neutral is conceptually harder for a bag-of-words model.** Positive and
   Negative are marked by *distinctive vocabulary* ("maganda", "malinis",
   "dumi", "bastos"). Neutral is defined by the *absence* of such words — a
   statement of fact, a question, or a lukewarm remark. A model that decides by
   summing per-word sentiment evidence has little positive signal to key on for
   a class whose defining property is having no strong signal.

This is a more useful result than the headline number alone: it identifies
*where* the limitation lies and *why*, and it points to a specific, testable
remedy rather than a vague "needs more data". Sections 5a and 5b are what came
of testing those remedies — one failed, one worked.

(The binary diagnostic above was run on the word-feature model, before the
change in Section 5b. Character features later lifted Neutral F1 from 0.575
to 0.630, so part of this gap has since been closed.)

---

## 5a. What did NOT work — synthetic data augmentation

The obvious response to "the Neutral class needs more examples" is to write
more of them. This was tested properly rather than assumed, in
`experiment_augmentation.py`: models differing *only* in which synthetic data
they were trained on, all scored on the **same** 30 held-out splits of real
reviews. Synthetic rows were never scored against.

- **v1** = the original 390 templated synthetic examples.
- **v2** = 120 new examples, Neutral written as factual/logistical statements
  ("Nagpunta kami dito nung Linggo ng umaga").
- **v3** = 60 new Neutral examples rewritten to match how real neutral reviews
  in this database actually sound — short lukewarm evaluations
  ("sakto lang, walang sobra walang kulang").

| Condition | Accuracy | vs A | Paired W/T/L | Neutral F1 |
|---|---|---|---|---|
| A. real only | 68.59% | — | — | 0.586 |
| B. + v1 | 70.00% | +1.41 | 12 / 5 / **13** | 0.607 |
| C. + v1 + v2 | 71.28% | +2.69 | 14 / 7 / 9 | 0.578 |
| D. + v1 + v3 | 65.13% | **-3.46** | 8 / 4 / **18** | **0.527** |
| E. + v1 + v2 + v3 | 68.97% | +0.38 | 14 / 4 / 12 | 0.556 |

**None of these is a real improvement.** B's positive average comes with *more
losses than wins* across paired splits. D — the version deliberately written
to match real phrasing — was the worst of all, and lowered Neutral F1, the
very thing it was written to raise. The likely cause is that adding 60
Neutral-only rows skewed the class balance toward Neutral while reusing
vocabulary ("sakto", "okay", "ayos") that also appears in real Positive and
Negative reviews.

Reported here as a negative result, including the fact that the currently
shipped model's own v1 augmentation has no demonstrated benefit on real data.

---

## 5b. What DID work — character n-grams

`experiment_model_search.py` searched **256 feature/classifier configurations**
(word vs. character n-grams, raw counts vs. TF-IDF, MultinomialNB vs.
ComplementNB, uniform vs. fitted class priors, several smoothing values),
selected by cross-validation and then re-scored on the same 30 paired splits.

| Configuration | Accuracy | vs previous | Paired W/T/L | Neutral F1 |
|---|---|---|---|---|
| **char_wb (3-5), MultinomialNB α=0.1** | **76.15%** | **+6.54** | **22 / 4 / 4** | 0.630 |
| tfidf_char (3-5), α=0.1 | 75.90% | +6.28 | 25 / 2 / 3 | 0.626 |
| word (1,1), α=0.1 *(previous)* | 69.62% | — | — | 0.575 |
| word (1,1), ComplementNB α=1.0 | 68.97% | -0.64 | 7 / 13 / 10 | 0.633 |

The adoption bar was set in advance — at least +3 points **and** wins on at
least 20 of 30 paired splits — specifically so that a lucky average could not
be mistaken for an improvement. Character n-grams cleared it; ComplementNB and
TF-IDF did not.

**Why it works on this data.** Real reviews are full of elongation and
misspelling ("gandaaa", "gnda", "dto"), and Filipino builds meaning by
affixing: *ganda → maganda → napakaganda → kagandahan*. A word-level model
treats every one of those as an unrelated token, each to be learned from a
handful of examples. A character model sees the shared *"ganda"* inside all of
them. This is a property of the language and of informal user-generated text,
not a generic tuning trick — which is why it is worth stating as a finding.

**Deployment consequence.** The PHP inference (`config/sentiment_ml.php`) had
to be extended to reproduce scikit-learn's `char_wb` rule exactly — word
padding, the short-word case, whitespace collapsing, and multi-byte handling
for Filipino characters and emoji. Because a mismatch there would change
predictions silently, `train_sentiment.py` now exports `parity_fixture.json`
(the trained model's own predictions on fixed inputs) and
`api/sentiment_ml_parity.php` replays them through PHP and reports any
disagreement. Agreement must be 100% for the Python accuracy figures to
describe what is actually running.

---

## 6. Comparison with the rule-based lexicon

The lexicon (`config/sentiment.php`) remains the live engine because it still
outperforms the ML model on human-verified data. Its evaluation is exposed at
`api/sentiment_eval.php`:

| Measure | Lexicon |
|---|---|
| Reference test set (45 balanced hand-labelled sentences) | 100% accuracy, 100% macro F1 |
| Regression suite (defects reported by CCAT in live use, then fixed) | 9/9 confirmed defects still fixed |

Two honesty caveats that should appear in the paper rather than be omitted:

- The 100% on the reference set is a **sanity check, not proof of a perfect
  classifier**. Those 45 samples carry unambiguous sentiment words, and the
  Neutral ones are plain statements of fact — exactly the cases a lexicon
  handles trivially.
- The regression suite passes **by construction** — the lexicon was edited
  until those cases passed, so counting them toward accuracy would be circular
  reasoning. They are evidence of software quality (known defects stay fixed),
  not of classification accuracy.

A side-by-side functional comparison of both engines on 24 deliberately hard
cases (negation, Taglish, emoji, profanity, sarcasm, misspellings,
out-of-vocabulary slang) is available at `api/sentiment_ml_test.php`. It is a
behavioural test, not an accuracy benchmark, and is useful mainly for showing
*where the two approaches disagree* — the lexicon handles unfamiliar slang
poorly, while the ML model handles negation and slang better but misreads
short, low-context comments.

---

## 7. Limitations

1. **Dataset size.** 126 human-labelled examples is small for a three-class
   text classifier. At this size, accuracy estimates carry wide variance
   (the 30 splits ranged from 62% to 88%), which is why an averaged figure is
   reported rather than any single split.

1b. **Selection over 256 configurations on 126 examples** carries some risk of
   picking a configuration that flatters this particular dataset. This was
   mitigated by requiring a margin and a majority of paired wins rather than a
   higher average alone, but it cannot be eliminated at this sample size. The
   number of configurations searched is disclosed for that reason.

2. **The pool of distinct real reviews is nearly exhausted.** The `reviews`
   table currently holds roughly 148 comments long enough to be judgeable, and
   almost all of them have now been labelled. No further accuracy improvement
   is available from the existing data — new labelled data requires new real
   usage.

3. **Neutral under-representation**, as quantified in Section 5.

4. **Sarcasm and context remain unsolved by both engines.** Neither a lexicon
   nor a bag-of-words model can detect that "Wow, ang bagal talaga, sulit na
   sulit ang paghihintay" is a complaint, because every individual word in it
   is positive. This is a known limitation of the model family, not a bug.

5. **Labelling is single-annotator.** No inter-annotator agreement statistic
   (e.g. Cohen's κ) was computed. For borderline cases — mixed sentiment,
   profanity used as emphasis, contradictory statements — a second independent
   labeller would strengthen the methodology.

6. **Profanity policy is a product rule, not a sentiment judgment.** The
   lexicon hard-overrides any comment containing profanity to Negative,
   regardless of surrounding words, so that abusive content is always
   surfaced to CCAT. Training labels follow the same convention for
   consistency. This means both engines will call "sobrang ganda tangina"
   Negative even though a human reader might judge the underlying sentiment
   positive. This is intentional and should be disclosed rather than treated
   as a misclassification.

---

## 8. Future work

Documented in full in `SCALING_PLAN.md`. In priority order:

1. **Collect more real labelled data, targeting Neutral.** The single largest
   available improvement. A user acceptance testing session doubles as a data
   collection exercise: participants leave genuine reviews, which are then
   sampled (`sentiment_sample.php`), labelled blind, merged
   (`merge_reviews.py`), and used to retrain.

2. **Adopt a fixed held-out test set.** Currently each retraining run makes a
   fresh random split, so accuracy figures move between runs for reasons
   unrelated to model quality. A test set set aside once and never trained on
   would make "did this retrain actually improve things?" a meaningful
   question.

3. **Compare before shipping.** Never overwrite `model_weights.json` simply
   because training finished — score the new model against the fixed test set
   and the currently deployed one first.

4. **Consider a stronger model only once data is no longer the bottleneck.**
   At a few hundred examples, Naive Bayes with bag-of-words is close to the
   practical ceiling; logistic regression or an SVM only becomes worth the
   added complexity at roughly 10,000+ labelled examples.

---

## 9. Suggested phrasing for the defence

> The machine learning classifier achieves **76.15% accuracy** on three-class
> sentiment (Positive/Neutral/Negative), averaged over 30 randomized held-out
> splits of 126 human-verified reviews. This figure reflects two corrections
> made during evaluation: removing vocabulary leakage from the train/test
> split (+2.8 points), and adopting character n-gram features after a search
> over 256 configurations (+6.5 points, winning 22 of 30 paired splits).
> Character features suit the data because Filipino is morphologically rich
> and informal reviews contain heavy misspelling and elongation, which
> word-level features cannot generalise across. A controlled diagnostic
> removing the Neutral class raises accuracy to **82.83%**, identifying
> Neutral — the smallest class at 28 examples, and the one defined by the
> absence of sentiment vocabulary rather than its presence — as the principal
> remaining limitation. Synthetic data augmentation was tested across five
> conditions and did not produce a reliable gain, which is reported as a
> negative result. The rule-based lexicon remains the deployed engine, with
> the ML model in shadow mode so both are measured against the same live data
> as the labelled dataset grows.

If asked *"why not higher?"*: the honest answer is dataset size and class
balance, both quantified above, with a documented path to improvement — not a
limitation of the implementation.

If asked *"what did you try that failed?"*: synthetic augmentation (Section
5a), ComplementNB, and TF-IDF weighting, all measured and all rejected against
a pre-declared adoption bar. Being able to answer this is itself evidence that
the 76.15% was arrived at by testing rather than by tuning until a number
looked acceptable.
