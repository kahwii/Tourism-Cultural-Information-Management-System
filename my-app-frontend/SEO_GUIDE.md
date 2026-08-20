# Getting TCIMS to show up on Google

## What I set up in the code

- **robots.txt** — tells Google it may crawl the public pages, and to keep the private dashboards (admin/tourist/establishment) out of search results.
- **sitemap.xml** — a map of your public pages so Google finds them faster.
- **Structured data (JSON-LD)** — labels the site as an official *GovernmentOrganization* (CCAT Mandaluyong) and a *WebSite*. This is how Google can show a rich result with your name and logo.
- **Keywords + description + canonical** — so the search result shows a proper title and summary.
- **Crawlable text fallback** — real text about the system that Google reads even before the app loads (important for React apps).

Deploy `tcims-update-v19.zip` first (delete the old `assets`, then Upload & Extract). Then confirm these open in a browser:
- https://tcimsmandaluyong.infinityfree.me/robots.txt
- https://tcimsmandaluyong.infinityfree.me/sitemap.xml

---

## The step only you can do — Google Search Console

Code alone does not put you on Google. You have to **tell Google the site exists**. This is free and takes about 10 minutes.

1. Go to **https://search.google.com/search-console** and sign in with your Gmail.
2. Click **Add property** → choose **URL prefix** → paste:
   `https://tcimsmandaluyong.infinityfree.me/`
3. **Verify ownership.** Pick the **HTML file** method:
   - Google gives you a file like `google1a2b3c4d.html` — download it.
   - Upload it to your **htdocs root** (same folder as index.html) via File Manager.
   - Click **Verify** back in Search Console.
4. Once verified, open **Sitemaps** in the left menu → enter `sitemap.xml` → **Submit**.
5. Use the **URL Inspection** bar at the top → paste your homepage URL → click **Request indexing**.

That last step is what actually gets you into Google — usually within a few days.

---

## Honest expectations

- **Searching your exact name** — "TCIMS Mandaluyong", "tcimsmandaluyong" — you should reach the **top result** once indexed, because nothing else uses that name. This is the realistic goal, and it's enough for your defense and for CCAT to find the site.
- **Generic terms** — "Mandaluyong tourism", "Mandaluyong heritage" — very hard, because you'd be competing with the official city government website and established sites. Ranking top 3 there takes months of content and backlinks; no one can promise it.
- **Timeline** — nothing appears instantly. Indexing takes **days to a couple of weeks** after you request it. Start now so it's live before your defense.
- **Two limits of your current setup:** the site is behind a login (Google can only index the public login page), and free hosting has no custom domain — a name like `ccat-mandaluyong.gov.ph` would rank far better, but that's the city's to register.

## Quick way to check progress

In Google, search:  `site:tcimsmandaluyong.infinityfree.me`

- **No results** = not indexed yet (be patient, or request indexing again).
- **Your pages listed** = you're in Google's index. Searching your name will now find you.
