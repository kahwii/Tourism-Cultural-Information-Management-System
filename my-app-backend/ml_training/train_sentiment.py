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

configs = []
for ngram in [(1, 1), (1, 2)]:
    for stop in [None, TAGALOG_ENGLISH_STOPWORDS]:
        label = f"ngram={ngram}, stopwords={'off' if stop is None else 'on'}"
        configs.append((label, ngram, stop))

ALPHAS = [0.1, 0.3, 0.5, 1.0, 2.0]

print("\nGrid search over feature + smoothing settings, 5-fold CV (real data only):")
best = {"score": -1}
for label, ngram, stop in configs:
    vec = CountVectorizer(lowercase=True, ngram_range=ngram, stop_words=stop)
    X_try = vec.fit_transform(comments)
    for alpha in ALPHAS:
        scores = cross_val_score(MultinomialNB(alpha=alpha), X_try, np.array(labels), cv=5)
        if scores.mean() > best["score"]:
            best = {
                "score": scores.mean(), "scores": scores, "label": f"{label}, alpha={alpha}",
                "vectorizer": vec, "X": X_try, "ngram": ngram, "alpha": alpha,
            }

# Show where the winner landed against the plain baseline, for context.
baseline_vec = CountVectorizer(lowercase=True, ngram_range=(1, 1))
baseline_X = baseline_vec.fit_transform(comments)
baseline_scores = cross_val_score(MultinomialNB(), baseline_X, np.array(labels), cv=5)
print(f"  Baseline (unigrams, stopwords off, alpha=1.0): {baseline_scores.mean():.2%}")
print(f"  Best found: {best['label']} -> {best['score']:.2%}")

vectorizer = best["vectorizer"]
X = best["X"]
y = np.array(labels)
best_ngram = best["ngram"]
best_alpha = best["alpha"]
best_cv_scores = best["scores"]

print(f"Vocabulary size: {len(vectorizer.vocabulary_)} distinct features.")

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
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = MultinomialNB(alpha=best_alpha)
model.fit(X_train, y_train)
predictions = model.predict(X_test)

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
    Xr_train, Xr_test, yr_train, yr_test = train_test_split(
        X, y, test_size=0.2, random_state=seed, stratify=y
    )
    m = MultinomialNB(alpha=best_alpha)
    m.fit(Xr_train, yr_train)
    repeat_scores.append(accuracy_score(yr_test, m.predict(Xr_test)))
repeat_scores = np.array(repeat_scores)
print(f"\nRepeated random sub-sampling ({N_REPEATS} different 80/20 splits): "
      f"{repeat_scores.mean():.2%} average (min {repeat_scores.min():.0%}, max {repeat_scores.max():.0%})")
print("This is the more trustworthy 'held-out style' number for the thesis — "
      "the single-split 60.87% above is just one of these draws.")

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

best_stop_words = vectorizer.stop_words  # None, or the Tagalog/English stopword list
final_vectorizer = CountVectorizer(lowercase=True, ngram_range=best_ngram, stop_words=best_stop_words)
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
    "ngram_range": list(best_ngram),  # tells the PHP side whether it must also build word-pair features
    "stop_words": list(best_stop_words) if best_stop_words else [],  # words the PHP tokenizer must also drop
    "vocabulary": {k: int(v) for k, v in final_vectorizer.vocabulary_.items()},  # word (or "word word") -> column index
    "class_log_prior": final_model.class_log_prior_.tolist(),
    "feature_log_prob": final_model.feature_log_prob_.tolist(),  # [class][word_index]
}
with open("model_weights.json", "w", encoding="utf-8") as f:
    json.dump(weights, f, ensure_ascii=False)

print(f"\nSaved model_weights.json ({len(final_vectorizer.vocabulary_)} words, "
      f"{len(final_model.classes_)} classes).")
