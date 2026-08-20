# The spreadsheet as the site's content system

> **Historical.** Google Sheets was never used in production — creating a
> Google Cloud project on this account proved impossible. See
> `docs/adr/0001-cms-not-google-sheets.md`. This document is superseded by `2026-08-20-vinya-cms-design.md`.
> Kept for the reasoning it records; do not follow its steps.

**Date:** 2026-08-19
**Status:** designed, awaiting review
**Supersedes:** `2026-08-18-sheets-cms-design.md`, which scoped `data.js` only and
chose a manual Publish button. This document keeps its reasoning about rebuilds,
payment links and validation, and extends it to all site copy, a debounced
auto-publish, editable mail settings, and bookings written back to the sheet.

## Problem

The site is being handed to its owner, who does not write code. Today a class
time, an event, a price or a typo all require opening a code editor and pushing a
commit. Worse, most of the site's prose is not even in `src/lib/data.js` — it is
written inline in the `.svelte` markup, so a large share of the words on the site
cannot be changed without reading Svelte.

The goal is that the owner runs the site's content herself, indefinitely, and the
only reason to contact the developer is genuinely technical: traffic, latency,
an attack, a broken deploy.

## What the owner must be able to change

Everything textual and editorial: headlines and body copy on every page, the
class list, the timetable, events, FAQs, offerings, teacher profiles, partner
logos, testimonials, price labels and amounts, venue name and address, and who
receives booking notifications. Photos, once Phase 4 lands.

## What she must not be able to change

Payment URLs and the QR codes generated from them, and any credential. Reasoning
in "The payment boundary" and "Secrets" below.

## Constraints

- The editor is non-technical. Anything that fails silently, or that needs an
  error message read to recover from, has failed.
- Content is compiled into the bundle, so a content change means a rebuild.
- Deploys run through `.github/workflows/deploy.yml` on push to `main`. Content
  updates reuse that workflow rather than standing up a second deploy path.
- **The repository is public** (`github.com/gsalao/vinya`). Anything the pipeline
  commits is world-readable forever, including git history.
- The site renders Tikkie payment links and QR codes. The CSP in
  `svelte.config.js` exists specifically to stop those being swapped.

## Key decisions

### Rebuild, not runtime fetch

The alternative is fetching the sheet per request and caching it. It updates
faster and needs no commit, and it is wrong here.

A runtime fetch makes Google Sheets a hard dependency of page rendering. When the
sheet is slow, unavailable, or left mid-edit with a half-typed row, that is what
visitors see. There is no review step and no way back except editing again
correctly.

Going through a commit inverts all of it: content is versioned, a bad edit is
`git revert`, the built site has no runtime dependency on Google, and there is a
place to run validation *before* anything ships. The cost is roughly ninety
seconds between the last edit and the change being live. For a studio timetable
that is not a real cost.

### Debounced auto-publish, with a manual override

The superseded design chose a Publish menu item, on the grounds that an
edit-driven sync fires per cell and would queue dozens of deploys.

A debounce answers that objection directly: each edit cancels the pending timer
and arms a new one, so a burst of edits produces exactly one deploy thirty
seconds after the last of them. It is also better for the owner, who does not
have to remember a step for her work to appear.

What is genuinely lost is the review moment. Under a Publish button, the owner
asserts "this is finished". Under a debounce, a half-written row that sits
untouched for thirty seconds ships. Schema validation (below) is therefore the
only gate, and it has to be good. A `Publish now` menu item stays, for shipping
without waiting.

### The Action pulls; Apps Script only fires an event

Apps Script could push the content inside the `repository_dispatch` payload,
avoiding a service account. But status write-back into the sheet and the
inquiries lane both need a service account with write access regardless, so it
has to exist either way.

Given that, having the Action read the sheet directly is strictly better: no
payload size ceiling, the serialisation and validation logic lives in the repo
where it is testable with vitest, and the Apps Script project stays about twenty
lines. That matters for the token: anyone who can edit the Script project can
read whatever is in its Script Properties, so it should hold the weakest
credential that works — a fine-grained PAT scoped to dispatch on one repo.

### Three lanes, because they have different trust levels

```
LANE A — content (public, versioned, committed)
  Sheet ──edit──▶ Apps Script debounce 30s ──▶ repository_dispatch
                                                    │
                                      GitHub Action ├─ read tabs (service account)
                                                    ├─ validate against schema
                                                    ├─ write src/lib/content.generated.json
                                                    ├─ Drive photos → sharp → static/images/
                                                    ├─ commit + vercel deploy --prod
                                                    └─ write Status cell ──▶ back to sheet

LANE B — settings (never committed)
  Settings tab ──same dispatch──▶ Action ─┬─ notify PREVIOUS recipients of the change
                                          └─ vercel env rm/add MAIL_TO → redeploy

LANE C — inquiries (runtime, opposite direction)
  Visitor books ──▶ /api/booking ──▶ email owner (unchanged)
                                └──▶ append row to Inquiries tab (service account)
```

Lane B exists only because the repo is public. Committing `MAIL_TO` into a
generated JSON would publish the owner's address to every scraper on GitHub, and
git history would keep it there after any correction. Routing settings through
`vercel env` keeps them out of the repository entirely.

## Components

| File | Change |
| ---- | ------ |
| `src/lib/content.generated.json` | New. Written by the Action, committed, never hand-edited |
| `src/lib/data.js` | Becomes a thin reader over that JSON. Keeps `locationOf`, `eventLabel`, `bookOptions`, `isOneToOne`, `priceById` as derived code, and keeps `pay.url`/`pay.qr` hardcoded |
| `src/lib/copy.js` | New. Keyed prose accessor and the newline-to-paragraph splitter |
| `src/lib/copy-manifest.js` | New. Every copy key the markup uses. The contract between markup and sheet |
| `scripts/sync-content.mjs` | New. Sheet read, validation, JSON and image emit |
| `scripts/lib/schema.mjs` | New. Per-tab schemas. The load-bearing part |
| `scripts/lib/sheets.mjs` | New. Service-account client, read and status write-back |
| `scripts/seed-sheet.mjs` | New, run once. Exports today's content into the spreadsheet so nothing is retyped |
| `.github/workflows/deploy.yml` | Add `repository_dispatch`; fix `VERCEL_ENV`/`PROD_FLAG`; separate concurrency group for content runs |
| `src/routes/api/booking/+server.js` | Append to the Inquiries tab after the mail send, failure-tolerant |
| Apps Script project | New. Debounce timer, dispatch, `Publish now` menu item |

## Tabs

### Content lane

| Tab | Columns |
| --- | ------- |
| `copy` | `key`, `text`, `where` |
| `classes` | `name`, `tone`, `meta`, `blurb`, `provider` |
| `timetable` | `day`, `time`, `class`, `duration` |
| `events` | `month`, `day`, `weekday`, `name`, `detail`, `blurb`, `remaining` |
| `offerings` | `category`, `name`, `note` |
| `faqs` | `question`, `answer` |
| `teachers` | `slug`, `name`, `role`, `intro`, `highlights`, `photo`, `alt`, `fx`, `fy`, `ctaLabel`, `ctaOption` |
| `partners` | `name`, `logo`, `href`, `height` |
| `providers` | `key`, `name`, `address` |
| `prices` | `id`, `label`, `amount`, `note`, `feature` |
| `testimonials` | `quote`, `who` |
| `photos` | `key`, `driveFile`, `alt`, `fx`, `fy`, `fyMobile` (Phase 4) |

`timetable` and `offerings` are flat and grouped by the sync script, because a
spreadsheet is bad at nesting and an owner should not have to maintain a shape.

`where` on the `copy` tab is a human hint — "Home page, big headline" — that the
build ignores. It is what makes the tab navigable by someone who has never seen
the site's source.

### Settings lane

`Settings`, as `key`/`value` rows: `MAIL_TO`, `MAIL_CC`, `MAIL_FROM`.

### Machine tabs

`Status`, written by the Action. `Inquiries`, appended by `/api/booking`. Both
carry protected ranges so the owner cannot edit them by accident, and the Apps
Script debounce ignores edits to them so a status write cannot trigger a deploy.

## Multi-paragraph cells

The owner writes a long passage in one cell, using Alt+Enter for line breaks. She
should not have to know whether one break or two makes a new paragraph.

```js
// src/lib/copy.js
// Alt+Enter inside a cell, or a blank line, both mean "new paragraph".
// Split on any run of newlines so the owner does not have to know which.
export const paras = (s) =>
	String(s ?? '').split(/\r?\n\s*\r?\n|\r?\n/).map((p) => p.trim()).filter(Boolean);
```

Rendered as `{#each paras(copy['about.founder.body']) as p}<p>{p}</p>{/each}`.

Never `{@html}`. Sheet content is untrusted the moment more than one person can
edit the sheet, and a pasted `<script>` tag must render as visible text rather
than execute. This costs nothing: the owner has no use for raw HTML, and the
paragraph splitter covers the only formatting she actually needs.

## Drift that gets fixed as part of this

Three places where the same fact is written twice today. Each becomes worse under
a spreadsheet, because the owner would edit one copy and the other would silently
stay stale.

- **The next-gathering band**, `src/routes/+page.svelte:180`, hardcodes
  "Saturday 19:00 · 90 minutes · €28 · Location to be confirmed. Slow flow as the
  light goes, then sound to close." The event it describes, `data.js:110`, says
  "19:00 · 90 min · €28 · Location to confirm" and "…then bowls and voice to
  close." They have already drifted. The band becomes derived from
  `events[0].items[0]`.
- **The Vinya lede** appears identically at `src/routes/+page.svelte:133` and
  `src/routes/about/+page.svelte:26`. One key, referenced twice.
- **`events[].n`** ("2 gatherings") is `items.length` written out by hand. It
  becomes derived; adding an event should not also mean updating a counter.

Testimonials at `src/routes/+page.svelte:194-196` are hardcoded with no `data.js`
entry at all, and become their own tab.

## Derived, never in the sheet

`bookOptions`, `eventLabel()`, `locationOf()`, `priceById`, `isOneToOne`,
`events[].n`, the next-gathering band, and `pay.url`/`pay.qr`.

Every one of these is a place where a second hand-typed copy silently breaks
something. `data.js:150-153` already documents this for `bookOptions`:
`openBooking()` preselects on an exact string match, so a label written out a
second time anywhere else opens an empty picker with the submit button disabled.

## Validation

Each rule below is a way the site breaks quietly once a spreadsheet is upstream.

| Rule | Why |
| ---- | --- |
| Trim every cell | `openBooking()` matches labels exactly. A trailing space opens an empty picker with submit disabled, and spreadsheet cells accumulate trailing spaces as a matter of course |
| `events.month` matches `/^[A-Z][a-z]+ \d{4}$/` | `eventLabel()` does `group.month.slice(0, 3)`. A date-formatted cell serialises to ISO and the booking label becomes nonsense |
| Every `classes.provider` resolves in `providers` | `locationOf()` returns `''` for an unknown key — the venue disappears from the page with no error |
| Every `timetable.class` resolves in `classes` | Same silent-empty failure, in the booking modal |
| `bookOptions` labels unique across classes, offerings and events | A duplicate makes preselect ambiguous |
| No `https?://` in any `prices` cell | The payment boundary, enforced rather than remembered |
| Every `copy-manifest.js` key has a row | A deleted row would otherwise blank a headline on a live page |
| `teachers.slug` unique and kebab-case | It is a route key |
| Referenced `partners.logo` and `teachers.photo` files exist | Broken image instead of missing venue, same class of silence |

**Any failure stops the build. Nothing deploys, and the last good content stays
live.** Recovery is fixing the cell, not reverting anything.

The manifest is generated by a vitest test that greps the `.svelte` files for
copy keys, so adding a heading without a corresponding sheet row fails CI rather
than shipping blank.

## Failure reporting

`Status!B2` carries the state, in the tool the owner is already looking at:

```
Failed 14:32 — events tab, row 7: month reads "2026-09-05" but should read
"September 2026". Fix that cell and it will publish itself.
```

The same text goes out by email through the existing SMTP config in
`src/lib/server/mail.js`. Success writes `Live 14:32 — <deployment alias>`, using the same alias the deploy
job already resolves (`vinya-app-gold.vercel.app` today), and
the Apps Script writes `Edit noted — publishing in ~30s` the moment the debounce
arms, so there is never a silent gap.

## Two loops that would otherwise bite

**Recursive deploys.** The Action commits to `main`, and a push to `main`
triggers `deploy.yml`. Two guards: a push made with the default `GITHUB_TOKEN`
does not trigger further workflow runs, which is GitHub's own loop guard, and the
commit message carries `[skip ci]` as a second line of defence.

**Cancelled mid-flight.** `deploy.yml` currently uses `cancel-in-progress: true`
on group `deploy-${{ github.ref }}`. Two dispatches forty seconds apart are both
`main`, so the second would kill the first — possibly after it committed but
before it deployed, leaving `main` ahead of the live site. Content runs get their
own concurrency group with `cancel-in-progress: false` so they queue instead of
racing, and the sync script rebases before pushing.

**`deploy.yml` also needs a correctness fix for any of this to work.**
`VERCEL_ENV` and `PROD_FLAG` are both derived from
`github.event_name == 'push'`. A `repository_dispatch` run takes the `else`
branch of each, so a content update would deploy to a throwaway preview and never
reach production. Both ternaries must treat `repository_dispatch` as production.

## The payment boundary

`pay.url` and `pay.qr` stay in code. `prices` labels, amounts, notes and the
feature flag move to the sheet, so a price change is an ordinary edit.

The reasoning is already written at `data.js:50-53`: a QR code cannot be checked
by eye, so anything able to change the link behind one can redirect real money
and nobody would see it. The CSP in `svelte.config.js` is the control that makes
injecting such a change hard. Putting those URLs in a spreadsheet routes around
that control entirely — it grants payment redirection to anyone with edit access
to the sheet, and to anyone who phishes the owner's Google account. The QR images
are generated from those same URLs, so a sheet-side edit would also leave image
and link disagreeing, which is the one failure the current design rules out by
construction.

The validator rejects any `prices` cell matching `https?://` outright. A boundary
that depends on everyone remembering it is not a boundary.

## Secrets

`MAIL_PASS` is a Gmail app password and `OTP_SECRET` signs the booking
confirmation codes. Neither goes in the sheet, and nor do the Supabase keys.

A spreadsheet has no access log, no rotation story, and sharing as its entire
purpose. Anyone who gained view access would own the studio mailbox and be able
to mint valid booking tokens. These stay in Vercel environment variables, set by
the developer.

`MAIL_TO` and `MAIL_CC` are different: they are not credentials, and adding a
second teacher to booking notifications is exactly the kind of change the owner
should not need help with. The risk is a silent redirect harvesting visitor names
and email addresses, so the Action emails the **previous** recipients — "booking
notifications now also go to X" — before applying any change to those keys.

Token inventory:

- **Apps Script Script Properties**: fine-grained PAT, one repo, dispatch only.
  Weakest token that works, because anyone who can edit the Script project can
  read it.
- **GitHub Actions secrets**: `GOOGLE_SA_KEY`, a service account shared to this
  one spreadsheet, plus the existing `VERCEL_*` three.
- **Vercel environment**: `MAIL_PASS`, `OTP_SECRET`, `PUBLIC_SUPABASE_*`.

## Personal data on the Inquiries tab

Booking requests are currently emailed and not stored — `supabase/schema.sql`
says so explicitly, and it was a choice. Lane C reverses it: visitor names and
email addresses accumulate in a Google Sheet, in the Netherlands, under GDPR.

The convenience is real and it is worth doing, but three things ship *with* it,
not after:

- The spreadsheet is shared to the owner's account specifically. Not "anyone with
  the link", which would put visitor emails one forwarded URL away from public.
- A stated retention period of **12 months**, enforced by a scheduled Apps Script
  that deletes older rows nightly. Long enough to look up a returning student,
  short enough to defend.
- A line on the booking form saying requests are kept, and for how long.

Cheap now, awkward to retrofit.

## Phases

Seven phases, each shippable on its own.

### Phase 0 — Foundations (no owner-visible change) — ~1.5 days

The site must render byte-identically at the end of this phase. Doing the
extraction while content is still code-only means every later phase is a data
change; doing it after the sheet exists means refactoring against a moving
source.

**Story 0.1 — Copy lives behind keys**
As a developer, I want every editorial string extracted out of the markup and
into a keyed content module, so that the words on the site have one address each.

- All prose in `+page.svelte`, `about/`, `classes/`, `teachers/`, `events/` and
  `Footer.svelte` replaced by key lookups
- Keys follow `page.section.role`, e.g. `home.hero.title`
- `src/lib/copy.js` exports the accessor and `paras()`
- `src/lib/copy-manifest.js` lists every key
- Out of scope: aria-labels, button microcopy, validation messages, SVG titles

**Story 0.2 — The drifts are fixed**
As a developer, I want each duplicated fact reduced to one source, so that a
sheet edit cannot leave a stale second copy on the site.

- Next-gathering band derived from `events[0].items[0]`
- The shared lede is one key used on both pages
- `events[].n` derived from `items.length`
- Testimonials moved out of markup into content
- A test asserts the band text matches the event it describes

**Story 0.3 — `data.js` reads a generated file**
As a developer, I want content separated from the code that derives things from
it, so that the sync script has one file to write.

- `src/lib/content.generated.json` hand-seeded from today's values
- `data.js` reads it and keeps only derived exports and `pay`
- Existing vitest suite passes unchanged
- A rendered-output snapshot test proves the page did not change

**Story 0.4 — The manifest is enforced**
As a developer, I want CI to fail when markup and content disagree, so that the
contract cannot rot.

- A vitest test greps `.svelte` files for key lookups
- Fails on a key used in markup but absent from the manifest, and vice versa

### Phase 1 — The text lane — ~1.5 days

**Story 1.1 — The spreadsheet exists, already filled in**
As the owner, I want the spreadsheet to arrive containing the site as it is
today, so that I am editing real content rather than typing it in.

- `scripts/seed-sheet.mjs` writes every content tab from `content.generated.json`
- Header rows frozen and bold; `where` column filled with human hints
- Running it twice is safe

**Story 1.2 — The Action reads the sheet**
As the site, I want content pulled from the spreadsheet into a generated file, so
that a sheet edit can become a deploy.

- `scripts/sync-content.mjs` authenticates with `GOOGLE_SA_KEY`
- Reads every content tab, groups flat tabs, writes `content.generated.json`
- Byte-identical output to the committed file when the sheet is unchanged
- Unit-tested against fixture data, no network

**Story 1.3 — Bad content cannot deploy**
As the owner, I want a mistake caught before it reaches the site, so that a typo
in a cell cannot take a page down.

- `scripts/lib/schema.mjs` implements every rule in the Validation table
- Each rule has a failing-case test
- Failures collect into one report naming tab, row, column and what was wrong
- A single failure aborts before anything is written

**Story 1.4 — A dispatch deploys to production**
As the site, I want a content event to run the real deploy path, so that content
updates and code pushes ship the same way.

- `repository_dispatch: types: [content-update]` added
- `VERCEL_ENV` and `PROD_FLAG` treat dispatch as production
- Content runs use their own concurrency group, `cancel-in-progress: false`
- Commit is authored by the Action, message carries `[skip ci]`, rebases first
- Verified: a dispatch reaches the production domain, and does not recurse

**Story 1.5 — Edits publish themselves**
As the owner, I want my changes to go live on their own shortly after I stop
typing, so that I never have to remember a publish step.

- Installable `onEdit` trigger, debounce as specified
- Each edit cancels the pending timer and arms a new one
- Edits to `Status` and `Inquiries` are ignored
- A `Vinya → Publish now` menu item fires immediately
- Verified: ten edits in a minute produce exactly one deploy

### Phase 2 — Feedback — ~0.5 day

**Story 2.1 — The sheet says what is happening**
As the owner, I want to see whether my edit went live, so that I am not guessing.

- `Status!B2` shows armed, publishing, live-with-timestamp, or the failure text
- Written by Apps Script on arm and by the Action on finish
- `Status!A4:A20` keeps the last ten outcomes as a short history

**Story 2.2 — Failures reach her inbox**
As the owner, I want to be told when an edit was rejected, so that I do not
discover it days later.

- Failure email through the existing SMTP config, naming tab, row and problem
- Failure only. Success is visible in the sheet and does not need mail

**Story 2.3 — Machine tabs are protected**
As the owner, I want the tabs I should not touch to refuse edits, so that I
cannot break the system by clicking in the wrong place.

- Protected ranges on `Status` and `Inquiries`
- `Read me first` tab explains what each tab is for

### Phase 3 — Settings lane — ~0.5 day

**Story 3.1 — Mail recipients are editable**
As the owner, I want to change who receives booking requests, so that a new
teacher can be added without the developer.

- `Settings` tab drives `MAIL_TO`, `MAIL_CC`, `MAIL_FROM`
- Applied via `vercel env rm` / `vercel env add`, then a redeploy
- Never written to any file in the repository
- Each address validated with the existing `isEmail` from `src/lib/server/validate.js`

**Story 3.2 — A redirect cannot be silent**
As the owner, I want to be told when notification recipients change, so that an
unauthorised change is visible to me.

- Before applying, the Action emails the previous recipient list describing the
  change
- Applies even when the change was legitimate. The point is that it is never
  invisible

### Phase 4 — Images — ~1.5 days

**Story 4.1 — Photos come from Drive**
As the owner, I want to change a photo by dropping a file in a folder, so that
images are as editable as text.

- The Action lists a named Drive folder and downloads referenced originals
- Resizes to 1400w and 2200w, emits JPEG and WebP with `sharp`
- Commits derivatives into `static/images/` alongside the content
- Unchanged originals are skipped, so an unrelated edit does not rebuild images

**Story 4.2 — Framing stays editorial**
As the owner, I want to control the alt text and how a photo is cropped, so that
faces are not cut off.

- `photos` tab carries `alt`, `fx`, `fy`, `fyMobile`
- Validated numeric and within 0-100
- The existing ALT-drag tool in `Photo.svelte` still produces usable values, and
  the `Read me first` tab explains where to paste them

Drive links are not a shortcut around any of this: `drive.google.com/uc?id=` is
not CDN-backed, is rate-limited, and breaks when sharing settings change. It is
not something to point a production `<img>` at.

### Phase 5 — Inquiries — ~0.5 day

**Story 5.1 — Bookings appear in the sheet**
As the owner, I want booking requests listed in the spreadsheet, so that I have
them somewhere other than my inbox.

- `/api/booking` appends after a successful mail send
- A Sheets failure is logged and swallowed. A booking must never fail because a
  spreadsheet was unavailable
- Columns: timestamp, name, email, option, preferred time, message, price

**Story 5.2 — Kept data is handled properly**
As a visitor, I want to know my request is stored and for how long, so that I am
not surprised.

- Nightly Apps Script deletes rows older than 12 months
- The booking form says requests are kept for 12 months
- The spreadsheet is shared to the owner's account, link sharing off
- Documented in the README under a Privacy heading

### Phase 6 — Handover — ~0.5 day

**Story 6.1 — She can work without the developer**
As the owner, I want instructions inside the tool I am using, so that I do not
have to find a document elsewhere.

- `Read me first` tab: what each tab does, how paragraphs work, what happens when
  she edits, how to read `Status`, what to do when something fails
- Written for someone who has never seen the site's code

**Story 6.2 — The developer can operate it**
As the developer, I want the failure modes written down, so that a problem a year
from now does not need rediscovery.

- README runbook: rotating each token, re-running a failed sync by hand,
  reverting bad content, restoring the Apps Script trigger if it is deleted
- Which alarms mean the owner should call, and which she can ignore

## Accepted limitations

- **Thirty to a hundred and twenty seconds from last edit to live**, since
  `.after()` fires late by up to fifteen seconds and the build takes about ninety.
  Worth it for validation and a revert path. Revisit only if the studio starts
  making time-critical changes.
- **No review step.** A half-finished row left alone for thirty seconds ships.
  Validation catches malformed content; it cannot catch unfinished content.
- **Validation catches malformed, not wrong.** A correctly formatted class at the
  wrong time deploys. `git revert` is the recovery.
- **Sheet edit access is a production permission.** That is the point of the
  project, but sharing it should be treated the way a deploy key is treated.
- **Markup is less readable.** `{copy['home.hero.title']}` says less than the
  sentence it replaces. The `where` column and the manifest are the mitigation.

## Out of scope

- Feature switches that show and hide whole sections. Every one adds a rendering
  state to test, for a need that has not appeared yet.
- Payment URLs and QR images. Deliberate, see "The payment boundary".
- Credentials of any kind in the sheet. Deliberate, see "Secrets".
- Aria-labels, button microcopy, form validation messages. They are interface
  behaviour rather than editorial content, and moving them multiplies the manifest
  for changes nobody will make.
- The `subscribers` table, which keeps its existing Supabase path.

## Effort

| Phase | Estimate |
| ----- | -------- |
| 0 · Foundations | ~1.5 days |
| 1 · Text lane | ~1.5 days |
| 2 · Feedback | ~0.5 day |
| 3 · Settings lane | ~0.5 day |
| 4 · Images | ~1.5 days |
| 5 · Inquiries | ~0.5 day |
| 6 · Handover | ~0.5 day |
| **Total** | **~6.5 days** |

Phases 0 through 2 are the smallest set that is actually usable by a
non-technical owner: without Phase 2 she cannot tell whether an edit worked, and
without Phase 0 there is nothing to put in the sheet but `data.js`.
