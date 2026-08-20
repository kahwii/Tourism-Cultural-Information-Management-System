# Deploying the TCIMS backend on InfinityFree (free PHP + MySQL)

This makes your live Vercel frontend work from anywhere, without needing XAMPP running.

Two files are already prepared for you:
- `config/db.php` — auto-switches between local XAMPP and InfinityFree based on the credentials in `config/db_credentials.php`.
- `config/cors.php` — already allows any `*.vercel.app` frontend.

---

## Step 1 — Create the InfinityFree account and site
1. Go to https://infinityfree.com and **Sign Up** (free, no credit card).
2. In the client area, click **Create Account** (or "New Account").
3. Pick a free subdomain, e.g. `tcims-ccat` → you'll get something like
   `tcims-ccat.infinityfreeapp.com`. **Write down this domain.**
4. Wait a few minutes for the account to activate, then open its **Control Panel**.

## Step 2 — Create the MySQL database
1. In the Control Panel, open **MySQL Databases**.
2. Create a database named `tcims_db`. InfinityFree prefixes it, so the real name
   becomes something like `if0_38291045_tcims_db`.
3. On that page, note these 4 values:
   - **Database host** (e.g. `sql203.infinityfree.com`)
   - **Database name** (e.g. `if0_38291045_tcims_db`)
   - **Database username** (e.g. `if0_38291045`)
   - **Database password** (the account password)

## Step 3 — Put those 4 values into config/db_credentials.php
If `config/db_credentials.php` doesn't exist yet, copy `config/db_credentials.example.php` to `config/db_credentials.php`. Open it, find the `// ---- LIVE (InfinityFree) ----` section, and replace:
```php
$DB_HOST_LIVE = "sqlXXX.infinityfree.com";
$DB_USER_LIVE = "if0_XXXXXXXX";
$DB_PASS_LIVE = "YOUR_DB_PASSWORD";
$DB_NAME_LIVE = "if0_XXXXXXXX_tcims_db";
```
with your real values from Step 2. Save the file. `db_credentials.php` holds real secrets — don't commit it if this folder is ever put under version control (it's already listed in `.gitignore`).

## Step 4 — Copy your database over (export local, import live)
1. On your PC open **http://localhost/phpmyadmin** → click `tcims_db` on the left →
   **Export** tab → **Go**. Save the file `tcims_db.sql`.
2. In InfinityFree Control Panel → **phpMyAdmin** → click your `if0_..._tcims_db`
   database → **Import** tab → choose `tcims_db.sql` → **Go**.
   This recreates all your tables AND your existing data in one shot.

## Step 5 — Upload the backend files
1. In the Control Panel open **Online File Manager** (or use FTP with the FTP
   details shown under "FTP Accounts").
2. Enter the **`htdocs`** folder.
3. Create a folder named **`my-app-backend`** inside `htdocs`.
4. Upload the entire contents of your local `my-app-backend` folder into it
   (all the `api/`, `config/`, `.htaccess`, etc.), **including `config/db_credentials.php`**
   with your real live values from Step 3 — the app won't connect without it.
   You can skip the `.sql` files — they aren't needed on the server, but leaving them is harmless.
   - Your API is now at:
     `https://YOURSITE.infinityfreeapp.com/my-app-backend/api/...`

## Step 6 — Turn on free HTTPS (required)
Your Vercel site is `https://`, so the backend must be `https://` too, or the browser
blocks the calls.
1. Control Panel → **SSL Certificates** (or "Free SSL Certificates").
2. Issue a **Let's Encrypt** certificate for your domain and wait for it to go active
   (can take a few minutes to an hour).
3. Test in a browser: open
   `https://YOURSITE.infinityfreeapp.com/my-app-backend/api/crud.php?table=tourist_spots`
   — you should see JSON data (not a security error).

## Step 7 — Point the live frontend at the live backend
1. Go to your **Vercel** project → **Settings → Environment Variables**.
2. Edit **`VITE_API_HOST`** and change it to:
   `https://YOURSITE.infinityfreeapp.com/my-app-backend`
   (no trailing slash, and note it's **https**).
3. Go to **Deployments → … → Redeploy** so the change takes effect.

Done — your public Vercel link now works from any device, no laptop needed.

---

## Notes / known limits on the free tier
- **Username/password login, all directories, events, feedback, sentiment, check-ins,
  and reports work normally.**
- **Firebase "Continue with Google" may not work on InfinityFree's free tier**, because
  free hosting blocks the outgoing connection the backend uses to verify Google tokens.
  If you need Google sign-in in the live demo, keep using the local (XAMPP) setup for that
  part, or move the backend to a host that allows outbound connections later.
- InfinityFree sleeps idle sites briefly and has daily limits — fine for a thesis demo,
  not for heavy traffic.
