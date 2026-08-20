# How the site works

Start here. `docs/runbook.md` is what to do when something is wrong;
`docs/adr/0001-cms-not-google-sheets.md` is why it is built this way.

## Two things change, and they travel differently

| | Where it lives | How it reaches visitors |
| --- | --- | --- |
| Words, classes, times, prices | Postgres rows | Baked into a committed file, redeployed |
| Image bytes | Supabase Storage | Served from Supabase's CDN, never enter the repo |

Only an image's **URL** travels with the content. The photo itself never touches
git — eleven images were already 7MB, and git never forgets, so committing every
replacement would bloat the repository permanently.

## The shape

```
Owner ─▶ /admin ─▶ Save ─▶ Supabase ─▶ dispatch (same request)
                                            │
                            GitHub Action ──┤ read 16 tables
                                            ├─ validate   ← schema.mjs
                                            ├─ shape      ← shape.mjs
                                            ├─ commit content.generated.json
                                            ├─ deploy --prod
                                            └─ write publish_state ─▶ banner
```

The public site never queries Supabase. It serves static files, so Supabase being
down pauses publishing but leaves visitors unaffected.

## `src/lib/content.generated.json`

Every word on the site, in one committed file. Fourteen keys:

```
copy · images · gallery · providers · classes · timetable · events
pastEvents · offerings · faqs · teachers · partners · prices · testimonials
```

Nobody edits it by hand — it is generated. `data.js` and `copy.js` import it, so
at build time every word is inlined into the pages. Being committed also makes
git history a free content backup: a bad edit is `git revert`.

## Saving, step by step

1. **Validate, then write.** The save action reads *all* content, swaps in the
   edited section, and runs the same `validate()` the deploy runs. Rules cross
   tables — a class must name a studio that exists, a booking label must be
   unique across classes, offerings and events — so a section cannot be judged
   alone. Fails → nothing is written.
2. **Fire the dispatch, in the same request.** Saving is an explicit button
   press, so there is nothing to wait for.
3. **Or queue it.** A page has a Save button per section. If a publish is already
   running, firing a second would race it — and the running job may already have
   read the tables. So the state is marked `dirty` instead, and the finishing run
   hands it back rather than reporting the site up to date.
4. **The sweep is a safety net**, not the normal path. `pg_cron` runs every
   minute and only picks up a publish that was owed and never fired.

The deploy token lives in Vercel's environment and never enters the database, so
a database compromise cannot deploy.

## Two loop guards

The Action commits to `main`, and pushes to `main` trigger the workflow. A commit
made with the default `GITHUB_TOKEN` does not re-trigger, and `[skip ci]` is in
the message as documented backup. Without both this deploys forever.

## Images

```
Browser resizes to 4 variants ─▶ /api/admin/upload ─▶ Supabase Storage
                                                          │
                                        public URL ─▶ images/gallery row
                                                          │
                                              content.generated.json (URL only)
```

Resizing happens in the owner's browser. A 6MB phone photo becomes ~400KB before
it leaves her machine, so uploads are quick on studio wifi and the server never
holds a large file — and the image library that would normally do this, about
30MB, stays out of the deployment.

**The filename convention is the glue.** `shape.mjs` derives `srcset` by swapping
`-2200.` for `-1400.` and the extension for `.webp`. The uploader writes exactly
those four names, which is why adding uploads needed no change to the shaping
logic. A file without `-2200.` in its name gets no `srcset` at all, because
claiming one would point browsers at variants that were never generated.

## Why validation matters more than usual

There is no review step between an edit and the live site. `schema.mjs` is the
only gate. Every rule in it maps to a failure that is silent without it:

- A trailing space empties the booking picker, because the form matches labels exactly.
- A date-formatted month garbles the booking label, because `eventLabel()` slices it.
- A mistyped studio key makes the venue vanish from the page with no error anywhere.
- A price id with no payment target renders a pass nobody can pay for.

Being pure and I/O-free is what lets the admin run the same rules in the form, so
she sees the problem while typing rather than a minute later.

## Layout rules that are enforced

Every section the owner can add to must look composed at any count. Three grids
had hardcoded column counts and were fixed; `src/app.css.test.js` now asserts the
invariants so they cannot come back. When adding a section she can extend, use
`auto-fit` and cap the card rather than the track.

## What is deliberately not built

**Photos are hers to change, not to organise** — there is no media library, and
replacing a photo deletes the old files rather than versioning them.

**Booking enquiries are emailed, not stored.** Her mailbox is the record. This was
a deliberate choice: storing them creates a personal-data obligation under GDPR
that nobody has agreed to carry.

**Every editor has the same access.** No roles, no audit trail. `updated_at` is
recorded on every row, so adding one later would not need a migration.
