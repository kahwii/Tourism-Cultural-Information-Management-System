# Sentiment ML training

Offline-only tooling. Nothing here runs on the live site — it produces
`model_weights.json`, which `config/sentiment_ml.php` reads at runtime.
Python is only needed on the machine doing the training, never on the
server.

## Workflow

1. Visit `http://localhost/my-app-backend/api/export_training_data.php?key=tcims_eval`
   and save the downloaded file here as `training_data.csv`.
2. `python train_sentiment.py`
3. Check the printed accuracy / confusion matrix.
4. `model_weights.json` (written here) is what the PHP side reads.

## Growing the dataset (do this if accuracy is low)

54 examples is a small first pass — expect modest accuracy. To improve it,
label more of the real reviews already sitting in the database:

1. Visit `http://localhost/my-app-backend/api/sentiment_sample.php?key=tcims_eval&n=200`
   and save the download here as `real_reviews_to_label.csv`.
2. Open it and fill in the `expected` column (Positive / Neutral / Negative)
   for as many rows as you can, judging the comment text alone.
3. `python merge_reviews.py` — appends your new labels into `training_data.csv`,
   skipping blanks and duplicates.
4. `python train_sentiment.py` again and compare accuracy to the last run.

Repeat step 1-4 any time you want to add more labelled data.

## Synthetic data (synthetic_data.csv)

`synthetic_data.csv` (390 rows) is AI-generated, template-based tourism
review sentences — not real visitor comments. It exists to give the model
more exposure to common vocabulary (staff, presyo, kalinisan, tanawin,
etc.) when the real labelled set is still small.

Important: `train_sentiment.py` NEVER uses this file for cross-validation
or the held-out test accuracy — those numbers are always computed from
`training_data.csv` only, so the reported accuracy still describes
real-world performance. Synthetic data is mixed in only when training the
final model that gets exported to `model_weights.json`.

For the thesis methodology, disclose this plainly, e.g.: "The production
model was trained on N human-verified reviews plus 390 AI-generated
synthetic examples for vocabulary augmentation; all reported accuracy
figures were evaluated exclusively on human-verified data."
