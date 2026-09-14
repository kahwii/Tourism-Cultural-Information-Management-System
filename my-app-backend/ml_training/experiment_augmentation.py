"""
EXPERIMENT — does synthetic augmentation actually help on REAL data?

THE QUESTION
------------
We have 390 synthetic (AI-generated) examples from the first round, and 120
new ones written specifically to strengthen the Neutral class
(synthetic_data_v2.csv). Synthetic data is only ever allowed in TRAINING —
never in evaluation — so the honest way to find out whether it helps is:

    train three models that differ ONLY in what synthetic data they saw,
    then score all three on the SAME held-out slice of REAL reviews.

    A. real only                      (126 real examples)
    B. real + synthetic v1            (+390)
    C. real + synthetic v1 + v2       (+390 +120)

Every test set is real, human-labelled data. Synthetic rows are never scored
against. That is what makes the comparison meaningful: if C beats A on real
reviews, the augmentation genuinely taught the model something that transfers
to real visitor language, rather than just teaching it to recognise its own
generated phrasing.

WHY REPEATED SPLITS
-------------------
One 80/20 split of 126 examples leaves a 26-row test set — small enough that
a single result is mostly noise. Each condition is therefore evaluated over
30 different random splits and averaged. Crucially, all three conditions are
evaluated on the SAME 30 splits (same random seeds), so the comparison is
paired: any difference comes from the training data, not from luck of the
draw.

Run: python experiment_augmentation.py
This script does NOT write model_weights.json — it only measures.
"""

import csv
import os
import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

REAL_FILE = "training_data.csv"
SYN_V1 = "synthetic_data.csv"
SYN_V2 = "synthetic_data_v2.csv"
SYN_V3 = "synthetic_data_v3.csv"

# Settings chosen by train_sentiment.py's own grid search on the real data.
NGRAM = (1, 1)
ALPHA = 0.3
N_REPEATS = 30


def load(path):
    if not os.path.exists(path):
        return [], []
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    return [r["comment"] for r in rows], [r["label"] for r in rows]


real_X, real_y = load(REAL_FILE)
v1_X, v1_y = load(SYN_V1)
v2_X, v2_y = load(SYN_V2)
v3_X, v3_y = load(SYN_V3)

print(f"Real (human-labelled):        {len(real_X)}")
print(f"Synthetic v1:                 {len(v1_X)}")
print(f"Synthetic v2 (factual style): {len(v2_X)}")
print(f"Synthetic v3 (lukewarm style):{len(v3_X)}")
print(f"Class counts (real): { {c: real_y.count(c) for c in sorted(set(real_y))} }")

# v2 vs v3 is the interesting comparison: both add Neutral examples, but v2
# wrote Neutral as factual/logistical statements ("Nagpunta kami nung Linggo")
# while v3 wrote it the way real neutral reviews in this database actually
# sound — short lukewarm evaluations ("sakto lang, walang sobra walang
# kulang"). If style is what matters, D should beat C on real data.
CONDITIONS = {
    "A. real only":                ([], []),
    "B. real + syn v1":            (v1_X, v1_y),
    "C. real + syn v1 + v2":       (v1_X + v2_X, v1_y + v2_y),
    "D. real + syn v1 + v3":       (v1_X + v3_X, v1_y + v3_y),
    "E. real + syn v1 + v2 + v3":  (v1_X + v2_X + v3_X, v1_y + v2_y + v3_y),
}

results = {name: [] for name in CONDITIONS}
neutral_f1 = {name: [] for name in CONDITIONS}

for seed in range(N_REPEATS):
    # The split is over REAL data only, and is identical across conditions.
    Xtr_txt, Xte_txt, ytr, yte = train_test_split(
        real_X, real_y, test_size=0.2, random_state=seed, stratify=real_y
    )

    for name, (extra_X, extra_y) in CONDITIONS.items():
        train_txt = list(Xtr_txt) + list(extra_X)
        train_y = list(ytr) + list(extra_y)

        # Vectorizer is fit on training text only — the test rows are never
        # seen while building the vocabulary, which would leak information.
        vec = CountVectorizer(lowercase=True, ngram_range=NGRAM)
        Xtr = vec.fit_transform(train_txt)
        Xte = vec.transform(Xte_txt)

        model = MultinomialNB(alpha=ALPHA)
        model.fit(Xtr, np.array(train_y))
        pred = model.predict(Xte)

        results[name].append(accuracy_score(yte, pred))

        rep = classification_report(yte, pred, output_dict=True, zero_division=0)
        neutral_f1[name].append(rep.get("Neutral", {}).get("f1-score", 0.0))

print(f"\n=== Accuracy on REAL held-out reviews, averaged over {N_REPEATS} identical splits ===\n")
base = np.mean(results["A. real only"])
for name in CONDITIONS:
    arr = np.array(results[name])
    delta = arr.mean() - base
    sign = "+" if delta >= 0 else ""
    print(f"{name:<30} {arr.mean():.2%}   (min {arr.min():.0%}, max {arr.max():.0%})"
          f"   {sign}{delta*100:.2f} pts vs A")

print(f"\n=== Neutral-class F1 on the same splits (the class we were targeting) ===\n")
base_n = np.mean(neutral_f1["A. real only"])
for name in CONDITIONS:
    arr = np.array(neutral_f1[name])
    delta = arr.mean() - base_n
    sign = "+" if delta >= 0 else ""
    print(f"{name:<30} {arr.mean():.3f}   {sign}{delta:.3f} vs A")

# Paired comparison against the real-only baseline, split by split.
a = np.array(results["A. real only"])
print(f"\nPaired results across the {N_REPEATS} identical splits (vs A):\n")
for name in CONDITIONS:
    if name.startswith("A."):
        continue
    arr = np.array(results[name])
    wins = int((arr > a).sum())
    ties = int((arr == a).sum())
    print(f"{name:<30} better on {wins:>2}, tied on {ties:>2}, worse on {N_REPEATS - wins - ties:>2}")
print("\nA difference of only 1-2 points on a test set this small is noise, not")
print("an improvement. Look for a consistent gap plus a clear majority of")
print("paired wins before treating the augmentation as a real gain.")
