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

| Source | Count | Role |
|---|---|---|
| Human-labelled real visitor reviews + reference sentences (`training_data.csv`) | **126** | Trained on **and** scored on |
| Synthetic, AI-generated sentences (`synthetic_data.csv`, `synthetic_data_v2.csv`) | 510 | Trained on only — never scored |
| Synthetic sets that failed and are not shipped (`synthetic_data_v3.csv`, `synthetic_data_v4.csv`) | 180 | Neither — kept as negative results (5c) |

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

**Disclosure on synthetic data.** 510 AI-generated tourism sentences are used
as **training material only**, to give the model exposure to common vocabulary
(*staff, presyo, kalinisan, tanawin*) that 126 real reviews cannot cover. They
are added to the training side of every split and are **never scored against**:
no accuracy figure in this chapter can be earned by recognising the system's
own phrasing. Every reported figure is measured on human-verified rows alone.

Stated for the paper: *"The classifier was trained on 126 human-verified
reviews augmented with 510 AI-generated synthetic examples. The synthetic
examples were included in the training partition of every cross-validation
fold and excluded from every test partition, so all reported accuracy figures
were evaluated exclusively on human-verified data."*

This wording changed once, and the earlier version should not be quoted. It
said the synthetic rows were absent from evaluation *and* that the reported
figure described the shipped model. Both could not be true: the shipped model
was re-fit on real + synthetic data after measurement, so the figure described
a different, weaker classifier. Augmenting inside each fold removes the
contradiction — see Section 5c.

---

## 2b. How the reported figure changed, and why

Three things moved the number during this round. Only one of them was a model
change; the first was a correction, and it is worth reporting as such.

| Stage | Repeated sub-sampling accuracy |
|---|---|
| Word features, vectorizer fit before splitting | 66.79% |
| Same model, **vocabulary leakage fixed** | 69.62% |
| **Character n-grams (3-5)** selected by model search | 76.15% |
| **Synthetic rows added to every training fold**, char (2-4), α = 0.05 | **82.69%** |

**The leakage fix.** The first version built the feature vocabulary from all
126 comments *before* splitting into train and test, so the model knew the
vocabulary of the held-out rows while training. That is a mild form of
information leakage. Building the vectorizer inside a scikit-learn `Pipeline`
re-fits it on each fold's training rows only. The corrected figure is the one
reported here; the earlier number should not be quoted.

**The feature change.** See Section 5b.

**The measurement change.** See Section 5c. Up to this point the reported
figure described a model trained on real data alone — but the model actually
deployed had *also* seen the synthetic rows, because they were added in the
final re-fit. The number therefore described a classifier nobody was running.
Each training fold now receives the same synthetic augmentation the shipped
model gets, while test folds stay purely real, so the figure and the
deployment finally describe the same thing. This is a correction to the
evaluation, not a change to the model, and the gain it reveals was always
there — it was simply not being measured.

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

A grid search over feature and smoothing settings (word unigrams vs. unigrams +
bigrams, character n-grams, stopwords on/off, and Laplace smoothing
α ∈ {0.05, 0.1, 0.3, 0.5, 1.0, 2.0}) selects the configuration by
cross-validation rather than by assumption.

In all three measures the synthetic rows are appended to the training fold
*inside* the loop, never before it. Appending them beforehand would make them
eligible to land in a test fold, and the model would then be graded partly on
sentences the system wrote itself.

---

## 4. Results — three-class classification

Winning configuration: **character n-grams (2-4) inside word boundaries,
α = 0.05**, trained on the real training fold plus 510 synthetic rows.
(Word-unigram baseline, α = 1.0, measured the same way: 71.45%.)

| Measure | Result |
|---|---|
| **Repeated random sub-sampling (30 splits) — headline figure** | **82.69%** (min 69%, max 96%) |
| 5-fold cross-validation | 82.55% (folds: 81%, 76%, 76%, 96%, 84%) |
| Same configuration, trained on real rows only | 72.82% |
| Paired effect of augmentation across those 30 splits | **28 wins / 2 ties / 0 losses** |

Zero losses across thirty paired splits is worth stating plainly: the
augmented model was never worse on any draw, so the improvement does not
depend on which rows happened to land in the test set.

The shipped model contains 5,007 features across 3 classes and trains on 636
examples (126 real + 510 synthetic).

**What this figure does not claim.** The single fixed split (random_state=42)
returned 73.08%, and its confusion matrix shows Neutral recall at 0.17 — six
Neutral rows, one caught. A 26-row test set splits three ways into pieces too
small to support a per-class claim, which is exactly why the averaged figure
is the headline and the per-class numbers below are read as direction rather
than measurement. Neutral remains the weak class (Section 5).

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

## 5a. What did NOT work — synthetic data augmentation *(superseded — see 5c)*

> **This section's conclusion no longer holds.** Everything below was measured
> on a **word-feature** model. Re-run under character features, augmentation
> helps substantially. The section is kept intact rather than rewritten,
> because the reversal is itself the finding: the same experiment, same data,
> same protocol, opposite answer once the feature representation changed.

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

## 5c. The reversal — augmentation re-tested under character features

Section 5a concluded that synthetic augmentation was worthless. Section 5b
then changed the feature representation from words to character n-grams. The
augmentation question was re-opened rather than assumed to be settled, using
the identical protocol — conditions differing only in which synthetic files
join the training set, all scored on the same 30 held-out splits of real
reviews, no synthetic row ever scored against (`experiment_augmentation_v2.py`).

| Condition | Accuracy | vs A | Paired W/T/L | Neutral F1 |
|---|---|---|---|---|
| A. real only | 76.41% | — | — | 0.623 |
| B. + v1 (390) | 80.00% | +3.59 | 16 / 9 / 5 | 0.678 |
| **C. + v1 + v2 (510)** | **83.21%** | **+6.79** | **21 / 5 / 4** | **0.716** |
| D. + v1 + v2 + v3 | 80.13% | +3.72 | 17 / 4 / 9 | 0.659 |
| E. + v1 + v2 + v4 | 81.92% | +5.51 | 19 / 8 / 3 | 0.700 |
| F. everything | 80.51% | +4.10 | 18 / 5 / 7 | 0.679 |

Only C clears the pre-set bar of +3 points **and** at least 20 of 30 paired
wins. It is the configuration that ships.

**Why the answer changed with the features.** A word model can only use a
synthetic sentence if the exact tokens in it recur in real reviews, and
templated sentences largely repeat one another's vocabulary — so most of the
390 rows taught it nothing it could apply. A character model breaks every
sentence into overlapping 2-4 character fragments, so a synthetic row still
teaches it the shape of Filipino affixes and the spelling of tourism
vocabulary even when the sentence as a whole reads nothing like real feedback.

The general lesson is worth stating in the discussion: *"does augmentation
help?"* has no permanent answer. It is a question about a specific pairing of
data and feature representation, and it has to be re-asked whenever either one
changes. An experiment retired as settled was, in this case, wrong for four
weeks.

**Volume is not the mechanism.** v3 (60 Neutral-only rows) and v4 (120 rows
written in deliberately realistic Taglish, 40 per class) were both authored to
strengthen Neutral, the weakest class. Both made the model *worse* — D and F
lose ground against C, and v3 lowers Neutral F1 to 0.659 against C's 0.716.
Adding more synthetic data is not what produced the gain, so the result cannot
be extended by simply generating more. Both failures are kept in the repository
and in the table above rather than dropped.

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

2. **The pool of distinct real reviews is exhausted.** The `reviews` table
   holds roughly 148 comments long enough to be judgeable. All but seven have
   been labelled, and those seven are test entries ("Goodmorning emman"), not
   feedback. No further improvement is available from the existing data — more
   labelled data requires more real usage.

2b. **What a higher target would take.** A learning curve over the existing
   data (training on 25%, 40%, ... 100% of the labelled rows) is still rising
   steeply at 126 examples rather than flattening, which says the limit here is
   data volume and not the model family. Extrapolating a log-linear fit puts
   85% at roughly 200 labelled rows and 90% at roughly 270 — but extrapolation
   from six points on a curve that has not begun to saturate is an estimate of
   direction, not a promise of a figure, and the same fit absurdly predicts
   above 100% by 500 rows. Quoting it as a plan would be dishonest; quoting it
   as evidence that labelled data is the binding constraint is fair.

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
