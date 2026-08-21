// Central API helper for the TCIMS backend (raw PHP @ XAMPP).
// Configurable via .env (VITE_API_HOST); falls back to local XAMPP.
const HOST = import.meta.env.VITE_API_HOST || "http://localhost/my-app-backend";
const BASE = `${HOST}/api`;

// Read the logged-in user's API token from localStorage.
function authHeaders() {
  try {
    const u = JSON.parse(localStorage.getItem("user"));
    return u && u.api_token ? { Authorization: `Bearer ${u.api_token}` } : {};
  } catch {
    return {};
  }
}

async function handle(res) {
  // session expired / invalid token -> force re-login
  if (res.status === 401) {
    localStorage.removeItem("user");
    if (!location.pathname.startsWith("/login")) location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
  }
  return data;
}

const jsonHeaders = () => ({ "Content-Type": "application/json", ...authHeaders() });

// Free hosting (InfinityFree) occasionally hiccups on the very first request to
// a cold/idle site — the request either times out or comes back as a non-JSON
// interstitial page, which makes fetch()/res.json() throw even though the
// server is actually fine a moment later. Rather than surfacing "Could not
// connect to server" immediately (which used to force users to manually
// refresh), auth screens retry once, silently, before giving up.
export async function fetchJsonRetry(url, options, retries = 2, baseDelayMs = 1500) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, options);
      let data = null;
      try { data = await res.json(); } catch { throw new Error("Bad response from server"); }
      return { res, data };
    } catch (err) {
      if (attempt >= retries) throw err;
      // Back off a bit longer each retry (1.5s, then 3s) — a cold InfinityFree
      // instance can take a few seconds to wake up on the very first hit.
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
}

// ---- Generic CRUD (crud.php) ----
export async function apiList(table) {
  return handle(await fetch(`${BASE}/crud.php?table=${table}`, { headers: authHeaders() }));
}
export async function apiGet(table, id) {
  return handle(await fetch(`${BASE}/crud.php?table=${table}&id=${id}`, { headers: authHeaders() }));
}
export async function apiCreate(table, data) {
  return handle(await fetch(`${BASE}/crud.php?table=${table}`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify(data)
  }));
}
export async function apiUpdate(table, id, data) {
  return handle(await fetch(`${BASE}/crud.php?table=${table}&id=${id}`, {
    method: "PUT", headers: jsonHeaders(), body: JSON.stringify(data)
  }));
}
export async function apiRemove(table, id) {
  return handle(await fetch(`${BASE}/crud.php?table=${table}&id=${id}`, {
    method: "DELETE", headers: authHeaders()
  }));
}

// ---- Certificate documents (file upload) ----
// Upload one file (multipart). Do NOT set Content-Type; the browser adds the boundary.
export async function apiUploadDoc(certificateId, docType, file) {
  const fd = new FormData();
  fd.append("certificate_id", certificateId);
  fd.append("doc_type", docType);
  fd.append("file", file);
  return handle(await fetch(`${BASE}/upload_doc.php`, {
    method: "POST", headers: authHeaders(), body: fd
  }));
}
export async function apiCertDocs(certificateId) {
  return handle(await fetch(`${BASE}/cert_docs.php?certificate_id=${certificateId}`, { headers: authHeaders() }));
}
// Build a full URL to an uploaded file from its stored_path.
export const fileUrl = (storedPath) => `${HOST}/${storedPath}`;

// ---- Tourist feedback (sentiment computed server-side) ----
export async function apiFeedbackCreate({ place, rating, comment }) {
  return handle(await fetch(`${BASE}/feedback.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify({ place, rating, comment })
  }));
}
export async function apiFeedbackMine() {
  return handle(await fetch(`${BASE}/feedback.php`, { headers: authHeaders() }));
}

// ---- Tourist check-ins (visits) ----
export async function apiVisitsMine() {
  return handle(await fetch(`${BASE}/visits.php`, { headers: authHeaders() }));
}
export async function apiVisitToggle(place) {
  return handle(await fetch(`${BASE}/visits.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify({ place })
  }));
}
// Heritage Trail check-in with 2 photo proofs (selfie + on-site).
export async function apiCheckinWithPhotos(place, selfieFile, siteFile) {
  const fd = new FormData();
  fd.append("place", place);
  fd.append("selfie", selfieFile);
  fd.append("site", siteFile);
  return handle(await fetch(`${BASE}/checkin.php`, {
    method: "POST", headers: authHeaders(), body: fd
  }));
}

// ---- Trail completion reward (Heritage Mug) ----
export async function apiRewardMine() {
  return handle(await fetch(`${BASE}/claim_reward.php`, { headers: authHeaders() }));
}
export async function apiRewardClaim() {
  return handle(await fetch(`${BASE}/claim_reward.php`, { method: "POST", headers: jsonHeaders() }));
}

// ---- Heritage Trail completion certificate ----
export async function apiCertificateStatus() {
  return handle(await fetch(`${BASE}/certificate.php`, { headers: authHeaders() }));
}
export async function apiCertificateEmail(email) {
  return handle(await fetch(`${BASE}/certificate.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify(email ? { email } : {})
  }));
}

// ---- Admin: create a staff/admin account (with password) ----
export async function apiAdminCreateUser(data) {
  return handle(await fetch(`${BASE}/admin_create_user.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify(data)
  }));
}

// ---- Google OAuth sign-in ----
export async function apiGoogleLogin(credential) {
  return handle(await fetch(`${BASE}/google_login.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential })
  }));
}
// ---- Firebase sign-in (verifies the Firebase ID token server-side) ----
export async function apiFirebaseLogin(idToken, role = "Tourist") {
  return handle(await fetch(`${BASE}/firebase_login.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, role })
  }));
}
// ---- Server-side logout: clears api_token so it can't be reused after
// the user has explicitly signed out (see AuthContext.jsx). Fire-and-forget
// from the caller's point of view — the local session clears either way. ----
export async function apiLogout() {
  try {
    await fetch(`${BASE}/logout.php`, { method: "POST", headers: authHeaders() });
  } catch { /* local logout still proceeds even if this fails */ }
}
// ---- Set / change the logged-in user's password ----
export async function apiSetPassword(password) {
  return handle(await fetch(`${BASE}/set_password.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ password })
  }));
}
// ---- Admin resets a user's password (admin-assisted, backup) ----
export async function apiAdminResetPassword(userId, password) {
  return handle(await fetch(`${BASE}/admin_reset_password.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ user_id: userId, password })
  }));
}
// ---- Self-service email password reset ----
export async function apiForgotPassword(email) {
  return handle(await fetch(`${BASE}/forgot_password.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  }));
}
export async function apiResetPasswordCode(email, code, password) {
  return handle(await fetch(`${BASE}/reset_password_code.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, password })
  }));
}
// ---- Admin 2-step login PIN ----
export async function apiSetAdminPin(pin, action = "set") {
  return handle(await fetch(`${BASE}/set_admin_pin.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ pin, action })
  }));
}
// ---- Profile picture ----
export async function apiUploadAvatar(file) {
  const fd = new FormData();
  fd.append("avatar", file);
  return handle(await fetch(`${BASE}/upload_avatar.php`, {
    method: "POST", headers: authHeaders(), body: fd
  }));
}
export async function apiRemoveAvatar() {
  return handle(await fetch(`${BASE}/upload_avatar.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify({ action: "remove" })
  }));
}
// ---- Event poster/banner image (admin) ----
export async function apiUploadEventImage(file, oldImage) {
  const fd = new FormData();
  fd.append("image", file);
  if (oldImage) fd.append("old_image", oldImage);
  return handle(await fetch(`${BASE}/upload_event_image.php`, {
    method: "POST", headers: authHeaders(), body: fd
  }));
}
// ---- Tourist Spot / Heritage Site photo (admin) ----
export async function apiUploadPlaceImage(folder, file, oldImage) {
  const fd = new FormData();
  fd.append("folder", folder);
  fd.append("image", file);
  if (oldImage) fd.append("old_image", oldImage);
  return handle(await fetch(`${BASE}/upload_place_image.php`, {
    method: "POST", headers: authHeaders(), body: fd
  }));
}
// ---- Certificate pickup notification (admin -> establishment) ----
export async function apiNotifyPickup(certificateId) {
  return handle(await fetch(`${BASE}/notify_pickup.php`, {
    method: "POST", headers: jsonHeaders(),
    body: JSON.stringify({ certificate_id: certificateId })
  }));
}
// ---- Unclaimed-certificate 30/60/90-day pickup reminders (admin, best-effort) ----
export async function apiCheckPickupReminders() {
  return handle(await fetch(`${BASE}/check_pickup_reminders.php`, { headers: authHeaders() }));
}
// ---- Re-run sentiment on all existing reviews (admin) ----
export async function apiReclassifySentiment() {
  return handle(await fetch(`${BASE}/reclassify_sentiment.php`, {
    method: "POST", headers: jsonHeaders()
  }));
}
// ---- Bulk-import historical/manual feedback rows (admin) ----
// rows: [{ place, reviewer, rating, comment, date }, ...] — sentiment is scored server-side.
// batch: shared id across chunks of the same file, so it can be undone as one unit.
export async function apiImportReviews(rows, batch) {
  return handle(await fetch(`${BASE}/import_reviews.php`, {
    method: "POST", headers: jsonHeaders(), body: JSON.stringify({ rows, batch })
  }));
}
// ---- Past import batches (admin): list, and delete a whole batch at once ----
export async function apiImportBatches() {
  return handle(await fetch(`${BASE}/import_batches.php`, { headers: authHeaders() }));
}
export async function apiDeleteImportBatch(batch) {
  return handle(await fetch(`${BASE}/import_batches.php`, {
    method: "DELETE", headers: jsonHeaders(), body: JSON.stringify({ batch })
  }));
}
// ---- Notify the staff member who submitted an event of the approval decision ----
export async function apiNotifyEventDecision(eventId) {
  return handle(await fetch(`${BASE}/notify_event_decision.php`, {
    method: "POST", headers: jsonHeaders(),
    body: JSON.stringify({ event_id: eventId })
  }));
}
// ---- PUBLIC events feed (no login required) ----
export async function apiPublicEvents() {
  return handle(await fetch(`${BASE}/public_events.php`));
}
// ---- Visitor inquiries ----
// Submitting is public; listing and replying are admin-only.
export async function apiInquirySubmit(data) {
  return handle(await fetch(`${BASE}/inquiries.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }));
}
export async function apiInquiries() {
  return handle(await fetch(`${BASE}/inquiries.php`, { headers: authHeaders() }));
}
// Small, cheap count for the sidebar badge (polled on admin page loads).
export async function apiInquiryCount() {
  return handle(await fetch(`${BASE}/inquiry_count.php`, { headers: authHeaders() }));
}
export async function apiInquiryReply(id, reply) {
  return handle(await fetch(`${BASE}/inquiries.php`, {
    method: "PUT", headers: jsonHeaders(), body: JSON.stringify({ id, reply })
  }));
}
// ---- Admin activity log (audit trail) ----
export async function apiActivityLog() {
  return handle(await fetch(`${BASE}/activity_log.php`, { headers: authHeaders() }));
}
// ---- Security-question password recovery (no email needed) ----
export async function apiGetSecurityQuestion(username) {
  return handle(await fetch(`${BASE}/get_security_question.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  }));
}
export async function apiResetWithAnswer(username, answer, password) {
  return handle(await fetch(`${BASE}/reset_with_answer.php`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, answer, password })
  }));
}

export { BASE, HOST };
