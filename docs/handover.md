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

### 2. Move ownership of the accounts

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

### 3. Give her an account in her own name

Settings → Who can sign in. Add her address, tell her the starting password
yourself, and watch her change it. Then remove any account that was only ever
yours for setup.

### 4. Put something on the timetable that expires

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
- **Test UI changes in WebKit.** Partner logos rendered at full size on iPhone
  for days because every check was Chromium. Playwright ships the real engine.

### Their first day

Have them add one small field end to end — a column on an existing table, through
schema, shape, flatten, the admin, and out to the site. It touches every part of
the pipeline and takes under an hour. They will understand the system better than
any amount of reading achieves.

---

## What is not covered, and should be said plainly

**Nobody is watching the site.** There is no uptime monitoring, no alerting, no
error tracking. If it goes down at 3am, it is down until someone looks. That may
be entirely fine for a yoga studio — but it should be a decision, not a surprise.

**There are no backups beyond git.** Content is recoverable from history because
every publish is a commit. Uploaded photos are not: deleting one deletes it. The
Supabase project has whatever backups its plan includes and nothing more.

**One person can lock everyone out.** Removing the last account is blocked, but
someone with access can change the allow-list and the recipients. The previous
recipients are emailed on change, which makes it visible rather than preventable.
