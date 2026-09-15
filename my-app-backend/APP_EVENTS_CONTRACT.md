# Submitting events from the mobile app (CCAT Staff → admin approval)

This is the contract the Flutter app codes against. The approval workflow already
exists on the web side and is not something the app has to implement — the app's
only job is to POST the event with a CCAT Staff token. Everything below is
enforced in `api/crud.php`; nothing here is aspirational.

## What the flow looks like

1. A CCAT Staff member fills the event form in the app and submits.
2. The row lands in `events` with `approval_status = 'Pending'` and
   `submitted_by = <that staff user's id>`.
3. It is **invisible to the public** — tourists, the website's public events
   page, and unauthenticated `GET crud.php?table=events` all filter to
   `approval_status = 'Approved'`.
4. It appears in the admin Events screen with a yellow **Pending / Not yet
   public** badge and ✓ / ✗ action buttons.
5. A Super Admin or CCAT Admin approves (goes public) or rejects (stays hidden,
   with remarks). `approved_by` records who acted.

An admin adding an event directly skips straight to step 5 — they are their own
approver.

## Endpoint

```
POST {API_HOST}/api/crud.php?table=events
Authorization: Bearer <api_token>
Content-Type: application/json
```

The token is the one `login.php` already returns. No separate endpoint, no
separate credential.

## Request body

| Field | Type | Notes |
|---|---|---|
| `name` | string | **Required.** Event title as it will appear publicly. |
| `event_date` | string | **Required.** `YYYY-MM-DD`. |
| `start_time` | string | `HH:MM:SS` (24-hour). Send `""` for none. |
| `end_time` | string | `HH:MM:SS`. Send `""` for none — stored as NULL. |
| `month` | string | Full month name, e.g. `September`. Used by the calendar grouping. |
| `category` | string | e.g. `Festival`, `Sports`, `Cultural`, `Civic`. |
| `venue` | string | Free text. |
| `description` | string | Free text. |
| `status` | string | `Upcoming` / `Ongoing` / `Completed`. |
| `image` | string | Relative upload path, same convention as the web uploader. Optional. |
| `participants` | int | **Leave out at creation.** This is actual attendance, filled in after the event. |
| `post_event_report` | string | **Leave out at creation.** See below. |

Empty string is stored as NULL, so optional fields can be sent as `""` rather
than omitted.

## Fields the app must NOT send

- `approval_status` — silently overwritten to `Pending` for CCAT Staff. Sending
  `Approved` does not work; it is not an error, it is simply ignored.
- `approval_remarks` — approver-only. Stripped from staff requests.
- `submitted_by`, `approved_by` — stamped by the server.
- `reported_at` — stamped by the server the moment a post-event report is saved,
  so the record reflects when CCAT received it, not the phone's clock.
- `id` — auto-increment.

## Response

```json
{ "success": true, "id": 42 }
```

On failure: HTTP 4xx/5xx with `{ "error": "..." }`. Worth handling explicitly:

- **401** — token missing, expired, or the header was stripped. Re-login.
- **403** — the account is not staff/admin (e.g. a Tourist account).
- **400** — `{"error":"No valid fields."}` means every key in the body was
  outside the whitelist. Usually a typo in a field name.

## Editing an event from the app

```
PUT {API_HOST}/api/crud.php?table=events&id=<id>
```

Same body rules. One behaviour to surface in the UI: **a CCAT Staff edit resets
the event to `Pending`**, even if it had already been approved. That is
deliberate — an approved event whose date or venue changed has not been reviewed
in its new form. Tell the user before they save: "Kailangan ulit ng approval
kapag binago mo ito."

## Post-event report

After the event has run, the same PUT carries:

```json
{ "post_event_report": "Maayos ang takbo ng programa...", "participants": "143" }
```

`participants` means **actual attendance recorded after the event**, not an
expected or target figure. The column existed in the schema but nothing read or
wrote it, so it was free to define — it has to mean one thing on both the app and
the website or the two will drift.

Saving a non-empty report stamps `reported_at = NOW()`. Clearing the report
clears the stamp, so "`reported_at` is set" always means "there is a report".

## Reading events back in the app

```
GET {API_HOST}/api/crud.php?table=events
```

- **With a staff/admin token:** returns everything, including Pending and
  Rejected, so the staff member can see their own submission waiting for review.
  Read `approval_status` to render the status chip.
- **Without a token:** only `Approved` rows. This is the correct call for the
  public/tourist side of the app.

## Migrating off Firestore

Any events currently living only in Firestore need to be inserted through the
POST above, otherwise they will not exist to the website, the admin approval
screen, or the reports. Worth checking the Firebase console for rows that
predate this endpoint.
