"""
Merge newly hand-labelled real reviews into training_data.csv.

WHY THIS STEP EXISTS
---------------------
The first training run used only 54 examples (45 reference sentences +
9 confirmed field cases) and got 45-57% accuracy. That's not a bug — with
216 distinct words across only 54 examples, most words appear once, so the
model barely has enough repetition per word to learn anything reliable.

The fix is more labelled data. We already have 142 real visitor reviews
sitting in the database, unlabelled. This script takes the CSV you get from
sentiment_sample.php (columns: id, comment, expected), keeps only the rows
where you actually filled in `expected`, and appends them to
training_data.csv as new rows with source="review" — without duplicating
anything already in there.

WORKFLOW
--------
1. Visit (while XAMPP is running):
   http://localhost/my-app-backend/api/sentiment_sample.php?key=tcims_eval&n=200
   Save the download as real_reviews_to_label.csv in this same folder.

2. Open real_reviews_to_label.csv in Excel/Google Sheets/Notepad and fill in
   the `expected` column for every row with exactly one of:
       Positive
       Neutral
       Negative
   (case doesn't matter, this script normalizes it). Judge the comment text
   alone — ignore any rating, there isn't one shown here on purpose.
   Leave a row blank if you genuinely can't tell — blank rows are skipped.

3. Run:
       python merge_reviews.py

4. Re-run:
       python train_sentiment.py
   and compare the new accuracy numbers to the first run.
"""

import csv
import os

TRAINING_FILE = "training_data.csv"
LABELLED_FILE = "real_reviews_to_label.csv"

VALID_LABELS = {"positive": "Positive", "neutral": "Neutral", "negative": "Negative"}

if not os.path.exists(LABELLED_FILE):
    raise SystemExit(
        f"Can't find {LABELLED_FILE}. Download it from sentiment_sample.php, "
        f"label the 'expected' column, and save it in this folder first."
    )

# ---------------------------------------------------------------
# 1. Load what's already in training_data.csv, so we never add a
#    duplicate comment (comparing on the exact comment text).
# ---------------------------------------------------------------
existing_rows = []
existing_comments = set()
if os.path.exists(TRAINING_FILE):
    with open(TRAINING_FILE, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            existing_rows.append(row)
            existing_comments.add(row["comment"].strip())

# ---------------------------------------------------------------
# 2. Read the newly labelled reviews, keep only valid + non-duplicate rows
# ---------------------------------------------------------------
added, skipped_blank, skipped_invalid, skipped_dupe = [], 0, 0, 0

with open(LABELLED_FILE, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        comment = (row.get("comment") or "").strip()
        expected_raw = (row.get("expected") or "").strip()

        if not expected_raw:
            skipped_blank += 1
            continue

        label = VALID_LABELS.get(expected_raw.lower())
        if not label:
            print(f"  Skipping id={row.get('id')}: unrecognized label '{expected_raw}'")
            skipped_invalid += 1
            continue

        if comment in existing_comments:
            skipped_dupe += 1
            continue

        added.append({"comment": comment, "label": label, "source": "review"})
        existing_comments.add(comment)

# ---------------------------------------------------------------
# 3. Write the combined file back out
# ---------------------------------------------------------------
all_rows = existing_rows + added
with open(TRAINING_FILE, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["comment", "label", "source"])
    writer.writeheader()
    for row in all_rows:
        writer.writerow({"comment": row["comment"], "label": row["label"], "source": row["source"]})

print(f"\nAdded {len(added)} new labelled reviews.")
print(f"Skipped: {skipped_blank} blank, {skipped_invalid} invalid label, {skipped_dupe} duplicate.")
print(f"training_data.csv now has {len(all_rows)} total examples.")
print("Next: python train_sentiment.py")
