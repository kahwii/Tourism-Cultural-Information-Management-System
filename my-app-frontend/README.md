# TCIMS — Tourism & Cultural Information Management System

A web-based Tourism and Cultural Information Management System with **Sentiment Analysis**
for the City Culture, Arts and Tourism (CCAT) office of Mandaluyong City.

This repository contains the **React (Vite) frontend**. The system also has a separate
**PHP + MySQL backend** (see the "Backend" section below).

## Features

- Role-based access: Super Admin, CCAT Admin, CCAT Staff, Establishment, and Tourist.
- Directory management for tourist spots, restaurants, hotels, tourism businesses, and heritage sites.
- Events and cultural activities management with tourist notifications.
- Establishment accreditation workflow with document upload and admin review.
- Real sentiment analysis pipeline: tourist feedback is scored server-side and shown on a
  live admin dashboard and reports.
- Gamified Heritage Trail: GPS-verified check-ins, points and tiers, photo proof, and a
  100%-completion reward.
- Google sign-in via Firebase Authentication.

## Tech stack

- Frontend: React 19, Vite, React Router, Recharts.
- Backend: raw PHP (mysqli, prepared statements), MySQL — served with XAMPP/Apache.
- Auth: token-based API auth + Firebase Authentication (Google).

## Local setup (frontend)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env with your real values

# 3. Run the dev server
npm run dev
```

The app runs on http://localhost:5173 by default.

## Backend

The backend lives in a separate folder served by XAMPP (Apache + MySQL), e.g.
`C:\xampp\htdocs\my-app-backend`. Import the SQL migrations via phpMyAdmin and make sure
Apache and MySQL are running. Set `VITE_API_HOST` in `.env` to the backend base URL.

> Note: the free static hosts below run the frontend only. The PHP + MySQL backend must be
> hosted separately (locally on XAMPP for demos, or on a PHP host such as InfinityFree).

## Deploy the frontend (free)

### Option A — Vercel
1. Push this repo to GitHub.
2. Go to https://vercel.com, "Add New Project", import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output dir `dist`.
4. Add the `VITE_*` environment variables (from your `.env`) in Project Settings → Environment Variables.
5. Deploy.

### Option B — Netlify
1. Push this repo to GitHub.
2. Go to https://netlify.com, "Add new site" → "Import an existing project".
3. Build command `npm run build`, publish directory `dist`.
4. Add the `VITE_*` environment variables under Site settings → Environment variables.
5. Deploy.

## Build locally

```bash
npm run build     # outputs to /dist
npm run preview   # preview the production build
```
