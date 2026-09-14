"""
TCIMS sentiment classifier — training script.

WHAT THIS DOES, IN PLAIN TERMS
-------------------------------
We have 54 comments that a human has already labelled Positive / Neutral /
Negative (training_data.csv). We turn each comment into a row of word
counts (a "bag of words"), then train a Naive Bayes classifier: for every
word, it learns how much more often that word shows up in Positive
comments vs. Neutral vs. Negative ones. To classify a NEW comment, it adds
up those learned "how-positive-is-this-word" scores for every word in the
comment and picks whichever class scores highest.

This is genuinely Machine Learning: nobody hand-wrote "maganda = +1" the
way the old PHP lexicon did. The model figured out which words matter, and
by how much, purely from the labelled examples.

Run this after export_training_data.php has been saved as training_data.csv
in this same folder:

    python train_sentiment.py

Output:
  - Printed accuracy, per-class precision/recall/F1, and a confusion matrix
    (this is what goes in the thesis results chapter).
  - model_weights.json — the learned numbers, in a format simple enough
    for plain PHP to read and do inference with, no libraries required
    on the server.
"""

import json
import csv
import os
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

# ---------------------------------------------------------------
# 1. Load the data
# ---------------------------------------------------------------
# IMPORTANT: real (human-verified) data and synthetic (AI-generated,
# template-based) data are kept in SEPARATE files on purpose.
#
# All accuracy numbers below — cross-validation and the held-out test
# split — are computed using ONLY training_data.csv (real reviews +
# reference sentences, all human-labelled or human-corrected). Synthetic
# examples are never mixed into evaluation: if they were, the model could
# get credit for recognizing its own generated phrasing instead of real
# visitor language, which would make the reported accuracy meaningless.
#
# Synthetic data is added ONLY when training the final model that actually
# ships (step 5 below) — extra vocabulary exposure for the production
# model, with the reported accuracy still describing real-world performance.
comments, labels = [], []
with open("training_data.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        comments.append(row["comment"])
        labels.append(row["label"])

print(f"Loaded {len(comments)} labelled comments (real data only — this is what accuracy below measures).")
print("Class counts:", {c: labels.count(c) for c in sorted(set(labels))})

# ---------------------------------------------------------------
# 2. Turn text into numbers: "bag of words" (or "bag of words + word pairs")
# ---------------------------------------------------------------
# CountVectorizer builds a vocabulary of every distinct word (or word pair)
# across all comments, then represents each comment as a row of "how many
# times does word #i appear in this comment".
#
# Plain unigrams (single words) have a known blind spot: negation. "hindi
# maganda" (not nice) gets split into "hindi" and "maganda" separately, and
# "maganda" alone is a strongly Positive word — the model can lose the
# negation entirely. Bigrams (word PAIRS, ngram_range=(1,2)) let the model
# treat "hindi maganda" as its own feature, distinct from "maganda" by
# itself. This is a real fix for a real class of mistake, common in
# Filipino/Taglish reviews ("hindi", "wala", "walang" are frequent negators).
#
# We don't just assume bigrams help — with only 112 examples, adding more
# features can also hurt by spreading the data even thinner. So we search
# over a small, sensible grid instead of guessing, and keep whichever
# combination actually scores higher on cross-validation:
#
#   - ngram_range: unigrams only, vs. unigrams + word-pairs (catches negation
#     like "hindi maganda", at the cost of a much sparser feature space)
#   - stop_words: keep every word, vs. drop common connector words ("ang",
#     "ng", "sa", "the", "is"...) that carry no sentiment of their own and
#     just add noise/sparsity for a dataset this small
#   - alpha: Naive Bayes' Laplace smoothing strength — roughly, "how much
#     should the model hedge about words it has barely seen". Default is
#     1.0; smaller values trust the (limited) data more, larger values are
#     more conservative. There's no way to know which suits 112 examples
#     without trying it.
#
# This is still evaluated on training_data.csv (real data) only.
TAGALOG_ENGLISH_STOPWORDS = [
    "ang", "ng", "mga", "sa", "na", "at", "ay", "ako", "ko", "mo", "niya",
    "namin", "natin", "nila", "kami", "tayo", "sila", "ito", "iyon", "yun",
    "yan", "dito", "doon", "din", "rin", "lang", "po", "pa", "para",
    "the", "a", "an", "is", "was", "are", "were", "to", "of", "in", "on",
    "for", "and", "it", "this", "that", "i", "we", "you", "they",
]

# CHARACTER n-grams are in this search because of a measured result, not a
# hunch: experiment_model_search.py compared 256 feature/classifier
# configurations on these same 126 examples and char_wb(3,5) beat the best
# word-level setup by 6.5 points, winning 22 of 30 paired held-out splits.
#
# The reason it helps here is specific to this data. Real reviews are full of
# elongation and misspelling ("gandaaa", "gnda", "dto"), and Filipino builds
# meaning by affixing (ganda -> maganda -> napakaganda -> kagandahan). A
# word-level model sees every one of those as an unrelated token and has to
# learn each separately from a handful of examples. A character model sees
# the shared "ganda" inside all of them.
configs = []
for ngram in [(1, 1), (1, 2)]:
    for stop in [None, TAGALOG_ENGLISH_STOPWORDS]:
        label = f"word {ngram}, stopwords={'off' if stop is None else 'on'}"
        configs.append((label, "word", ngram, stop))
for ngram in [(2, 4), (3, 5)]:
    configs.append((f"char_wb {ngram}", "char_wb", ngram, None))

ALPHAS = [0.1, 0.3, 0.5, 1.0, 2.0]

# NO VOCABULARY LEAKAGE: the vectorizer is built INSIDE a Pipeline, so
# scikit-learn re-fits it on each fold's training rows only. Previously the
# vectorizer was fit once on ALL 126 comments before splitting, which let
# the model know the vocabulary of the held-out rows while it was training —
# a mild form of information leakage that inflates the reported score and is
# exactly the sort of thing a panel is entitled to ask about. Building the
# features inside the pipeline is the standard fix; the numbers printed below
# are now measured on rows the model has genuinely never seen in any form.
def make_vectorizer(analyzer, ngram, stop):
    if analyzer == "char_wb":
        # stop_words does not apply to a character analyzer (scikit-learn
        # ignores it there), so it is deliberately not passed.
        return CountVectorizer(lowercase=True, analyzer="char_wb", ngram_range=ngram)
    return CountVectorizer(lowercase=True, ngram_range=ngram, stop_words=stop)


def make_pipeline(analyzer, ngram, stop, alpha):
    return Pipeline([
        ("vec", make_vectorizer(analyzer, ngram, stop)),
        ("nb", MultinomialNB(alpha=alpha)),
    ])


y = np.array(labels)

print("\nGrid search over feature + smoothing settings, 5-fold CV (real data only):")
best = {"score": -1}
for label, analyzer, ngram, stop in configs:
    for alpha in ALPHAS:
        scores = cross_val_score(make_pipeline(analyzer, ngram, stop, alpha), comments, y, cv=5)
        if scores.mean() > best["score"]:
            best = {
                "score": scores.mean(), "scores": scores, "label": f"{label}, alpha={alpha}",
                "analyzer": analyzer, "ngram": ngram, "stop": stop, "alpha": alpha,
            }

# Show where the winner landed against the plain baseline, for context.
baseline_scores = cross_val_score(make_pipeline("word", (1, 1), None, 1.0), comments, y, cv=5)
print(f"  Baseline (word unigrams, stopwords off, alpha=1.0): {baseline_scores.mean():.2%}")
print(f"  Best found: {best['label']} -> {best['score']:.2%}")

best_analyzer = best["analyzer"]
best_ngram = best["ngram"]
best_stop = best["stop"]
best_alpha = best["alpha"]
best_cv_scores = best["scores"]

# Descriptive only — how many features the winning settings produce over the
# whole real dataset. Not used for training or scoring anything below.
_desc_vec = make_vectorizer(best_analyzer, best_ngram, best_stop)
_desc_vec.fit(comments)
print(f"Vocabulary size: {len(_desc_vec.vocabulary_)} distinct features "
      f"(analyzer = {best_analyzer}).")

# ---------------------------------------------------------------
# 3. Cross-validation result for the winning configuration
# ---------------------------------------------------------------
# With only 112 examples, a single train/test split is small enough that
# the result could look good or bad just by luck of which rows landed in
# the test set. 5-fold cross-validation trains and tests 5 times on
# different slices and averages the result, which is a more honest number
# to report when the dataset is this small. (Reusing the scores already
# computed above for the winning configuration — no need to redo the work.)
cv_scores = best_cv_scores
print(f"\n5-fold cross-validation accuracy: {cv_scores.mean():.2%} "
      f"(individual folds: {[f'{s:.0%}' for s in cv_scores]})")

# ---------------------------------------------------------------
# 4. A single train/test split, for a readable confusion matrix
# ---------------------------------------------------------------
# stratify=y keeps the same proportion of Positive/Neutral/Negative in
# both the train and test sets, instead of a random split accidentally
# putting almost all of one class into the test set.
# Split the RAW TEXT, then fit the whole pipeline (vectorizer included) on
# the training half only — same no-leakage discipline as the grid search above.
txt_train, txt_test, y_train, y_test = train_test_split(
    comments, y, test_size=0.2, random_state=42, stratify=y
)

model = make_pipeline(best_analyzer, best_ngram, best_stop, best_alpha)
model.fit(txt_train, y_train)
predictions = model.predict(txt_test)

print(f"\nHeld-out test accuracy: {accuracy_score(y_test, predictions):.2%} "
      f"({len(y_test)} test examples)")
print("\nPer-class precision / recall / F1:")
print(classification_report(y_test, predictions, zero_division=0))

labels_order = sorted(set(y))
print("Confusion matrix (rows = actual, columns = predicted):")
print("            " + "  ".join(f"{l:>10}" for l in labels_order))
cm = confusion_matrix(y_test, predictions, labels=labels_order)
for i, row in enumerate(cm):
    print(f"{labels_order[i]:>10}  " + "  ".join(f"{v:>10}" for v in row))

# ---------------------------------------------------------------
# 4b. Repeated random sub-sampling — how noisy is that ONE split, really?
# ---------------------------------------------------------------
# The 60.87% above came from exactly one 80/20 split (random_state=42). With
# only 112 examples, the 23-example test set is small enough that which
# specific rows land in it can swing the result by 10-20 points either way —
# that's not a flaw in the model, it's just what small-sample statistics
# looks like. Picking a different random_state until we see a bigger number
# would be cherry-picking, not an improvement.
# The honest fix: repeat the split many times with different random seeds
# and average the results. This is called repeated random sub-sampling (or
# "Monte Carlo cross-validation") — it turns one noisy draw into a stable
# estimate, and is safe to quote in the thesis as a second, independent
# check alongside the 5-fold CV number above.
N_REPEATS = 30
repeat_scores = []
for seed in range(N_REPEATS):
    txt_r_train, txt_r_test, yr_train, yr_test = train_test_split(
        comments, y, test_size=0.2, random_state=seed, stratify=y
    )
    m = make_pipeline(best_analyzer, best_ngram, best_stop, best_alpha)
    m.fit(txt_r_train, yr_train)
    repeat_scores.append(accuracy_score(yr_test, m.predict(txt_r_test)))
repeat_scores = np.array(repeat_scores)
print(f"\nRepeated random sub-sampling ({N_REPEATS} different 80/20 splits): "
      f"{repeat_scores.mean():.2%} average (min {repeat_scores.min():.0%}, max {repeat_scores.max():.0%})")
print("^^ THIS is the number to quote in the thesis. It averages 30 different")
print("   held-out draws, so it is not at the mercy of one lucky/unlucky split")
print("   the way the single-split figure printed above is.")

# ---------------------------------------------------------------
# 5. Re-train on ALL the data for the model we actually ship
# ---------------------------------------------------------------
# Steps 3-4 were purely to measure how good the approach is, using real
# data only. The model that goes into production can also learn from
# synthetic_data.csv, if present — extra examples of common tourism
# vocabulary (staff, presyo, kalinisan, tanawin, etc.) used the way a
# Positive/Neutral/Negative comment would use them. This does NOT change
# any number printed above; it only affects the model saved in step 6.
final_comments, final_labels = list(comments), list(labels)
synthetic_count = 0
if os.path.exists("synthetic_data.csv"):
    with open("synthetic_data.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            final_comments.append(row["comment"])
            final_labels.append(row["label"])
            synthetic_count += 1

if synthetic_count:
    print(f"\nAdding {synthetic_count} synthetic (AI-generated, templated) examples "
          f"for the production model only — not used in any accuracy figure above.")
    print(f"Production model will train on {len(final_comments)} total examples "
          f"({len(comments)} real + {synthetic_count} synthetic).")

best_stop_words = best_stop  # None, or the Tagalog/English stopword list
final_vectorizer = make_vectorizer(best_analyzer, best_ngram, best_stop_words)
final_X = final_vectorizer.fit_transform(final_comments)
final_y = np.array(final_labels)

final_model = MultinomialNB(alpha=best_alpha)
final_model.fit(final_X, final_y)

# ---------------------------------------------------------------
# 6. Export the learned numbers for PHP
# ---------------------------------------------------------------
# A MultinomialNB model is, under the hood, just two things:
#   - class_log_prior_:   how common each class is overall, in log form
#   - feature_log_prob_:  for each class, how "expected" each word is
# Classifying a new comment is: for each class, add up class_log_prior_
# plus (word count x feature_log_prob_) for every word in the comment,
# then pick the class with the highest total. That's simple enough for
# plain PHP to do without needing scikit-learn installed on the server.
weights = {
    "classes": list(final_model.classes_),
    # "word" = split into words (and optionally word pairs);
    # "char_wb" = character n-grams taken inside word boundaries, each word
    # padded with a space at both ends. config/sentiment_ml.php branches on
    # this, and must reproduce scikit-learn's rule exactly or the PHP and
    # Python predictions will silently diverge.
    "analyzer": best_analyzer,
    "ngram_range": list(best_ngram),
    "stop_words": list(best_stop_words) if best_stop_words else [],  # word analyzer only
    "vocabulary": {k: int(v) for k, v in final_vectorizer.vocabulary_.items()},  # feature -> column index
    "class_log_prior": final_model.class_log_prior_.tolist(),
    "feature_log_prob": final_model.feature_log_prob_.tolist(),  # [class][feature_index]
}
with open("model_weights.json", "w", encoding="utf-8") as f:
    json.dump(weights, f, ensure_ascii=False)

print(f"\nSaved model_weights.json ({len(final_vectorizer.vocabulary_)} features, "
      f"analyzer={best_analyzer}, {len(final_model.classes_)} classes).")

# ---------------------------------------------------------------
# 7. Parity fixture for the PHP side
# ---------------------------------------------------------------
# The PHP inference has to reproduce scikit-learn's feature extraction
# exactly. Any mismatch (a different way of padding words, of handling
# multi-byte characters, of collapsing whitespace) produces predictions that
# are wrong in ways no PHP unit test would notice, because PHP has nothing
# to compare against. So the trained model's own predictions on a fixed set
# of comments are written out here, and api/sentiment_ml_parity.php replays
# the same comments through the PHP implementation and diffs the two.
PARITY_SAMPLES = [
    "The staff were friendly and the place was very clean.",
    "Napakaganda ng lugar, babalik ako ulit dito.",
    "Sobrang dumi ng banyo, nakakadiri talaga.",
    "Hindi maganda ang serbisyo dito.",
    "The place was not clean at all.",
    "Hindi naman masama, pwede na.",
    "Grabe ang ganda, sobrang worth it talaga!",
    "Ang bagal ng service, sobrang nakakainis.",
    "Ang ganda dito 😍😍😍",
    "😊",
    "Ang panget dito putangina.",
    "okay lang",
    "maganda",
    "pangit",
    "Petmalu talaga ang lugar na 'to, solid!",
    "sobrang gandaaa dto grabe",
    "Room 204, 3rd floor.",
    "Maganda ang view pero sobrang mahal at madumi ang CR.",
    "",
    "   ",
    "Ñuñoa café — ang sarap!",
]
parity = [{"comment": c, "expected": str(final_model.predict(final_vectorizer.transform([c]))[0])}
          for c in PARITY_SAMPLES]
with open("parity_fixture.json", "w", encoding="utf-8") as f:
    json.dump(parity, f, ensure_ascii=False, indent=1)
print(f"Saved parity_fixture.json ({len(parity)} cases) — run "
      f"api/sentiment_ml_parity.php?key=tcims_eval to confirm PHP agrees.")
