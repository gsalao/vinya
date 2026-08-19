# ADR 0001 — The content system is a built-in admin, not Google Sheets

**Date:** 2026-08-20
**Status:** Accepted
**Supersedes:** `docs/superpowers/specs/2026-08-19-sheets-cms-design.md`, whose
pipeline is retained in full; only the content *source* changes.

## Context

The studio owner is not technical and needs to edit every word on the site
without a developer. The accepted design made Google Sheets the editing surface:
one tab per content type, an Apps Script debounce, and a GitHub Action that read
the sheet through a service account, validated it, and deployed.

Phases 0-2 of that design were built, reviewed and merged (PR #1). The pipeline
works. What failed was the first step of standing it up.

Reading a spreadsheet from CI requires a Google Cloud service account, and a
service account requires a Google Cloud project. Creating one on the account
that owns this site is blocked: the project form demands a parent organization
or folder, which is a Google Workspace construct the owner does not have and
cannot be given without an administrator of a domain we do not control.

Workarounds exist and were all rejected:

- **Create the project on a different personal account.** Splits ownership of a
  production dependency across two Google identities, one of which belongs to a
  person who will eventually hand this site over.
- **Push the sheet contents in the dispatch payload**, avoiding Cloud entirely.
  Feasible — the flat content measures 16 KB against roughly 64 KB of headroom —
  but it moves the read into Apps Script where it cannot be tested, forfeits the
  Action's ability to write status back, and introduces a size ceiling that
  fails obscurely when crossed.
- **Ask a Workspace administrator for a folder.** Makes the studio's website
  depend on an unrelated organisation's policy decisions.

## Decision

Replace Google Sheets with an admin interface built into the site itself, backed
by the Supabase project that already exists for the newsletter signup.

**Everything downstream of the content source is kept unchanged.** The pipeline
is `read → validate → shape → commit → deploy`, and only `read` is affected:

| Kept | Replaced |
| ---- | -------- |
| `scripts/lib/schema.mjs` — every validation rule | `scripts/lib/sheets.mjs` |
| `scripts/lib/shape.mjs`, `scripts/lib/flatten.mjs` | `scripts/seed-sheet.mjs` |
| The byte-for-byte round-trip test | `apps-script/` |
| `scripts/sync-content.mjs`'s structure | The Google setup steps |
| `scripts/report-status.mjs`, `scripts/notify-failure.mjs` | |
| `.github/workflows/deploy.yml` and both loop guards | |
| All of Phase 0's content extraction and its 180 tests | |

Database tables mirror the spreadsheet tabs column for column, so `readTabs()`
becomes `readTables()` returning the identical shape and nothing downstream
notices.

## Consequences

**Better than the spreadsheet, not merely equivalent:**

- Validation runs in the form. `schema.mjs` is pure, so the admin applies the
  same rules as the pipeline and the owner sees "that must read like September
  2026" while typing, rather than thirty seconds later in a status cell.
- Ordering becomes explicit. Row order was the spreadsheet's ordering tool and
  a stray sort click could destroy it; an integer column and drag handles cannot
  be reordered by accident.
- Publish state is a banner in the tool she is already looking at, not a cell
  she must remember to check.
- Fields that must not be edited can be shown and disabled — the payment link
  is visible but locked, rather than absent and unexplained.
- No Google dependency at all: no Cloud project, no service account, no Apps
  Script, no installable-trigger trap.

**Costs:**

- An interface to build and maintain, where a spreadsheet was free.
- Supabase becomes a dependency of *editing*. It is not a dependency of the
  live site, which still serves committed static content — if Supabase is down,
  visitors are unaffected and only publishing pauses.
- The owner learns one more login. Mitigated by it being the same site she
  already knows, at `/admin`.

## What does not change

`pay.url` and `pay.qr` stay hardcoded in `src/lib/data.js`. A QR code cannot be
checked by eye, so anything able to change the link behind one can redirect real
money unseen. The database never carries a payment target, and `data.js` applies
`PAY` after the content spread so a smuggled value is overwritten regardless.

The rebuild-and-commit model also stands. Content still reaches visitors as
committed static files, which keeps git history as a content backup, keeps
`git revert` as the recovery path for a bad edit, and keeps the public site
independent of any database at request time.
