# TCIMS — Task prompts for the mobile app's Claude

Give these to whoever/whatever is working on the Flutter app.
**Do them in order** — each builds on the one before.

Copy the block under "PROMPT" verbatim. The notes above each prompt are for
you (the humans), not for pasting.

---

## Context to paste ONCE, before Task 1

> **PROMPT**
>
> Context for everything that follows.
>
> This Flutter app is one half of a thesis project called TCIMS (Tourism &
> Cultural Information Management System) for the City Culture, Arts and
> Tourism office of Mandaluyong. The other half is a web system built with
> React + a raw PHP/MySQL backend.
>
> Both share ONE Firebase project (`be-mandaluyong-4sight`) for sign-in.
>
> We have decided on this split, and it should not be re-litigated:
> - **Firebase Auth** owns identity (who the user is). Keep it.
> - **The PHP/MySQL backend** owns all tourism data — trail check-ins,
>   feedback, sentiment, rewards, certificates. This is the single source
>   of truth.
> - The app must stop writing tourism data to Firestore. Firestore currently
>   holds only 3 feedback records, so there is effectively nothing to migrate.
>
> Backend base URL (already deployed and live — TCIMS + TiDB Cloud, both on
> Render's Singapore-adjacent infrastructure):
> `https://tourism-cultural-information-management-kof5.onrender.com/my-app-backend`
> For the Android emulator during local development, use
> `http://10.0.2.2/my-app-backend` — inside the emulator, `localhost` means
> the emulator itself, not the developer's PC.
>
> Authentication model: the app signs in with Firebase as it already does,
> then exchanges the Firebase ID token for a TCIMS `api_token`, and sends
> that token on every backend request as `Authorization: Bearer <token>`.
> A `401` response means the token is no longer valid — send the user back
> to sign-in.
>
> Do not change the app's UI, navigation, or offline behaviour unless a task
> explicitly says to. Ask before installing new packages.

---

## Task 1 — Auth bridge (do this first; nothing else works without it)

Everything below depends on having an `api_token`.

> **PROMPT**
>
> Add an authentication bridge between Firebase and the TCIMS backend.
>
> After a successful Firebase sign-in, POST the Firebase ID token to
> `POST {baseUrl}/api/firebase_login.php` with JSON body:
> `{"idToken": "<firebase id token>", "role": "Tourist"}`
>
> The response is:
> `{"success": true, "user": { "id": 12, "username": "...", "email": "...", "role": "Tourist", "api_token": "..." }}`
>
> Store `api_token` securely (flutter_secure_storage if already available,
> otherwise SharedPreferences is acceptable for this project) and expose a
> single helper that other code uses to make authenticated calls, so the
> Authorization header is never written by hand in more than one place.
>
> Requirements:
> - `role` is only used when the account does not exist yet; always send "Tourist".
> - Re-exchange the token whenever Firebase reports a new sign-in.
> - On any `401` from the backend, clear the stored token and route to sign-in.
> - Handle no-internet gracefully: sign-in should fail with a clear message,
>   not a crash.
>
> Show me the helper class and where it is wired in, and do not change any
> other behaviour yet.

---

## Task 2 — Feedback goes to the server, and the server classifies it

This is the important one. Right now the app classifies sentiment on-device
with its own Dart lexicon, and the website classifies with a different PHP
lexicon. The same comment can come out Positive in the app and Negative on
the web. One engine has to win, and it is the PHP one — it has been tuned
against real misclassifications and already classifies 147 live reviews.

**Do not delete `sentiment.dart` or `sentiment_eval.dart`.** The 45-sample
labelled test set in `sentiment_eval.dart` is valuable thesis evidence and is
being ported to the PHP engine (Task 5).

> **PROMPT**
>
> Change feedback submission so the backend classifies sentiment, not the app.
>
> Replace the Firestore write in `feedback_page.dart` with:
> `POST {baseUrl}/api/feedback.php`
> Headers: `Authorization: Bearer <api_token>`, `Content-Type: application/json`
> Body: `{"place": "<place name>", "rating": <1-5 int>, "comment": "<raw text>"}`
>
> Response: `{"success": true, "id": 148, "sentiment": "Positive", "score": 3}`
>
> Requirements:
> - Send the RAW comment text. Do not send a sentiment value — the server
>   computes it and returns it.
> - Use the `sentiment` value from the response for any confirmation UI.
> - `rating` must be an integer 1–5; the server rejects anything else with 400.
> - Stop writing to the Firestore `feedback` collection.
> - Keep `sentiment.dart` in the project. It may still be used to show an
>   instant on-device preview BEFORE submitting, but label any such preview
>   clearly as provisional. The server's answer is the official one.
> - The user's own past feedback can be read with
>   `GET {baseUrl}/api/feedback.php` (returns an array of their reviews).
>
> Do not delete `sentiment.dart` or `sentiment_eval.dart`.

---

## Task 3 — Trail check-ins go to the server

The good news: the nine church names in `heritage.dart` already match the
backend's canonical list exactly, so no renaming is needed.

**Critical:** `visits.php` POST is a **toggle**. Posting the same place twice
removes the check-in. A naive "push everything on every sync" will silently
delete the user's progress.

> **PROMPT**
>
> Move Heritage Trail check-ins from Firestore to the TCIMS backend.
>
> Endpoints:
> - `GET {baseUrl}/api/visits.php` → returns a JSON array of place-name
>   strings the signed-in user has already checked in to, e.g.
>   `["San Felipe Neri Parish Church", "Our Lady of Fatima Parish Church"]`
> - `POST {baseUrl}/api/visits.php` with `{"place": "<exact name>"}` →
>   **toggles** that check-in. Response: `{"success": true, "visited": true|false}`
>
> Both require `Authorization: Bearer <api_token>`.
>
> IMPORTANT — because POST toggles, the sync must never blindly re-post:
> 1. `GET` the server's list first.
> 2. `POST` only for places the user has locally that the server does NOT have.
> 3. Never POST a place that already appears in the server's list.
>
> Requirements:
> - Replace the Firestore writes in `cloud_sync.dart`. The `users` collection
>   is no longer the store for trail progress.
> - Keep the local SharedPreferences copy — it is what makes the app work
>   offline. Treat it as a cache plus an outbox, not as the source of truth.
> - On app start (and after sign-in), reconcile: fetch the server list, merge
>   in any local-only check-ins using the rule above, then use the server list
>   as the display state.
> - Place names must be sent exactly as they appear in `heritage.dart` — they
>   already match the backend. Do not reformat, trim differently, or title-case.
> - Trail completion must be read from the server, not counted locally:
>   `GET {baseUrl}/api/certificate.php` returns
>   `{"completed": bool, "done": int, "total": int, "date": "...", "name": "...", "email": "..."}`
>   The backend defines the trail as a specific list of nine churches; if the
>   app counts for itself the two systems can disagree about completion.
>
> Show me the reconcile logic before wiring it to the UI.

---

## Task 4 — Photo check-ins (only if the app takes check-in photos)

Skip this task if the app does not capture check-in photos.

> **PROMPT**
>
> If the app captures a selfie and an on-site photo for a trail check-in, send
> them to `POST {baseUrl}/api/checkin.php` as a multipart/form-data request
> with fields:
> - `place` — the exact church name (text)
> - `selfie` — image file
> - `site` — image file
>
> Header: `Authorization: Bearer <api_token>` (do NOT set Content-Type
> manually; the HTTP client must set the multipart boundary).
>
> This endpoint records the check-in and stores both photos, so when it is
> used you should NOT also call `visits.php` for the same place.

---

## Task 5 — Hand over the evaluation test set (no code change)

This is the one piece of the app's sentiment work that should be preserved and
elevated. Running the same labelled set against the PHP engine gives the thesis
one accuracy figure for the engine that actually runs everywhere.

> **PROMPT**
>
> Export the hand-labelled sentiment test set so it can be reused against the
> web system's PHP classifier.
>
> From `sentiment_eval.dart`, write out all 45 `LabeledSample` entries as a CSV
> file with two columns: `comment,expected` where `expected` is one of
> `Positive`, `Neutral`, `Negative` (capitalised to match the PHP engine's
> labels). Preserve the text exactly, including the Filipino and Taglish
> samples. Quote fields containing commas.
>
> Do not modify `sentiment_eval.dart` itself — this is an export only.

---

## Task 6 — Offline queue (optional, do last)

Only worth doing if the offline capability matters to the demo.

> **PROMPT**
>
> Make backend writes resilient to being offline.
>
> Add a small local outbox: when a feedback submission or trail check-in
> cannot reach the server, store it locally and retry when connectivity
> returns. Requirements:
> - Do not lose the user's action; show it as "pending sync" in the UI.
> - Respect the toggle rule from Task 3 when flushing check-ins — fetch the
>   server list first, and only send places it does not already have.
> - Flush on app resume and when connectivity is restored.
> - Keep it simple; do not add a background-service package for this.

---

## What the web side does NOT need to change

For the humans, so nobody duplicates work:

- The web already reads trail progress from the `visits` table, so app
  check-ins appear with no web changes at all.
- The web already computes sentiment server-side on every feedback POST, so
  app feedback lands in the same Sentiment Analysis dashboard and reports.
- `certificate.php` and `claim_reward.php` already share one definition of
  trail completion (`config/heritage_trail.php`), so the app and web cannot
  disagree about whether the trail is finished.

## One known issue to decide on

`login.php` and `firebase_login.php` store a **single** `api_token` per user,
overwriting the previous one. If the same account signs in on the phone and
then on the web, the phone is logged out (and vice versa).

For a demo showing "check in on the phone, see it on the web", either use two
different accounts, or ask the web developer to add multi-session token
support before the defense.
