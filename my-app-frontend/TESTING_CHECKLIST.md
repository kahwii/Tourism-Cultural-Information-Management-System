# TCIMS — Testing Checklist

Live site: **https://tcimsmandaluyong.infinityfree.me**
Deploy this build first: `tcims-update-v14.zip` (delete the old `assets` folder, then Upload & Extract, then Ctrl+Shift+R).

---

## Already verified automatically

These were tested in an automated browser environment — you do **not** need to re-check them:

| Check | Result |
|---|---|
| All 20 pages render without crashing (admin, tourist, establishment, login, register, 404) | 20/20 pass |
| Styled confirm dialog opens, Cancel closes it | pass |
| Login shows the PIN step when the server requires it | pass |
| Sentiment page renders word cloud, per-place chart, place table | pass |
| Activity Log renders entries | pass |
| 404 page renders for unknown URLs | pass |
| Pagination: 25 rows/page, Next/page numbers work, last page shows remainder | 11/11 pass |
| Filtering never strands you on an empty page | pass |
| No undefined variables anywhere (ESLint `no-undef`) | clean |

---

## Needs your hands — things a machine can't test

Tick each box as you go. If something fails, note what you saw.

### A. Admin portal

- [ ] **Sign in** as `admin1` — dashboard loads, numbers look right
- [ ] **Security PIN**: click *Security* → set a 6-digit PIN → log out → log in again → it asks for the PIN
- [ ] Wrong PIN is rejected; correct PIN gets you in
- [ ] Turn the PIN **off** again → next login does not ask for it
- [ ] **Certificates**: open one, Approve it → toast says the pickup notice was sent
- [ ] The establishment receives the **email** (check spam folder too)
- [ ] **Notify** button re-sends the notice
- [ ] **Delete** on a certificate → styled dialog appears (not the browser's grey box) → Cancel works → Delete works
- [ ] **Activity Log** shows your approve/delete/login actions with correct timestamps
- [ ] **Pagination** appears once a table passes 25 rows
- [ ] **Sentiment Analysis**: word cloud shows real words, per-place bars match the reviews
- [ ] **Reports**: export PDF / Excel / CSV — files open and contain data
- [ ] **User Management**: create a user, reset a password, delete a test account
- [ ] **Events / Heritage Sites / Tourist Spots**: add, edit, delete each one

### B. Tourist portal

- [ ] **Register** a new tourist account — password rules enforced (upper, lower, number, symbol)
- [ ] Security question is required at registration
- [ ] **Forgot password** → answer the security question → new password works
- [ ] **Explore**: place photos load; clicking a card opens the detail modal **centred on screen** (this was the bug we fixed)
- [ ] **Check-in** with GPS — must be near the place
- [ ] **Photo check-in**: camera opens, selfie + site photo submit successfully
- [ ] Points and tier update after a check-in
- [ ] **Trail**: progress bar reflects visited places
- [ ] **Feedback**: submit a review → it appears in the admin Sentiment page with the right sentiment label
- [ ] Try a Tagalog negative comment (e.g. *"Marumi at mabagal ang serbisyo"*) → shows as **Negative**
- [ ] Try a negation (e.g. *"Hindi malinis"*) → shows as **Negative**
- [ ] **Nawasa Old Water Tank is gone** from the places list

### C. Establishment portal

- [ ] **Register** an establishment account — password + security question enforced
- [ ] Submit an accreditation application
- [ ] Upload each required document — they save and can be viewed
- [ ] After admin approval: dashboard shows the **pick-up notice** with control no., OR no., and office hours
- [ ] No "download certificate" button anywhere (it's pick-up only now)

### D. Cross-cutting

- [ ] **Mobile phone**: log in with username + password; layout is usable; menus open
- [ ] Login page on phone shows the compact form (no left panel)
- [ ] **Favicon**: CCAT seal shows in the browser tab (hard-refresh first)
- [ ] **Link preview**: paste the site link in Messenger → title, description, and logo appear
- [ ] **404**: type a wrong URL like `/asdf` → styled 404 page with a working back button
- [ ] **Lockout**: enter a wrong password 5 times → account locks for 15 minutes
- [ ] Sign out from each portal → returns to login, and the back button doesn't leak the dashboard

---

## If something breaks

Note these three things and send them over:

1. Which page and what you clicked
2. What you expected vs what happened
3. Press `F12` → **Console** tab → screenshot any red error lines

That's usually enough to pinpoint it exactly.
