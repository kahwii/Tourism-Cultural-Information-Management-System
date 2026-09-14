"""
DIAGNOSTIC ONLY — does not touch model_weights.json or change what's deployed.

Question being answered: "how much of our low accuracy is because of the
Neutral class specifically?" Neutral only has 28 of our 126 real examples
(vs 54 Negative, 44 Positive), and the 3-class confusion matrix consistently
shows Neutral as the weakest class (lowest precision/recall). This script
drops every Neutral row and retrains the SAME way (grid search + 5-fold CV +
repeated random sub-sampling) on the Positive/Negative rows only, so we can
compare the binary ceiling against the 3-class number honestly.

This does NOT mean we're switching the product to binary — Positive/Neutral/
Negative is what the lexicon, the dashboard, and the reward/reporting logic
all expect. This is purely diagnostic, to decide where effort is best spent
next (more Neutral examples specifically? or is 3-class just inherently
harder regardless of balance?).

Run: python diagnostic_binary.py
"""

import csv
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

comments, labels = [], []
with open("training_data.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row["label"] == "Neutral":
            continue
        comments.append(row["comment"])
        labels.append(row["label"])

print(f"Loaded {len(comments)} Positive/Negative-only examples (Neutral rows dropped).")
print("Class counts:", {c: labels.count(c) for c in sorted(set(labels))})

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
        configs.append((f"ngram={ngram}, stopwords={'off' if stop is None else 'on'}", ngram, stop))

ALPHAS = [0.1, 0.3, 0.5, 1.0, 2.0]

print("\nGrid search, 5-fold CV (binary, real data only):")
best = {"score": -1}
for label, ngram, stop in configs:
    vec = CountVectorizer(lowercase=True, ngram_range=ngram, stop_words=stop)
    X_try = vec.fit_transform(comments)
    for alpha in ALPHAS:
        scores = cross_val_score(MultinomialNB(alpha=alpha), X_try, np.array(labels), cv=5)
        if scores.mean() > best["score"]:
            best = {"score": scores.mean(), "scores": scores, "label": f"{label}, alpha={alpha}",
                    "vectorizer": vec, "X": X_try}

print(f"  Best found: {best['label']} -> {best['score']:.2%}")
X, y = best["X"], np.array(labels)
print(f"\n5-fold cross-validation accuracy (binary): {best['score']:.2%} "
      f"(individual folds: {[f'{s:.0%}' for s in best['scores']]})")

alpha = float(best["label"].split("alpha=")[1])
N_REPEATS = 30
repeat_scores = []
for seed in range(N_REPEATS):
    Xr_train, Xr_test, yr_train, yr_test = train_test_split(X, y, test_size=0.2, random_state=seed, stratify=y)
    m = MultinomialNB(alpha=alpha)
    m.fit(Xr_train, yr_train)
    repeat_scores.append(accuracy_score(yr_test, m.predict(Xr_test)))
repeat_scores = np.array(repeat_scores)
print(f"\nRepeated random sub-sampling ({N_REPEATS} splits), BINARY: "
      f"{repeat_scores.mean():.2%} average (min {repeat_scores.min():.0%}, max {repeat_scores.max():.0%})")

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
model = MultinomialNB(alpha=alpha)
model.fit(X_train, y_train)
predictions = model.predict(X_test)
print(f"\nSingle held-out split accuracy: {accuracy_score(y_test, predictions):.2%} ({len(y_test)} test examples)")
print(classification_report(y_test, predictions, zero_division=0))
print("Confusion matrix:")
labels_order = sorted(set(y))
print("            " + "  ".join(f"{l:>10}" for l in labels_order))
cm = confusion_matrix(y_test, predictions, labels=labels_order)
for i, row in enumerate(cm):
    print(f"{labels_order[i]:>10}  " + "  ".join(f"{v:>10}" for v in row))

print("\n=== Compare this 'Repeated random sub-sampling' number to the 66.03% ===")
print("=== 3-class number from train_sentiment.py to see how much Neutral costs us. ===")
