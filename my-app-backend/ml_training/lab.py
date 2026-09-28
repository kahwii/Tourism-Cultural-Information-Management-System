"""Pure-python replication of the TCIMS char_wb + MultinomialNB pipeline.
No sklearn in this sandbox, so the pieces are implemented directly.
"""
import csv, math, random, re, os
from collections import Counter, defaultdict

WS = re.compile(r"\s\s+")

def char_wb(text, lo=3, hi=5):
    text = WS.sub(" ", text.lower())
    out = []
    for w in text.split():
        w = " " + w + " "
        L = len(w)
        for n in range(lo, hi+1):
            off = 0
            out.append(w[off:off+n])
            while off + n < L:
                off += 1
                out.append(w[off:off+n])
            if off == 0:
                break
    return out

def word_ngrams(text, lo=1, hi=1):
    toks = re.findall(r"(?u)\b\w\w+\b", text.lower())
    out = list(toks) if lo == 1 else []
    for n in range(max(lo,2), hi+1):
        out += [" ".join(toks[i:i+n]) for i in range(len(toks)-n+1)]
    return out

def featurize(text, kind):
    if kind[0] == "char":  return char_wb(text, kind[1], kind[2])
    if kind[0] == "word":  return word_ngrams(text, kind[1], kind[2])
    if kind[0] == "union": return char_wb(text, 3, 5) + ["W::"+t for t in word_ngrams(text,1,1)]
    raise ValueError(kind)

class NB:
    """MultinomialNB, same maths as sklearn (fit_prior default True)."""
    def __init__(self, alpha=0.1, fit_prior=True):
        self.alpha, self.fit_prior = alpha, fit_prior
    def fit(self, docs, ys):
        self.classes = sorted(set(ys))
        vocab = set()
        for d in docs: vocab.update(d)
        self.vocab = {f:i for i,f in enumerate(sorted(vocab))}
        V = len(self.vocab)
        cnt = {c: Counter() for c in self.classes}
        n   = Counter(ys)
        for d, y in zip(docs, ys):
            cnt[y].update(f for f in d if f in self.vocab)
        self.logprob = {}
        for c in self.classes:
            tot = sum(cnt[c].values()) + self.alpha * V
            self.logprob[c] = (defaultdict(lambda: math.log(self.alpha/tot) if tot else 0.0),
                               math.log(self.alpha/tot))
            d = {}
            for f, k in cnt[c].items():
                d[f] = math.log((k + self.alpha)/tot)
            self.logprob[c] = (d, math.log(self.alpha/tot))
        N = len(ys)
        self.prior = {c: (math.log(n[c]/N) if self.fit_prior else math.log(1/len(self.classes)))
                      for c in self.classes}
        return self
    def predict_one(self, doc):
        best, bs = None, None
        feats = Counter(f for f in doc if f in self.vocab)
        for c in self.classes:
            d, default = self.logprob[c]
            s = self.prior[c]
            for f, k in feats.items():
                s += k * d.get(f, default)
            if bs is None or s > bs: bs, best = s, c
        return best
    def predict(self, docs): return [self.predict_one(d) for d in docs]

def stratified_splits(ys, n_splits=30, test_size=0.2, seed0=0):
    by = defaultdict(list)
    for i, y in enumerate(ys): by[y].append(i)
    for s in range(n_splits):
        rng = random.Random(1000 + s)
        train, test = [], []
        for c, idx in sorted(by.items()):
            idx = idx[:]; rng.shuffle(idx)
            k = max(1, round(len(idx)*test_size))
            test += idx[:k]; train += idx[k:]
        yield train, test

def macro_f1(gold, pred, classes):
    f1s = []
    for c in classes:
        tp = sum(1 for g,p in zip(gold,pred) if g==c and p==c)
        fp = sum(1 for g,p in zip(gold,pred) if g!=c and p==c)
        fn = sum(1 for g,p in zip(gold,pred) if g==c and p!=c)
        pr = tp/(tp+fp) if tp+fp else 0.0
        rc = tp/(tp+fn) if tp+fn else 0.0
        f1s.append(2*pr*rc/(pr+rc) if pr+rc else 0.0)
    return sum(f1s)/len(f1s), dict(zip(classes, f1s))

def load(path, text_col="comment", label_col="label"):
    rows = []
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            t = (r.get(text_col) or "").strip()
            y = (r.get(label_col) or r.get("sentiment") or "").strip()
            if t and y: rows.append((t, y))
    return rows

def evaluate(rows, kind=("char",3,5), alpha=0.1, fit_prior=True, extra=None, n_splits=30):
    texts = [t for t,_ in rows]; ys = [y for _,y in rows]
    classes = sorted(set(ys))
    accs, f1s, per_split = [], [], []
    for train, test in stratified_splits(ys, n_splits):
        dtr = [featurize(texts[i], kind) for i in train]
        ytr = [ys[i] for i in train]
        if extra:
            dtr += [featurize(t, kind) for t,_ in extra]
            ytr += [y for _,y in extra]
        m = NB(alpha, fit_prior).fit(dtr, ytr)
        dte = [featurize(texts[i], kind) for i in test]
        yte = [ys[i] for i in test]
        pred = m.predict(dte)
        a = sum(1 for g,p in zip(yte,pred) if g==p)/len(yte)
        mf, per = macro_f1(yte, pred, classes)
        accs.append(a); f1s.append(mf); per_split.append((a, per))
    return {"acc": sum(accs)/len(accs), "min": min(accs), "max": max(accs),
            "macro_f1": sum(f1s)/len(f1s), "accs": accs,
            "neutral_f1": sum(p.get("Neutral",0) for _,p in per_split)/len(per_split)}
