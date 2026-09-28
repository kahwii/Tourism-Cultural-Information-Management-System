"""
Does synthetic augmentation help? — re-run under CHARACTER features.

WHY THIS EXISTS
---------------
experiment_augmentation.py answered this question once already, and the answer
was no: every synthetic condition either failed to beat real-data-only or won
on average while losing more paired splits than it won.

That experiment was run while the model used WORD features. The model has
since moved to character n-grams (see experiment_model_search.py), and the
conclusion does not survive the change — augmentation that was worthless to a
word model is worth several points to a character model.

The reason is specific and worth stating in the paper rather than filing as a
tuning detail. A word model can only use a synthetic sentence if the exact
tokens in it recur in real reviews, and templated sentences mostly repeat each
other's phrasing. A character model breaks every sentence into overlapping
3-5 character fragments, so a synthetic row still teaches it the shape of
Filipino affixes and the spelling of tourism vocabulary even when the sentence
as a whole sounds nothing like a real review.

The practical lesson is that "does augmentation help?" is not a question with
a permanent answer — it is a question about a particular pairing of data and
feature representation, and it has to be re-asked when either one changes.

METHOD
------
Conditions differ ONLY in which synthetic files are added to training. Every
condition is scored on the SAME 30 held-out splits of real reviews, and no
synthetic row is ever scored against. Differences are reported as paired
win/tie/loss across those 30 splits as well as on average, because an average
can be moved by one lucky draw and a paired count cannot.

    python experiment_augmentation_v2.py
"""

import csv
import os

import numpy as np
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

N_SPLITS = 30
NGRAM = (3, 5)
ALPHA = 0.05


def load(path, required=True):
    if not os.path.exists(path):
        if required:
            raise SystemExit(f"missing {path}")
        return [], []
    texts, labels = [], []
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            t = (row.get("comment") or "").strip()
            y = (row.get("label") or row.get("sentiment") or "").strip()
            if t and y:
                texts.append(t)
                labels.append(y)
    return texts, labels


real_x, real_y = load("training_data.csv")
v1 = load("synthetic_data.csv", required=False)
v2 = load("synthetic_data_v2.csv", required=False)
v3 = load("synthetic_data_v3.csv", required=False)
v4 = load("synthetic_data_v4.csv", required=False)

real_y = np.array(real_y)
print(f"{len(real_x)} real rows | v1={len(v1[0])} v2={len(v2[0])} v3={len(v3[0])} v4={len(v4[0])}")
print(f"char_wb{NGRAM}, MultinomialNB(alpha={ALPHA}), {N_SPLITS} paired splits\n")


def combine(*sets):
    x, y = [], []
    for sx, sy in sets:
        x += list(sx)
        y += list(sy)
    return x, y


def run(extra):
    """Accuracy and Neutral F1 per split, for one augmentation condition."""
    accs, neutral = [], []
    for seed in range(N_SPLITS):
        x_tr, x_te, y_tr, y_te = train_test_split(
            real_x, real_y, test_size=0.2, random_state=seed, stratify=real_y
        )
        ex_x, ex_y = extra if extra else ([], [])
        pipe = Pipeline([
            ("vec", CountVectorizer(lowercase=True, analyzer="char_wb", ngram_range=NGRAM)),
            ("nb", MultinomialNB(alpha=ALPHA)),
        ])
        pipe.fit(list(x_tr) + list(ex_x), np.array(list(y_tr) + list(ex_y)))
        pred = pipe.predict(x_te)
        accs.append(accuracy_score(y_te, pred))
        neutral.append(f1_score(y_te, pred, labels=["Neutral"], average="macro", zero_division=0))
    return np.array(accs), float(np.mean(neutral))


conditions = [
    ("A. real only", None),
    ("B. + v1", v1),
    ("C. + v1 + v2", combine(v1, v2)),
    ("D. + v1 + v2 + v3", combine(v1, v2, v3)),
    ("E. + v1 + v2 + v4", combine(v1, v2, v4)),
    ("F. + v1 + v2 + v3 + v4", combine(v1, v2, v3, v4)),
]

base_acc, base_neutral = run(None)
print(f"{'condition':26s} {'accuracy':>9s} {'vs A':>7s} {'W/T/L':>10s} {'NeutralF1':>10s}")
for name, extra in conditions:
    acc, neutral = run(extra)
    w = int((acc > base_acc).sum())
    t = int((acc == base_acc).sum())
    l = int((acc < base_acc).sum())
    print(f"{name:26s} {acc.mean():8.2%} {acc.mean() - base_acc.mean():+7.2%} "
          f"{w:3d}/{t:2d}/{l:2d}   {neutral:9.3f}")

print("""
READING THIS TABLE

The adoption bar, set before running: at least +3 points AND wins on at least
20 of the 30 paired splits. A condition that clears the average but not the
paired count has not been shown to be better — it has been shown to be lucky.

v3 and v4 are in the table because they failed. Both were written to add
Neutral coverage, the class the model is weakest on, and both made the model
worse. That is worth reporting: it is evidence that the gain from v2 comes
from something other than sheer volume, and it is the kind of result that
quietly disappears from papers when only successful experiments are kept.
""")
