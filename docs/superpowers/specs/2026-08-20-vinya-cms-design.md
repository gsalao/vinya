# Vinya CMS — the owner edits the site from the site

**Date:** 2026-08-20
**Status:** designed, approved to build
**Why not Sheets:** `docs/adr/0001-cms-not-google-sheets.md`
**Pipeline this reuses:** `docs/superpowers/specs/2026-08-19-sheets-cms-design.md`

## Problem

The studio owner must be able to change every word on the site without a
developer. The built pipeline does that already — validate, shape, commit,
deploy — but its content source was a Google Sheet, and standing that up needs a
Google Cloud project this account cannot create. See the ADR.

The source becomes an admin screen at `/admin`, backed by the Supabase project
that already exists. Nothing downstream changes.

## What she must be able to do

Edit every heading and paragraph, the classes, the timetable, upcoming and past
events, FAQs, offerings, teacher profiles, partner logos, testimonials, venues,
and price labels. Change who receives booking enquiries. Change her own password
and email. See whether her last change went live.

## What she must not be able to do

Change a payment link, reach anything outside `/admin`, or break the site with a
malformed entry.

## Constraints

- **The repository is public.** No credential, key, email address or spreadsheet
  id may be committed, including in history.
- **`pay.url` and `pay.qr` stay hardcoded** in `src/lib/data.js`. A QR code
  cannot be checked by eye, so anything able to change the link behind one can
  redirect real money unseen.
- **Never `{@html}`.** Content is untrusted the moment more than one person can
  edit it.
- **The public site never queries Supabase.** It serves committed static
  content. Supabase down means publishing pauses, not that the site is down.
- Node 22, pnpm, SvelteKit 2 / Svelte 5 runes, Vercel.

## Architecture

```
Owner ─▶ /admin (password) ─▶ edits ─▶ Save
                                         │
                              Supabase ──┤ content tables — source of truth
                                         │ publish_state.publish_after = now()+30s
                                         │
                     pg_cron (1 min) ────┤ is it due, and nothing newer?
                              pg_net ────▶ POST /api/publish/tick
                                              │
                                              ▶ repository_dispatch
                                                     │
                                     GitHub Action ──┤ read tables (service_role)
                                                     ├─ validate   ← schema.mjs
                                                     ├─ shape      ← shape.mjs
                                                     ├─ commit content.generated.json
                                                     ├─ deploy --prod
                                                     └─ write publish_state
```

Three properties worth naming:

**The debounce lives in the database, not a browser tab.** She can save and close
the laptop; the sweep still fires. A client-side timer would lose the publish the
moment she navigated away.

**The GitHub token never enters the database.** `pg_net` calls our own endpoint;
the endpoint holds the token in Vercel's environment and fires the dispatch. A
database compromise cannot deploy.

**The Action writes the result back with the service-role key**, so publish state
reaches the admin without the Action needing to poll anything.

## Data model

One table per content type, columns named exactly what `schema.mjs`'s `REQUIRED`
map already demands, so `readTables()` returns what `readTabs()` returned and
nothing downstream is touched.

```
copy          key · text · where · sort
providers     key · name · address · sort
classes       name · tone · meta · blurb · provider · sort
timetable     day · time · class · duration · sort
events        month · day · weekday · name · detail · blurb · remaining · sort
past_events   date · name · status · sort
offerings     category · name · note · sort
faqs          question · answer · sort
teachers      slug · name · role · intro · highlights · photo · alt · fx · fy
              · cta_label · cta_option · sort
partners      name · logo · href · height · sort
prices        id · label · amount · note · feature · sort
testimonials  quote · who · sort

settings       key · value                     — owner-editable configuration
publish_state  one row: status · message · publish_after · updated_at · url
```

Postgres columns are `snake_case`; the code's keys are `camelCase`. The reader
converts mechanically — a deterministic transform, not a lookup table, so it
cannot drift the way a hand-maintained mapping would.

**`sort` replaces spreadsheet row order.** Row order was the owner's ordering
tool and a stray sort click could destroy it. An integer column with drag
handles cannot be reordered by accident, and `shape.mjs` keeps reading rows in
the order it is handed them.

## The admin, organised by page

She thinks in pages, so the navigation is pages:

| Screen | Holds |
| ------ | ----- |
| Home | hero · mantra band · three pillars · teacher teaser · testimonials · partner logos · jump links |
| Classes | the classes · timetable · passes and prices · offerings · FAQs |
| Teachers | teacher profiles · "how Vinya teachers work" blocks |
| Events | upcoming gatherings · past gatherings |
| About | the story · founder · what to expect · venues |
| Settings | who receives booking emails · change password · change email |

Content appearing in more than one place is edited once, under its primary page,
with a line saying where else it shows — *"also shown on the Home page"*. The
alternative, duplicating it per page, recreates exactly the drift this project
spent Phase 0 removing.

Three fields are shown but not editable, each with a reason on screen:

- **Next gathering** on Home — derived from the first upcoming event, with a link
  across to Events. It had already drifted from its source once before Phase 0
  fixed it; making it underivable by hand means it cannot drift again.
- **Payment links** on prices — *"set by your developer"*. Label, amount and note
  are hers.
- **The count on a section header** — derived from its rows.

## Validation happens twice, from one source

`schema.mjs` is pure and has no I/O, so the admin imports the same module the
pipeline runs. She sees *"month reads '2026-09-05' but must read like 'September
2026'"* as she leaves the field, not thirty seconds later.

The pipeline still validates on publish. The form is a courtesy; the pipeline is
the gate. A row that somehow reaches the database malformed still cannot deploy.

## Auth

Supabase Auth, email and password, as chosen. `/admin` is guarded in
`+layout.server.js`: no session means no page and no data, so nothing renders
before a redirect.

Sign-in is restricted to allow-listed addresses held in `settings`, so creating
an account elsewhere in Supabase cannot reach the admin. Settings offers change
password and change email.

The seeded login is `salaogerard@gmail.com`. Its initial password is set out of
band and must be changed at first sign-in — it was transmitted over chat during
setup and should be treated as burned.

## Settings the owner controls

`MAIL_TO` and `MAIL_CC` move from environment variables into `settings`, read by
`/api/booking` at request time. Changing who receives enquiries stops requiring a
redeploy — or a developer.

**A change to either notifies the previous recipients**, by email, before it
takes effect. Anyone who reaches the admin could otherwise redirect booking
enquiries — names and addresses of real people — silently. This is the one
setting where a silent change has a victim.

SMTP credentials stay in the environment. They are not configuration.

## Security posture

What an attacker with the admin password gets: every word on the public site,
and the ability to redirect booking notifications — the latter loudly, per
above. What they do not get: payment links, SMTP credentials, the GitHub token,
or the ability to deploy arbitrary code. The dispatch fires one fixed event type
against one repository; the Action builds from committed source, not from
anything the database supplied.

Row-level security denies everything by default. The `anon` key reaches only
`subscribers`, insert-only, exactly as today. Content tables are reachable by
`service_role` alone — the admin's own reads and writes go through server routes,
so the browser never holds a key that can touch content.

Rendering stays escaped. Sheet content was untrusted; database content is
untrusted for the same reason, and `{@html}` appears nowhere.

## What gets deleted

`scripts/lib/sheets.mjs`, `scripts/lib/sheets.test.js`, `scripts/seed-sheet.mjs`,
`scripts/seed-sheet.test.js`, the whole `apps-script/` directory, and the
Sheets-specific parts of the handover checklist. The `GOOGLE_SA_KEY` and
`VINYA_SHEET_ID` references leave `.github/workflows/deploy.yml`.

`flatten.mjs` stays: it is the inverse of `shape.mjs`, it powers the
byte-for-byte round-trip test, and it becomes the seeder that fills the database
from the committed content on day one.

## Accepted limitations

- **Thirty to ninety seconds before a publish starts**, because the sweep runs
  once a minute, plus roughly ninety seconds of build. Same order as the Apps
  Script debounce it replaces.
- **Validation catches malformed, not wrong.** A correctly formatted class at the
  wrong time deploys. `git revert` is the recovery, and the history is intact
  because content is still committed.
- **Editing depends on Supabase.** Publishing pauses if it is down. Visitors are
  unaffected.
- **One admin account.** Multiple editors, roles, and an audit trail are not
  built. If a second person ever edits, revisit — `updated_at` and `updated_by`
  columns exist from the start so the data does not need migrating.

## Out of scope

- The Drive image pipeline. Photos remain a developer task; the `photos` idea
  from the Sheets design is deferred with it.
- Writing booking enquiries into the database. They are emailed, as today.
- Multi-user roles, content scheduling, draft-versus-published states.

## Build order

| Phase | Deliverable |
| ----- | ----------- |
| 1 | Schema, RLS, the seeder, and `readTables()` replacing `readTabs()` — pipeline works, no UI |
| 2 | Auth, the `/admin` shell, and the Settings screen |
| 3 | The five page editors with in-form validation and drag-to-reorder |
| 4 | The debounce sweep, publish-state banner, and the Action writing results back |
| 5 | Delete the Sheets lane, rewrite the handover docs |

Phase 1 is verifiable end to end without any UI: seed the database from the
committed content, run the sync, and it must report no change — the same
round-trip proof the Sheets design used, and the same one that caught two real
defects there.
