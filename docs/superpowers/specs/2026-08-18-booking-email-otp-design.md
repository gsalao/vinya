# Booking by email, with verified senders

**Date:** 2026-08-18
**Status:** approved, ready to implement

## Problem

The booking form writes to Supabase, or — with no Supabase configured — simulates
a submit and says so in a banner. Nobody is notified either way. The studio wants
booking requests to arrive as email, with the sender's address verified first so
the owner's inbox is not a target for fake bookings, and with proof of payment
attached when someone has already paid by Tikkie.

## Constraints

- No database. Storage the studio has to administer is explicitly out of scope.
- No custom domain, so no domain-verified mail sender (Resend, Postmark) is
  available. Mail goes out through the studio's existing mailbox over SMTP.
- Vercel serverless: no shared memory between instances, 4.5 MB request body cap.

## Why there is server-side code at all

The brief asked for the verification code to live in the browser. It cannot. A
code generated and checked in client JavaScript verifies nothing — the value is
readable in devtools, and the function that mails the owner can be called
directly, skipping the check. The SMTP password has the same problem: anything in
the client bundle is public.

SvelteKit `+server.js` endpoints run as Vercel serverless functions with access
to private environment variables. That gives somewhere to keep a secret and run a
comparison, without introducing a database.

## Design

### Stateless OTP

`POST /api/otp` generates a six-digit code, mails it to the visitor, and returns
a signed token:

```
payload   = base64url(JSON { email, exp })
signature = HMAC-SHA256(payload + "." + code, OTP_SECRET)
token     = payload + "." + signature
```

The code never appears in the token, in any form. It exists only in the
visitor's inbox and, briefly, in server memory. `POST /api/booking` recomputes
the signature from the code the visitor typed; a match proves they read the mail.

This is what makes "no database" possible: there is no pending-verification
record to keep, because the token carries its own proof.

**Accepted limitation.** Statelessness costs a server-side attempt counter. A
six-digit code inside a ten-minute window is guessable given enough requests. The
mitigations are the short expiry, the rate limiter, and the low value of the
target (booking a yoga class under someone else's address). A hard counter needs
a shared store — Vercel KV was offered and declined for good reason at this size.
If bookings ever carry money or personal data, revisit this first.

### Mail

Two messages per booking: the code to the visitor, the request to the owner.

Both are sent from the studio mailbox. Sending *as* the visitor would fail SPF
and land in spam, so the owner's copy sets `Reply-To` to the visitor instead —
replying in any mail client reaches the person who booked.

Recipients come from `MAIL_TO` (comma-separated) and optional `MAIL_CC`, so
adding a stakeholder is an environment-variable change, not a deploy.

Subject is `[VINYA] <what they chose to join>`. Body is fixed-field plain text
plus an HTML alternative:

```
Name / Email / Mode of Payment / Sessions (with date, time, location) / Notes
```

`Mode of Payment` is derived, never free text:

| Pass choice        | Method  | Renders as                                        |
| ------------------ | ------- | ------------------------------------------------- |
| a priced pass      | Tikkie  | `Tikkie €90 — 10-class pass (receipt attached)`    |
| a priced pass      | Tikkie  | `Tikkie €90 — 10-class pass (no receipt)`          |
| a priced pass      | Cash    | `Cash on arrival (€90 due)`                        |
| already have a pass| —       | `Existing pass — nothing due`                      |

### Receipts

Attached directly to the owner's mail; no bucket, no links to expire. Phone
photos routinely exceed the 4.5 MB body cap, so images are downscaled in the
browser (canvas, longest edge 1600 px, JPEG q0.82) before upload. PDFs are passed
through and rejected over 4 MB.

The server sniffs magic bytes rather than trusting the declared content type, and
accepts only JPEG, PNG, WebP and PDF. The file is streamed into the attachment
and never written to disk.

### Abuse

- Honeypot field. Filled in means a bot: return a plausible success, send nothing.
- Per-IP and per-email caps on `/api/otp`.

**Accepted limitation.** Serverless instances do not share memory, so the cap is
per-instance and a distributed attacker gets more attempts than the number
suggests. It stops casual scripted abuse, which is the realistic threat here.

### Cross-site submission

`/api/booking` takes `multipart/form-data`, which SvelteKit's built-in
`csrf.checkOrigin` covers: a POST of that content type is rejected unless the
`Origin` header matches the site. A form on another domain therefore cannot post
a booking, and the protection costs nothing to keep. Verified in a production
build — without an `Origin` header the request is refused before reaching the
handler; with a matching one it proceeds, which is what a browser always sends
for a same-origin request.

Worth remembering when testing with `curl`: a bare `curl -F` looks like a
cross-site post and is refused. Add `-H "Origin: <site>"` to mimic a browser.

### Fail closed

Missing `OTP_SECRET` or mail configuration makes both endpoints return an error.
They never fall back to accepting a booking that was not verified, and never
report success for mail that was not sent. This is the same principle the current
code already applies to simulated submits: never claim a place is held when
nothing reached the backend.

## Form flow

1. **Details** — today's screen, plus pass, payment method, an inline pay panel
   when Tikkie is chosen, and a receipt box under it.
2. **Verify** — replaces step 1. Code entry, resend with a cooldown.
3. **Done** — the existing confirmation.

The prototype banner is removed here, and not before: deleting it while the form
still goes nowhere would make the form lie.

## Testing

`vitest` is added. The token signing, expiry, tamper rejection, file sniffing and
rate limiter get real unit tests — this is auth-adjacent code and clicking
through it by hand is not evidence. The form flow is checked in a headless
browser across viewports, as with the payment work.

## Out of scope

- The newsletter keeps its existing Supabase path. Only `booking_requests` goes.
- No booking record is kept anywhere. The owner's mailbox is the record.
