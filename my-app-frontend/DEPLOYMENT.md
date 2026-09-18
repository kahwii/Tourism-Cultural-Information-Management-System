# Production deployment notes

## The API is proxied through Vercel, not called directly

`vercel.json` has two rewrites and **the order matters** — Vercel takes the
first match, so the SPA catch-all must stay last or it would swallow
`/backend/*` and serve `index.html` instead of proxying:

```
/backend/:path*  →  https://<render-host>/my-app-backend/:path*
/(.*)            →  /index.html
```

`VITE_API_HOST` is therefore the relative path `/backend`, not the Render URL.
The browser only ever talks to the vercel.app origin; Vercel's edge fetches
Render from its own datacenter.

**Why.** Some ISPs blackhole TLS to `*.onrender.com`. The signature is
distinctive — ping replies normally, port 80 connects, port 443 times out, and
`render.com` loads while `dashboard.render.com` does not. That is hostname-based
(SNI) filtering, and it made the live site unusable on those networks with
nothing at all wrong on the server. Proxying moves the fetch off the visitor's
network.

Side effect worth knowing: the API is now same-origin, so no CORS preflight is
sent at all and production no longer depends on the `*.vercel.app` rule in
`config/cors.php`. That rule still matters for `npm run dev` against a remote
backend, so leave it in place.

Cost: one extra hop of latency, and API traffic now counts against the Vercel
plan's bandwidth.

## vercel.json takes no comments

It is strict JSON and Vercel **rejects unknown top-level keys** — a `_comment`
field fails the deployment with a schema error rather than being ignored. That
is why this file exists instead.

## VITE_API_HOST lives in the Vercel dashboard

`.env.production` is gitignored, so it never reaches Vercel. The value that
actually builds the site is the environment variable in
**Project → Settings → Environment Variables**.

Vite inlines env values at build time, so **changing the variable does nothing
until you redeploy** — editing it does not update the running site on its own.

Keep the local `.env.production` in sync by hand; it is documentation of what
the dashboard should say, not the source of truth.
