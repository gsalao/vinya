# Handing the site to the studio

Two handovers, and they are different jobs. Do the first properly; the second is
mostly a conversation.

- **To the studio owner** — she needs to feel safe editing, and to know when to
  call you. Nothing technical.
- **To a developer** — they need `docs/architecture.md`, `docs/runbook.md`, and
  the credentials moved into their name.

---

## Before you hand over anything

### 1. Rotate the credentials that passed through setup

Three of them were transmitted over a chat during setup and should not be live
when someone else owns this. Steps in `docs/credentials.md`.

- The Supabase `service_role` key
- The GitHub dispatch token
- The initial admin password

### 2. Run `supabase/security.sql`, once

SQL Editor → New query → paste → Run. It creates the shared rate-limit
counter, creates the subscribers table (the original `schema.sql` was never
run against this project, so newsletter signups have been failing silently),
revokes the anonymous write path, and drops the publish sweep from every
minute to every five. Safe to run more than once.

Confirm it took: the logs should stop showing
`[ratelimit] shared counter unavailable`.

### 3. Set the spend caps

**This is the only hard guarantee against a surprise bill.** Everything in the
code limits abuse; only a cap limits the invoice.

- Vercel → Settings → Billing → Spend Management — hard limit plus an alert
  below it.
- Supabase → Organization → Billing → Cost Control — spend cap. Storage egress
  is the uncapped vector: every site image is a public URL.
- Point both alerts at an address the studio reads, not only yours.

### 4. Switch the monitoring on

It needs one repository variable to work at all:

- Settings → Secrets and variables → Actions → **Variables** → `SITE_URL`, the
  live URL.
- Optional, same page → **Secrets** → `ALERT_TO`, a developer's address for a
  direct mail. Without it, a failed run still emails whoever watches the repo,
  which is the channel that needs no setup.
- Do **not** point `ALERT_TO` at the studio owner. Nothing it reports is hers
  to act on.

Then Actions → Health check → Run workflow, and confirm it goes green.

Tell whoever inherits this: **GitHub disables scheduled workflows after 60 days
of repository inactivity.** Publishing content counts as activity, so a studio
that edits its site keeps the monitoring alive by doing nothing special. A
studio that goes quiet for two months gets an email asking to re-enable it, and
until someone clicks, nothing is watching.

### 5. Move ownership of the accounts

The site depends on four accounts. Whoever owns them controls the site, and if
they are all yours, the studio has a dependency on you forever.

| Account | What breaks without it |
| --- | --- |
| Supabase | Editing stops; the live site keeps serving |
| Vercel | Deploys stop; the live site keeps serving |
| GitHub | Publishing stops; the code is inaccessible |
| The domain | Everything |

The honest options are to transfer them to a studio-owned account, or to keep
them and be explicit that you are the studio's hosting provider. Either is fine.
Leaving it undecided is not — it is discovered at the worst moment.

### 6. Give her an account in her own name

Settings → Who can sign in. Add her address, tell her the starting password
yourself, and watch her change it. Then remove any account that was only ever
yours for setup.

### 7. Put something on the timetable that expires

`GH_DISPATCH_TOKEN` is a fine-grained PAT with a one-year expiry. When it lapses,
publishing stops with no warning and the failure is invisible from her side —
she edits, nothing happens. Put the renewal in a calendar that outlives your
involvement.

---

## Sitting down with the owner

Budget an hour. Do it on her own laptop, signed in as herself.

**Have her make three changes unaided while you watch.** Not demonstrated — she
does them, you say nothing unless she is stuck:

1. Change a paragraph on the home page
2. Add an event, then remove it
3. Replace a photo and drag it to reframe

Where she hesitates is where the wording is wrong. Fix `docs/owner-guide.md`
rather than explaining it verbally — you will not be there next time.

**Then break something on purpose.** Have her type `2026-09-05` into an event's
month and press save. She sees it refuse, sees the site is untouched, fixes it,
sees it publish. That one exercise does more for her confidence than anything you
can say: it proves the system protects her from herself.

**Point out the three things she cannot change**, and why: payment links, the
next-gathering band, and other people's passwords. Framing them as protections
rather than limitations matters.

**Leave her `docs/owner-guide.md`** somewhere she will find it again — printed,
emailed, or pasted into a document she owns. Not a link into this repository.

**Make sure she has the editor's address written down.** It is
`/vinyadmin`, not `/admin` — moved so that automated scanners stop probing it.
She will not guess it, and there is nothing at the old address to redirect her.

### What to tell her about calling you

Be concrete about the split, or she will either call about everything or nothing:

- **Anything she can type** — hers. Words, photos, prices, times, people.
- **The strip says a technical problem stopped the site updating** — yours.
- **Nothing happened five minutes after saving** — yours.
- **A new page, a new kind of section, a design change** — yours.

---

## Handing to another developer

Point them at, in order:

1. `docs/architecture.md` — how it works
2. `docs/runbook.md` — what to do when it is not working
3. `docs/adr/0001-cms-not-google-sheets.md` — why it is built this way, and what
   was tried first
4. `docs/credentials.md` — every secret, where it lives, when to rotate

Then say four things out loud, because they are the ones that bite:

- **The content file is generated.** Hand-editing
  `src/lib/content.generated.json` is undone by the next publish, and a
  round-trip test compares against it byte for byte.
- **`schema.mjs` is the only gate.** There is no review step between an edit and
  the live site. Weakening a rule there has consequences that show up on a real
  website.
- **Payment links and credentials never move into the database.** The reasoning
  is in the ADR; the boundary is enforced by construction and by a test.
- **The anon key is public.** It ships in the bundle, so anything granted to
  `anon` in Postgres is granted to the internet, reachable directly at
  PostgREST where no application rate limit can see it. A test enforces that no
  browser-reachable module holds a Supabase client.
- **Test UI changes in WebKit.** Partner logos rendered at full size on iPhone
  for days because every check was Chromium. Playwright ships the real engine.

### Their first day

Have them add one small field end to end — a column on an existing table, through
schema, shape, flatten, the admin, and out to the site. It touches every part of
the pipeline and takes under an hour. They will understand the system better than
any amount of reading achieves.

---

## What is not covered, and should be said plainly

**Monitoring is daily, not immediate.** The health check runs once a day and
covers the site responding, publishing being unblocked, and storage filling. If
the site goes down at 3am it is down until the next run, or until someone
looks. For a yoga studio that is a reasonable trade — but it is a trade, and it
should be a decision rather than a surprise. There is still no error tracking
and no per-request alerting.

**Photos are backed up monthly; nothing else is.** Content never needed it —
every publish is a commit, so git history is the backup. Uploaded photos are
copied by `.github/workflows/backup-images.yml` into a workflow artifact kept
90 days, roughly three generations. Restoring is
`node scripts/restore-images.mjs <dir> --apply`, and the site needs no change
because its URLs contain the filenames. See `docs/runbook.md`.

A backup does not help if storage fills up — that needs space, not a copy. The
health check warns at 80% of the limit, and every backup prints which files
nothing references, which are what to delete.

**One person can lock everyone out.** Removing the last account is blocked, but
someone with access can change the allow-list and the recipients. The previous
recipients are emailed on change, which makes it visible rather than preventable.
