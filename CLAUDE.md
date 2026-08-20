# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is two separate apps in one working directory, not a monorepo with shared tooling:

- `my-app-frontend/` — React 19 + Vite SPA. Has its own git repo (`.git`).
- `my-app-backend/` — raw PHP (mysqli) + MySQL API, served by XAMPP/Apache. **No git repo** — treat changes here as unversioned unless told otherwise.

TCIMS = Tourism & Cultural Information Management System, built for the City Culture, Arts and Tourism (CCAT) office of Mandaluyong City. It has a public tourist-facing side ("Be@Mandaluyong") and an internal admin/establishment side.

## Commands

All commands run from `my-app-frontend/`:

```bash
npm run dev       # start Vite dev server on http://localhost:5173 (strictPort: fails if busy instead of jumping to 5174)
npm run build     # production build to dist/
npm run preview   # preview the production build
npm run lint      # eslint .
```

There is no test suite (no test runner is configured in `package.json`).

The backend has no build step — PHP files are served directly by Apache. To run it locally: start XAMPP (Apache + MySQL), place/symlink this folder so it's reachable as `my-app-backend`, and import `database.sql` (plus any `add_*.sql` / `seed_*.sql` migration files — see below) via phpMyAdmin into a `tcims_db` database. Set `VITE_API_HOST` in the frontend's `.env` to the backend base URL (defaults to `http://localhost/my-app-backend`).

## Backend architecture

**Routing**: there is no framework/router. Each file in `my-app-backend/api/` is one endpoint, hit directly (e.g. `POST /api/login.php`, `GET /api/crud.php?table=events`). Every endpoint file starts by requiring the same config chain:

```php
require_once "../config/cors.php";   // origin allowlist + CORS/JSON headers, handles OPTIONS preflight
require_once "../config/db.php";     // opens $conn (mysqli)
require_once "../config/auth.php";   // require_auth() / require_admin() / current_user()
require_once "../config/activity.php"; // log_activity() — audit trail, fails silently
```

**`api/crud.php` is the generic data endpoint** for most tables (tourist spots, restaurants, hotels, tourism businesses, events, heritage sites, certificates, reviews, visits, users, rewards). It's driven by a `$TABLES` whitelist mapping table name → allowed columns — **adding a new manageable table/column means editing that map**, not writing a new CRUD file. All queries are parameterized via `db_run()`; only the `id`/`owner_id` integers are ever inlined into SQL. Everything else (auth flows, file uploads, feedback, check-ins, rewards claiming, password reset, activity log) has its own dedicated PHP file in `api/`.

**Auth** is a bearer token, not sessions/JWT: `login.php` issues a random token stored in `users.api_token`; the frontend sends `Authorization: Bearer <token>` on every request; `config/auth.php`'s `current_user()` looks the row up by token on each call. `.htaccess` re-exposes the `Authorization` header to PHP because some Apache/CGI setups strip it. Login also supports an admin-only two-step PIN (`admin_pin`) and account lockout after 5 failed attempts (15 min). Google/Firebase sign-in are separate endpoints (`google_login.php`, `firebase_login.php`) that mint the same kind of `api_token`.

**Roles**: `Super Admin`, `CCAT Admin`, `CCAT Staff` (+ legacy `admin`) are all "admin" per `is_admin_role()` in `config/auth.php` (backend) and `ADMIN_ROLES` in `src/utils/roles.js` (frontend) — **keep these two lists in sync** if roles ever change. `Establishment` accounts can only see/create their own `certificates` rows (enforced via `owner_id` in `crud.php`). `Tourist` accounts can only POST to `reviews`/`visits`.

**`config/db.php` auto-detects environment** from `$_SERVER['HTTP_HOST']` (localhost/127.0.0.1 → local XAMPP creds, anything else → live InfinityFree creds) so the same code runs unmodified in both places. Real credentials live in `config/db_credentials.php` (gitignored, not committed) which `db.php` requires; `config/db_credentials.example.php` is the template to copy when setting up a new environment.

**Sentiment analysis** (`config/sentiment.php`, `tcims_sentiment()`) is a hand-built English/Filipino/Taglish lexicon scorer used by `feedback.php`, not an external API. Any profanity (exact match or substring root match, e.g. catching "putanginamo") hard-overrides the result to `Negative` regardless of star rating; otherwise lexicon score decides, and the star rating only breaks a genuinely neutral tie. If you touch this, the lexicon arrays and the hard-override behavior are the load-bearing logic, not the tie-breaking.

**SQL migrations are a flat list of files, not a numbered chain**: `database.sql` is the base schema, and each `add_*.sql` in `my-app-backend/` root layers on one feature (e.g. `add_login_security.sql`, `add_owner_id.sql`, `add_rewards.sql`). `migrate_all.sql` and the `seed_*.sql` files fill reference data. There's no migration tracking table — applying them is manual/ordered by hand.

## Frontend architecture

**`src/api/api.js` is the single point of contact with the backend.** Every backend call goes through one of its exported `api*` functions (`apiList`, `apiCreate`, `apiFeedbackCreate`, etc.) — no component calls `fetch` directly. It auto-attaches the bearer token from `localStorage.user.api_token`, and on a `401` response it clears the stored user and redirects to `/login`. When adding a new backend endpoint, add its wrapper here rather than inlining fetch calls in components.

**Auth/session state** lives in `src/context/AuthContext.jsx` (`useAuth()`), backed by `localStorage`. It enforces a 15-minute inactivity timeout client-side (resets on mousedown/keydown/scroll/touchstart) independent of any server-side token expiry.

**Routing (`src/App.jsx`) is organized into three role-gated areas**, each with its own guard component + layout:
- `/admin/*` — guarded by `AdminRoute`, wrapped in `AdminLayout` (shared sidebar). Tourist-spots/restaurants/hotels/tourism-businesses/heritage-sites/events/certificates management, sentiment dashboard, reports, rewards, user management, activity log.
- `/tourist/*` — guarded by `TouristRoute`, wrapped in `TouristLayout`. Public-facing "Be@Mandaluyong" experience: explore, heritage trail (GPS check-ins), events, feedback.
- `/establishment/*` — guarded by `EstablishmentRoute`, wrapped in `EstablishmentLayout`. Accreditation portal for businesses to apply for/track certificates.

`ProtectedRoute` is the generic "must be logged in" guard used by `/dashboard` and `/profile`; the three area-specific `*Route` components additionally check role via `src/utils/roles.js`.

**Most admin CRUD pages (`TouristSpots.jsx`, `Restaurants.jsx`, `Events.jsx`, etc.) follow the same shape**: call `apiList`/`apiCreate`/`apiUpdate`/`apiRemove` from `api.js` against the matching `crud.php?table=...` name, with local component state for the form/modal. When adding a new admin-managed entity, the pattern to copy is: add the table+columns to `$TABLES` in `crud.php`, then add a component mirroring an existing one like `Restaurants.jsx`.

**Static reference data** (`src/data/tcimsData.js`, `trivia.js`) holds hardcoded content sourced from CCAT's printed materials (calendar of activities, tourist attraction lists, heritage trail trivia) — this is data, not code to refactor.

## Notes on the environment

- Config differences between local and production (DB host, CORS allowed origins, API base URL) are handled per-file (`config/db.php`, `config/cors.php`, `.env`) rather than through a single environment abstraction — check all of them when debugging cross-environment issues.
- CORS in `config/cors.php` explicitly allowlists `localhost:5173`/`127.0.0.1:5173` plus any `*.vercel.app` origin; adding a new frontend deployment host means updating that list.
- File uploads (avatars, certificate docs, check-in photos) are written under `my-app-backend/uploads/` and served as static files; `fileUrl()` in `api.js` builds the URL from a stored relative path.
