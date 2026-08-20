# TCIMS — Mobile App Integration Guide (Flutter)

How the Flutter app and the web system share one set of records.

---

## 1. The core idea

There is **one database**. The web and the mobile app are two clients talking to
the same PHP API on top of it.

```
   Flutter app  ─┐
                 ├──►  my-app-backend (PHP)  ──►  MySQL  (single source of truth)
   Web (React)  ─┘
```

Nothing needs to be "synced". A trail check-in made in the app writes a row to
the `visits` table; the web reads that same table. It appears immediately
because it was never two separate copies to begin with.

**The one rule that matters:** the app must stop storing tourism data in
Firestore. If both Firestore and MySQL hold visits, they will disagree, and no
amount of syncing code will reliably fix it.

---

## 2. Keep Firebase — but only for sign-in

You do **not** have to remove Firebase. Split the responsibilities:

| Concern | Owner |
|---|---|
| Who the user is (Google sign-in) | Firebase Auth |
| Trail check-ins, feedback, rewards, events, certificates | MySQL via the PHP API |

The backend already supports this. `api/firebase_login.php` accepts a Firebase
ID token, verifies it against Google's public certificates, finds or creates the
matching user row, and returns a TCIMS `api_token`.

Because the account is matched **by email address**, a tourist who signs in with
the same Google account on both the app and the web is the same user row — so
their trail progress is automatically shared. No extra linking step.

### Sign-in flow in Flutter

```dart
// 1. Sign in with Firebase as you already do
final cred = await FirebaseAuth.instance.signInWithCredential(googleCredential);
final idToken = await cred.user!.getIdToken();

// 2. Exchange it for a TCIMS token
final res = await http.post(
  Uri.parse('$baseUrl/api/firebase_login.php'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'idToken': idToken, 'role': 'Tourist'}),
);
final data = jsonDecode(res.body);
final apiToken = data['user']['api_token'];   // store this
```

`role` only applies when the account is being created for the first time.

---

## 3. Every other request

Send the token on every call:

```dart
final res = await http.get(
  Uri.parse('$baseUrl/api/visits.php'),
  headers: {'Authorization': 'Bearer $apiToken'},
);
```

A `401` means the token is no longer valid — send the user back to sign-in.

---

## 4. Endpoints the app will need

Base URL: `https://<host>/my-app-backend`
(local development: `http://10.0.2.2/my-app-backend` from the Android emulator —
`localhost` inside the emulator refers to the emulator itself, not your PC.)

### Trail / check-ins

| What | Method | Endpoint | Body |
|---|---|---|---|
| List my check-ins | GET | `api/visits.php` | — |
| Toggle a check-in | POST | `api/visits.php` | `{"place": "San Felipe Neri Church"}` |
| Check in with photos | POST | `api/checkin.php` | multipart: `place`, `selfie`, `site` |

`place` is matched **by name string**, so the app and the web must spell the
place identically. Use the same canonical list on both sides — a mismatch here
is the most likely cause of "it didn't show up on the web".

### Feedback

| What | Method | Endpoint | Body |
|---|---|---|---|
| My feedback | GET | `api/feedback.php` | — |
| Submit feedback | POST | `api/feedback.php` | `{"place": "...", "rating": 5, "comment": "..."}` |

Sentiment is computed server-side by `config/sentiment.php`. The app must not
try to classify sentiment itself, or the two systems will disagree.

### Rewards & certificate

| What | Method | Endpoint |
|---|---|---|
| Reward status | GET | `api/claim_reward.php` |
| Claim reward | POST | `api/claim_reward.php` |
| Trail certificate status | GET | `api/certificate.php` |
| Email the certificate | POST | `api/certificate.php` (`{"email": "..."}` if none on file) |

Trail completion is defined once, server-side, in `config/heritage_trail.php`
(the nine parish churches). The app should read completion status from the API
rather than counting check-ins itself — otherwise the app and web can disagree
about whether the trail is finished.

### Directory & events (no login required)

| What | Method | Endpoint |
|---|---|---|
| Approved public events | GET | `api/public_events.php` |
| Tourist spots / restaurants / hotels / businesses | GET | `api/crud.php?table=tourist_spots` etc. |
| Submit a visitor inquiry | POST | `api/inquiries.php` |

---

## 5. Known issue to fix before the demo

**One token per user.** `login.php` and `firebase_login.php` both do:

```sql
UPDATE users SET api_token = ? WHERE id = ?
```

There is a single `api_token` column, so logging in **replaces** the previous
token. In practice:

> The tourist signs in on the phone. Someone then signs in to the web with the
> same account. The phone's token is now invalid and the app gets logged out —
> and vice versa.

This will happen during a demo that shows "check in on the phone, see it on the
web" with one account. Options:

1. **Use different accounts** for the app and the web while demonstrating.
   Zero code change, but the shared-record story is weaker.
2. **Support multiple sessions** — move tokens to their own table so one user
   can hold several valid tokens (phone + laptop). This is the proper fix and
   is a small, contained change to `config/auth.php`, `login.php`, and
   `firebase_login.php`.

---

## 6. CORS

Native Flutter (Android/iOS) does **not** enforce CORS, so `config/cors.php`
needs no change for the mobile app.

It only matters if the app is also built for **Flutter Web**. In that case, add
the web origin to `$ALLOWED_ORIGINS` in `my-app-backend/config/cors.php`.

---

## 7. Checklist for the teammate

- [ ] Point the app's base URL at the shared backend
- [ ] Replace Firestore reads/writes for visits, feedback, and rewards with the API calls above
- [ ] Store the `api_token` after sign-in and attach it to every request
- [ ] Handle `401` by returning to the sign-in screen
- [ ] Use the exact same place names as the web
- [ ] Test: check in on the phone, then confirm the row appears in the web admin
