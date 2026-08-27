-- Shadow-mode ML sentiment column. The lexicon's `sentiment` column remains
-- the value shown to users/staff; `ml_sentiment` records what the trained
-- Naive Bayes model (ml_training/train_sentiment.py) would have said, purely
-- for ongoing comparison as the training set grows. NULL until a model has
-- been trained and deployed (model_weights.json present) — see
-- config/sentiment_ml.php and ml_training/SCALING_PLAN.md.
ALTER TABLE reviews ADD COLUMN ml_sentiment VARCHAR(20) DEFAULT NULL AFTER sentiment;
