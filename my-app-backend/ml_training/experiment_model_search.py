"""
EXPERIMENT — can a better feature representation beat the current model?

Data augmentation was tested in experiment_augmentation.py and did not help
(see RESULTS_AND_LIMITATIONS.md). This script tests the other legitimate
lever: keeping exactly the same 126 real examples, but changing how the text
is turned into features and which Naive Bayes variant reads them.

Three ideas are tested, each chosen for a specific weakness we actually
observed in this dataset — not just thrown at the wall:

  1. CHARACTER n-grams (analyzer="char_wb")
     Real reviews are full of elongation and misspelling ("gandaaa", "gnda",
     "dto") and Filipino is morphologically rich (ganda / maganda /
     napakaganda / kagandahan). To a word-level model those are all
     completely unrelated tokens. At the character level they share
     substrings, so the model can generalise across them.

  2. ComplementNB
     A Naive Bayes variant designed specifically for IMBALANCED training
     sets, which is exactly our problem (Negative 55, Positive 43,
     Neutral 28). Standard MultinomialNB is biased toward the majority class.

  3. TF-IDF weighting (+ sublinear_tf)
     Down-weights words that appear everywhere and carry little information,
     instead of treating every occurrence as equally meaningful.

Also tested: uniform class priors (fit_prior=False), which stops the model
from favouring Negative simply because Negative is the most common label.

HONESTY NOTE — SELECTION OVERFITTING
------------------------------------
Searching many configurations against a small dataset risks picking one that
looks good by luck. Two guards are used:

  * Selection is done by 5-fold cross-validation, then the finalists are
    re-scored on 30 repeated held-out splits — the same 30 splits for every
    finalist, so comparisons are paired.
  * A new configuration is only worth adopting if it wins by a clear margin
    AND wins on a clear majority of the paired splits. The script says so
    explicitly at the end rather than leaving it to interpretation.

The number of configurations searched is printed, so it can be disclosed in
the methodology section.

This script does NOT overwrite model_weights.json. It only measures and
recommends.

Run: python experiment_model_search.py
"""

import csv
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB, ComplementNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report

N_REPEATS = 30
TOP_N = 6

TAGALOG_ENGLISH_STOPWORDS = [
    "ang", "ng", "mga", "sa", "na", "at", "ay", "ako", "ko", "mo", "niya",
    "namin", "natin", "nila", "kami", "tayo", "sila", "ito", "iyon", "yun",
    "yan", "dito", "doon", "din", "rin", "lang", "po", "pa", "para",
    "the", "a", "an", "is", "was", "are", "were", "to", "of", "in", "on",
    "for", "and", "it", "this", "that", "i", "we", "you", "they",
]

rows = list(csv.DictReader(open("training_data.csv", encoding="utf-8")))
comments = [r["comment"] for r in rows]
labels = np.array([r["label"] for r in rows])

print(f"Loaded {len(comments)} real labelled comments.")
print(f"Class counts: { {c: list(labels).count(c) for c in sorted(set(labels))} }\n")


def build(vec_kind, ngram, stop, min_df, clf_kind, alpha, fit_prior):
    if vec_kind == "count_word":
        vec = CountVectorizer(lowercase=True, ngram_range=ngram, stop_words=stop, min_df=min_df)
    elif vec_kind == "tfidf_word":
        vec = TfidfVectorizer(lowercase=True, ngram_range=ngram, stop_words=stop,
                              min_df=min_df, sublinear_tf=True)
    elif vec_kind == "count_char":
        vec = CountVectorizer(lowercase=True, analyzer="char_wb", ngram_range=ngram, min_df=min_df)
    elif vec_kind == "tfidf_char":
        vec = TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=ngram,
                              min_df=min_df, sublinear_tf=True)
    else:
        raise ValueError(vec_kind)

    clf = (MultinomialNB(alpha=alpha, fit_prior=fit_prior) if clf_kind == "MultinomialNB"
           else ComplementNB(alpha=alpha, fit_prior=fit_prior))
    return Pipeline([("vec", vec), ("clf", clf)])


# PHP inference (config/sentiment_ml.php) currently implements exactly one
# thing: word-level count features + MultinomialNB. Anything else wins on
# paper but needs the PHP side updated before it can actually be deployed —
# flagged here so that cost is visible when choosing.
def php_ready(vec_kind, clf_kind):
    return vec_kind == "count_word" and clf_kind == "MultinomialNB"


configs = []
for clf_kind in ["MultinomialNB", "ComplementNB"]:
    for alpha in [0.1, 0.3, 0.5, 1.0]:
        for fit_prior in [True, False]:
            # word-level
            for vec_kind in ["count_word", "tfidf_word"]:
                for ngram in [(1, 1), (1, 2)]:
                    for stop in [None, TAGALOG_ENGLISH_STOPWORDS]:
                        configs.append((vec_kind, ngram, stop, 1, clf_kind, alpha, fit_prior))
            # character-level
            for vec_kind in ["count_char", "tfidf_char"]:
                for ngram in [(2, 4), (3, 5)]:
                    for min_df in [1, 2]:
                        configs.append((vec_kind, ngram, None, min_df, clf_kind, alpha, fit_prior))

print(f"Searching {len(configs)} configurations by 5-fold cross-validation...\n")

scored = []
for cfg in configs:
    vec_kind, ngram, stop, min_df, clf_kind, alpha, fit_prior = cfg
    try:
        cv = cross_val_score(build(*cfg), comments, labels, cv=5).mean()
    except Exception:
        continue
    scored.append((cv, cfg))

scored.sort(key=lambda t: -t[0])


def describe(cfg):
    vec_kind, ngram, stop, min_df, clf_kind, alpha, fit_prior = cfg
    s = f"{vec_kind} {ngram}"
    if stop is not None:
        s += " +stopwords"
    if min_df != 1:
        s += f" min_df={min_df}"
    s += f" | {clf_kind} alpha={alpha}"
    if not fit_prior:
        s += " uniform-prior"
    return s


print("Top configurations by cross-validation:\n")
for cv, cfg in scored[:TOP_N]:
    tag = "" if php_ready(cfg[0], cfg[4]) else "   [needs PHP inference update]"
    print(f"  {cv:.2%}  {describe(cfg)}{tag}")

# Current production configuration, as the thing to beat.
CURRENT = ("count_word", (1, 1), None, 1, "MultinomialNB", 0.1, True)

finalists = [cfg for _, cfg in scored[:TOP_N]]
if CURRENT not in finalists:
    finalists.append(CURRENT)

print(f"\nRe-scoring finalists on {N_REPEATS} identical held-out splits "
      f"(paired comparison)...\n")

splits = []
for seed in range(N_REPEATS):
    splits.append(train_test_split(comments, labels, test_size=0.2,
                                   random_state=seed, stratify=labels))

results, neutral_f1 = {}, {}
for cfg in finalists:
    accs, nf1 = [], []
    for txt_tr, txt_te, y_tr, y_te in splits:
        m = build(*cfg)
        m.fit(txt_tr, y_tr)
        pred = m.predict(txt_te)
        accs.append(accuracy_score(y_te, pred))
        rep = classification_report(y_te, pred, output_dict=True, zero_division=0)
        nf1.append(rep.get("Neutral", {}).get("f1-score", 0.0))
    results[describe(cfg)] = (np.array(accs), cfg)
    neutral_f1[describe(cfg)] = np.mean(nf1)

base_key = describe(CURRENT)
base = results[base_key][0]

print(f"{'configuration':<62} {'acc':>7} {'vs now':>8} {'NeutF1':>7}  paired W/T/L")
print("-" * 104)
for key, (arr, cfg) in sorted(results.items(), key=lambda kv: -kv[1][0].mean()):
    w = int((arr > base).sum())
    t = int((arr == base).sum())
    l = N_REPEATS - w - t
    delta = (arr.mean() - base.mean()) * 100
    mark = "  <-- current" if key == base_key else ""
    print(f"{key:<62} {arr.mean():>6.2%} {delta:>+7.2f} {neutral_f1[key]:>7.3f}  "
          f"{w:>2}/{t:>2}/{l:<2}{mark}")

best_key, (best_arr, best_cfg) = max(results.items(), key=lambda kv: kv[1][0].mean())
w = int((best_arr > base).sum())
margin = (best_arr.mean() - base.mean()) * 100

print("\n" + "=" * 70)
if best_key == base_key:
    print("VERDICT: nothing beat the current configuration. Keep it.")
elif margin >= 3.0 and w >= 20:
    print(f"VERDICT: adopt '{best_key}'.")
    print(f"  +{margin:.2f} points, and it wins on {w} of {N_REPEATS} paired splits —")
    print("  a consistent gap, not a lucky average.")
    if not php_ready(best_cfg[0], best_cfg[4]):
        print("  NOTE: config/sentiment_ml.php must be updated to match this")
        print("  feature/classifier type before it can be deployed.")
else:
    print(f"VERDICT: '{best_key}' leads by {margin:.2f} points "
          f"and wins {w}/{N_REPEATS} splits.")
    print("  That is NOT enough to adopt it. On 126 examples a 1-2 point average")
    print("  gap without a clear majority of paired wins is noise. Keeping the")
    print("  current configuration is the honest call — and the result worth")
    print("  reporting is that feature engineering did not overcome the data limit.")
print("=" * 70)
print(f"\nConfigurations searched: {len(scored)} (disclose this in the methodology).")
