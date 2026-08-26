# Sentiment ML — scaling plan

Written for a simple question: the system launches, tourists start leaving
real feedback, and over months/years the `reviews` table grows from ~150
rows (today) to 10,000, then eventually 50,000+. What changes, and what has
to be prepared in advance so nothing breaks?

Short answer: the sentiment classifier does not break or slow down at that
scale — Naive Bayes classification and even retraining stay fast at tens of
thousands of rows. What actually needs attention is (a) how you get labels
at that volume, (b) how retraining is run responsibly, and (c) a couple of
unrelated infrastructure limits (pagination, spam protection) that would
bite first, before the ML model ever does.

## 1. Labeling can't stay fully manual

Hand-labelling 50,000 comments is not realistic for two researchers. The
approach that scales is **weak supervision / active learning**:

1. Run the existing lexicon (`config/sentiment.php`, ~93% accuracy on the
   blind test set) over all new reviews automatically — this is already
   happening today, since every review gets scored on submission.
2. Periodically pull a **random sample** of recent reviews with
   `sentiment_sample.php` (already built) and hand-label just that sample,
   blind to both the engine's guess and the star rating.
3. Use the hand-labelled sample two ways: (a) as an updated accuracy
   measurement for whichever engine is live, and (b) as new rows for
   `training_data.csv` via `merge_reviews.py`.

This keeps the human labeling workload constant (e.g. ~100-200 reviews per
retraining cycle) no matter how large the underlying review volume gets.

## 2. Retraining needs a fixed comparison point, not vibes

As `training_data.csv` grows, re-running `train_sentiment.py` will naturally
produce different accuracy numbers each time — that's expected. To actually
know whether a retrain is an *improvement* and not just noise (see: the
43%-83% swing we saw with repeated sub-sampling at n=112), keep a **fixed
held-out test set** that is set aside once and never used for training,
instead of a freshly random split every run. Compare each new model against
the same fixed set over time — that's the only way "did it get better?" is
a meaningful question.

Suggested cadence: retrain when ~200-300 new hand-labelled examples have
accumulated, not on a fixed calendar schedule — the dataset size is what
actually drives model quality, not the passage of time.

## 3. Before shipping a retrained model, compare it to what's live

Never swap a new model into `model_weights.json` just because it finished
training. Run it against the fixed test set from step 2, compare accuracy
and the confusion matrix to the currently-deployed version, and only ship
it if it's a genuine improvement. This mirrors what `sentiment_drift.php`
already does for the lexicon (flagging when stored results no longer match
the current engine) — the same discipline should apply to model versions.

## 4. The model can graduate, but doesn't have to

At a few hundred examples, Naive Bayes + bag-of-words is close to the best
you can do — fancier models would just overfit. At 10,000+ examples, there's
enough signal to reasonably try logistic regression or an SVM, which can
outperform Naive Bayes once data is no longer the bottleneck. This is
optional, not required — if Naive Bayes is still performing well, there's
no need to complicate the PHP inference side just to use a fancier model.

## 5. Infra items that would bite BEFORE the ML model ever does

These aren't ML problems, but they hit the same tables and would surface
first as the system scales:

- **Pagination** — `crud.php`'s GET handler now caps at 1000 rows by
  default (see `?limit=`/`?offset=` support added [date of this change]).
  Without this, an admin dashboard rendering 50,000 rows into a React table
  would become the actual bottleneck, not the sentiment engine.
- **Rate limiting** — `feedback.php` and `crud.php` (table=reviews) now
  cap submissions per user (3/minute, 30/day) to stop scripted spam from
  polluting both the live sentiment dashboard and any future training data
  pulled from it. Garbage reviews in are garbage labels out.
- **`model_weights.json` size** — grows with vocabulary, not row count
  directly (natural language vocabulary saturates — the 10,001st review
  adds far fewer new words than the 101st did). If it ever becomes large
  enough to slow down PHP's per-request JSON parsing, cache the decoded
  structure with APCu instead of re-parsing the file on every request.

## Summary

| Review volume | What to do |
|---|---|
| ~150 (today) | Hand-label what you can, use synthetic augmentation to cover vocabulary gaps. |
| ~1,000-10,000 | Sample + label a few hundred per cycle (`sentiment_sample.php` + `merge_reviews.py`), retrain, compare against a fixed test set before shipping. |
| 10,000-50,000+ | Same labeling cadence; consider a stronger model if Naive Bayes plateaus; make sure pagination and rate limiting are already in place (see section 5) since those become load-bearing well before this point. |
