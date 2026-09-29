# TCIMS — technology and process reviewer

A study guide for the defense. Everything here was read off the repository, not
recalled from memory, so the versions and file names are the ones actually in
the project.

Read it with one goal: to be able to say, for every box on the diagram, **what
it is, why it is there, and what you would have used instead.** A panel rarely
asks "what is React". It asks "why React", "why not a framework for the
backend", and "what happens if this piece fails" — and those are the questions
this document is organised around.

---

## 1. What the system is, in one paragraph

TCIMS is a tourism and cultural information management system for the City
Culture, Arts and Tourism office of Mandaluyong. It has three faces on one
codebase: a public tourist experience (Be@Mandaluyong — explore, heritage
trail, events, feedback), an internal CCAT admin console (directory
management, events approval, accreditation, reports, sentiment dashboard), and
an establishment portal where businesses apply for and track tourism
accreditation. A companion Android app, built separately in Flutter, talks to
the same API.

---

## 2. The stack, layer by layer

### Frontend

| Technology | Version | Why it is here | The alternative you rejected |
|---|---|---|---|
| **React** | 19.2 | The admin console is a set of screens with heavy shared state — logged-in user, role, lists that refresh after a write. Components + hooks express that directly. | Plain PHP pages with full reloads. Simpler to start, but every filter and modal becomes a round trip. |
| **Vite** | 5.4 | Dev server starts in under a second and rebuilds only the file you touched; `npm run build` emits plain static files any host can serve. | Create React App — deprecated, and its rebuilds are much slower. |
| **React Router** | 7.18 | Role-gated areas: `/admin/*`, `/tourist/*`, `/establishment/*`, each with its own guard component and layout. | Hand-rolled conditional rendering. Works until you need deep links and the back button. |
| **Recharts** | 3.8 | The sentiment and reports charts. Declarative — a chart is a component, not a canvas you draw on. | Chart.js. Imperative API, awkward inside React's render cycle. |
| **jsPDF + html2canvas** | 4.2 / 1.4 | Generates the official CCAT report PDF **in the browser**, so no server-side PDF library and no upload of report data. | Server-side PDF (TCPDF, wkhtmltopdf). More infrastructure for a once-a-week button. |
| **Firebase SDK** | 12.15 | Google sign-in only. | Rolling your own OAuth flow against Google's endpoints. |

### Backend

| Technology | Why it is here | The alternative you rejected |
|---|---|---|
| **PHP (no framework)** | Every file in `api/` is one endpoint, hit directly. Nothing to learn beyond PHP itself, nothing to install on the server, and the shared university/city hosting environments all run PHP. | Laravel. Better structure at scale, but it needs Composer, a build step, and a host that tolerates it — and it would have been the larger half of the thesis. |
| **mysqli with prepared statements** | All writes go through `db_run()`, which binds parameters. Only integer `id` / `owner_id` values are ever placed in SQL text, after casting. | PDO. Genuinely nicer, but mysqli is what the raw-PHP course material uses and the security property that matters — parameter binding — is identical. |
| **MySQL / MariaDB (XAMPP)** locally, **TiDB Cloud** in production | TiDB speaks the MySQL wire protocol, so the same code and the same SQL run in both places with only credentials changing. | A separate cloud MySQL. TiDB's free tier is what made a live deployment possible at all. |
| **Brevo HTTP API** for email | The production host blocks outbound SMTP ports, so PHPMailer over SMTP simply cannot connect. Brevo accepts an HTTPS POST instead, which nothing blocks. | SMTP via PHPMailer. Works locally, fails in production — a difference worth explaining, because it is a real deployment lesson. |

### Hosting

| Piece | Where | Note |
|---|---|---|
| Frontend | **Vercel** | Static build, deployed from `main` on every push. |
| Backend | **Render** (Docker, PHP + Apache) | Free tier sleeps after 15 minutes of inactivity; the first request after that takes roughly a minute. Mention this before a demo. |
| Database | **TiDB Cloud** | Stores timestamps in UTC. The frontend converts to Asia/Manila in `src/utils/datetime.js` — see §4.5. |
| API routing | **Vercel rewrite** | `/backend/*` is proxied to Render. See §4.6 — there is a story here the panel may enjoy. |

### Machine learning (offline)

| Piece | Note |
|---|---|
| **Python + scikit-learn** | Training only, on your laptop. `ml_training/train_sentiment.py`. |
| **Multinomial Naive Bayes** | The shipped classifier. Character n-grams (2-4) inside word boundaries, α = 0.05. |
| **`model_weights.json`** | The trained model exported as plain numbers. PHP reads it and does inference directly, so **the server needs no Python and no scikit-learn**. This is the single most important architectural decision in the ML half — be ready to explain it. |

---

## 3. The data model

Eleven tables ship in `database.sql`; the rest arrive through `add_*.sql`
migration files applied by hand, in order. There is no migration tracking
table — a limitation worth admitting if asked.

**Core:** `users`, `tourist_spots`, `restaurants`, `hotels`,
`tourism_businesses`, `events`, `heritage_sites`, `certificates`,
`certificate_documents`, `reviews`, `visits`

**Added by migrations:** `activity_logs`, `establishment_profiles`,
`inquiries`, `rewards`, `reports`, `user_tokens`, `visit_photos`

---

## 4. The processes, end to end

These are the flows to be able to trace out loud, without notes.

### 4.1 Authentication and roles

1. `login.php` verifies the password hash, then issues a random bearer token.
2. The browser sends `Authorization: Bearer <token>` on every later request.
3. `config/auth.php` looks the token up per request — there are no sessions.

Guards and hardening:

- **Account lockout.** Five failed attempts locks the account for 15 minutes.
- **Admin PIN.** Admin accounts take a second step — a numeric PIN — so a
  stolen password alone is not enough.
- **Client inactivity timeout.** `AuthContext.jsx` logs the user out after 15
  minutes of no mouse, key, scroll or touch activity. This is a convenience
  guard in the browser, **not** a security boundary, and saying so when asked
  will earn you more credit than claiming otherwise.
- **`.htaccess` re-exposes the `Authorization` header**, because some Apache
  and CGI configurations strip it before PHP ever sees it.

**Roles:** `Super Admin`, `CCAT Admin`, `CCAT Staff`, `Establishment`,
`Tourist`. The first three count as "admin" (`is_admin_role()`), but only the
first two can approve (`is_approver_role()`). That split is the whole point of
§4.4. The same list exists in the frontend at `src/utils/roles.js` and the two
**must** be kept in sync — a known fragility, and an honest answer if a panel
member asks what you would refactor.

### 4.2 Heritage Trail — check-in, reward, certificate

The trail is nine churches (`config/heritage_trail.php`). Two different things
can happen at a church, and the difference is the heart of the feature:

| | `visits.php` | `checkin.php` |
|---|---|---|
| Triggered by | Tapping a toggle in Explore | Completing a guided check-in |
| Requires | Nothing | **GPS coordinates + a selfie + a photo of the site** |
| Stored as | `verified = 0` | `verified = 1` |
| Counts toward the reward | **No** | **Yes** |

Only `verified = 1` counts, and `claim_reward.php` and `certificate.php` both
gate on the same `trail_status()` helper — one definition of "complete", used
everywhere.

**The defect worth telling as a story.** The web side listed twelve churches
while the app listed nine: one duplicate and one renamed entry. Because
completion required all twelve and only nine were reachable, **nobody could
ever finish the trail** — no mug, no certificate, for anyone. An audit then
found five mugs already issued to accounts with zero verified check-ins. The
fix (`fix_trail_churches.sql`) remapped the visit rows to canonical names
*first*, then de-duplicated while preserving verified check-ins, then removed
the extra church rows. Order mattered: deleting first would have orphaned real
check-ins.

### 4.3 Feedback and sentiment

1. A tourist submits a review (text + star rating).
2. `feedback.php` scores it **server-side** with the lexicon
   (`config/sentiment.php`) and stores the result in `sentiment`.
3. The ML model scores the same text into `ml_sentiment` — **shadow mode**,
   recorded but never shown.
4. The admin dashboard reads `sentiment`; reports and exports read both.

Two things to be ready to defend:

- **Sentiment is computed on the server, from the comment text, never trusted
  from the client.** Otherwise a caller could post a comment saying one thing
  with a `sentiment` field saying another, and quietly poison both the
  dashboard and any future training data.
- **Profanity hard-overrides to Negative**, whatever the stars say. This is a
  product rule, not a sentiment judgement: abusive feedback must reach CCAT as
  abusive. It means "sobrang ganda tangina" is filed Negative even though a
  human might read the sentiment as positive. Disclose it; do not let it be
  discovered.

### 4.4 Events — maker-checker approval

CCAT Staff are *makers*, Super Admin and CCAT Admin are *checkers*.

1. Staff create an event (web or the mobile app) → the server **forces**
   `approval_status = 'Pending'` and stamps `submitted_by`.
2. Pending events are invisible to the public: the read filter in `crud.php`
   restricts non-admins to `approval_status = 'Approved'`.
3. An approver approves (it goes public) or rejects with remarks;
   `approved_by` records who.
4. **A staff edit sends an approved event back to Pending** — an event whose
   date or venue changed has not been reviewed in its new form.

An admin adding an event directly skips to step 3: they are their own checker.

### 4.5 Accreditation

`register.php` creates three things in one transaction-shaped sequence: the
user account, the `establishment_profiles` row, and an "Under Review"
`certificates` row that appears in the admin queue. Approval generates the
control number, business account number, OR number, and validity dates, then
starts pickup tracking — with 30/60/90-day reminder emails sent best-effort
whenever an admin opens the Certificates page.

### 4.6 Two deployment problems worth telling

Both are real, both were diagnosed with evidence, and both make better answers
than "it just worked".

**The 8-hour error.** TiDB stores UTC. `new Date("2026-09-14 10:00:00")`
without a `Z` is parsed by the browser as *local* time, so every timestamp in
the system displayed eight hours off. Fixed in `src/utils/datetime.js`, which
appends the `Z` and formats in `Asia/Manila` — applied across ten call sites.

**The ISP block.** The live site suddenly could not reach the backend. The
evidence separated the possible causes cleanly: ping replied in 59 ms, port 80
connected, **port 443 timed out**, and `render.com` loaded while
`dashboard.render.com` did not. A dead server fails all of those; a routing
problem fails ping too. Only one thing fits: hostname-based (SNI) filtering by
the ISP against `*.onrender.com`. The fix was to stop having the browser talk
to Render at all — a Vercel rewrite (`/backend/*`) now proxies the API, so the
fetch happens from Vercel's datacenter instead of the visitor's network.

---

## 5. Questions the panel is likely to ask

**"Why raw PHP and not Laravel?"**
Deployment constraints and scope. No Composer, no build step, and it runs on
whatever PHP host is available. A framework would have been a second thesis.
What was given up is structure — routing, ORM, migrations — and the migration
folder shows that cost honestly: files applied by hand, in order, with no
tracking table.

**"Is this secure?"**
Three specific claims, no more: all writes use prepared statements; reads are
**deny-by-default** (a table is unreadable unless explicitly listed in
`$READ_PUBLIC` or `$READ_ADMIN`, so forgetting to gate a new table fails
closed, not open); and approval is separated from creation. Then name a real
limitation before you are asked — uploads are served as static files, and the
15-minute inactivity timeout is client-side only.

**"Why Naive Bayes and not a neural network / BERT?"**
126 labelled examples. A transformer has millions of parameters and would
memorise that dataset rather than learn from it. Naive Bayes is the correct
model family *for this amount of data*, and the honest answer is a statement
about the dataset, not about the algorithms.

**"Why are you using character n-grams?"**
Two reasons specific to this data. Real reviews are full of elongation and
misspelling ("gandaaa", "gnda", "dto"), and Filipino builds meaning by
affixing: *ganda → maganda → napakaganda → kagandahan*. A word model treats
each of those as an unrelated token to be learned separately from a handful of
examples; a character model sees the shared *"ganda"* inside all of them. It
was worth +6.5 points, winning 22 of 30 paired splits.

**"Why is the ML model not the live engine?"**
Because it has not yet beaten the lexicon on human-verified data. Shadow mode
is a deliberate decision — it scores every review into `ml_sentiment` so the
comparison can be measured — not an unfinished feature.

**"Why only 82.69%?"**
Because 126 labelled examples is a small dataset, and the learning curve is
still rising steeply rather than flattening — the constraint is data volume,
not the model family. The same model scores 90.00% on Positive vs Negative
alone; Neutral is the bottleneck, and Neutral is hard for a bag-of-words model
by its nature, since it is defined by the *absence* of the sentiment words the
model keys on.

**"How do you know the accuracy you measured is what is running?"**
`train_sentiment.py` exports `parity_fixture.json` — the trained model's own
predictions on fixed inputs — and `api/sentiment_ml_parity.php` replays them
through the PHP implementation and reports any disagreement. It currently
reports 100%, 21/21. Without that harness, a mismatch between Python and PHP
would change predictions silently.

**"Where does synthetic data fit, and isn't that cheating?"**
510 AI-generated sentences are **training material only**. They are added to
the training side of every split and are never scored against, so no reported
figure can be earned by recognising the system's own phrasing. This was also
corrected mid-project: the figures used to describe a real-data-only model
while the *deployed* model had seen the synthetic rows — measuring one thing
and shipping another. See `ml_training/RESULTS_AND_LIMITATIONS.md` §5c.

**"What would you do differently?"**
Pick real answers, not modest-sounding ones: keep the role lists in one place
instead of two; add a migration tracking table; collect labelled data from the
start rather than at the end; use PDO.

---

## 6. Things not to claim

Each of these is a trap you can walk into by being enthusiastic.

- **Do not call the lexicon's 100% "accuracy".** It is a sanity check on 45
  unambiguous sentences, plus a regression suite that passes *by construction*
  — the lexicon was edited until those cases passed. Counting them as accuracy
  is circular.
- **Do not present 90% as the system's accuracy.** That figure is Positive vs
  Negative only. The system classifies three ways and scores 82.69%.
- **Do not say the ML model is "live".** It is in shadow mode.
- **Do not say sentiment analysis handles sarcasm.** Neither engine can.
  "Wow, ang bagal talaga, sulit na sulit ang paghihintay" reads as positive to
  both, because every individual word in it is positive.
- **Do not claim the system is multi-annotator.** Labelling was done by one
  person and no Cohen's κ was computed. It is in the limitations section.
