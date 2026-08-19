# Content pipeline — operating notes

The spreadsheet is the source of truth for site content. `apps-script/Code.gs`
(pasted into the spreadsheet's Extensions → Apps Script project — see the
setup comment at the top of that file) debounces the owner's edits by 30
seconds, then fires a `repository_dispatch` of type `content-update`.
`.github/workflows/deploy.yml` picks that up, reads the spreadsheet through a
service account, validates every row, shapes it into
`src/lib/content.generated.json`, commits that file with `[skip ci]`, and
deploys. A validation failure stops before any of that: nothing deploys, and
the last good content stays live.

Design: `docs/superpowers/specs/2026-08-19-sheets-cms-design.md`

The full tab and column list is not repeated here — it would drift the
moment someone edited one copy and not the other. It lives in
`scripts/lib/schema.mjs`'s `REQUIRED` export (the tabs and their required
columns) and `OPTIONAL_WHEN_EMPTY` (currently just `pastEvents`, the one tab
allowed to have zero rows). `scripts/lib/shape.mjs` is the authority on how a
tab's rows become `content.generated.json`; `scripts/lib/flatten.mjs` is its
exact inverse, used by `scripts/seed-sheet.mjs` and proved against `shape.mjs`
in `scripts/lib/shape.test.js`.

## Credentials, and where each one lives

| What | Where | Rotate |
| ---- | ----- | ------ |
| `GH_TOKEN` — fine-grained PAT, this repo only, Contents: read and write | Apps Script project → Project Settings → Script Properties | Before it expires. Expiry is silent from the owner's side: she edits, and nothing happens |
| `GOOGLE_SA_KEY` — service account JSON key | GitHub → Settings → Secrets and variables → Actions → **Secrets** | On staff change, or if it may have leaked |
| `VINYA_SHEET_ID` | GitHub → Settings → Secrets and variables → Actions → **Variables** (`scripts/lib/sheets.mjs` is explicit that this is a variable, not a secret) | Only if the spreadsheet itself is ever recreated |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASS` / `MAIL_FROM` / `MAIL_TO` | Two places: GitHub Actions **Secrets** (used by `scripts/notify-failure.mjs` to email a sync failure) and Vercel project environment variables (used by `src/lib/server/mail.js` for the booking flow) — keep both in sync by hand | With the mailbox. See the root `README.md`'s "Set up the booking email" for how `MAIL_PASS` is generated |

One more credential this table can't show a "where" for: the service
account's own address (the `client_email` field inside the `GOOGLE_SA_KEY`
JSON) has to be added as an Editor on the spreadsheet itself, the same way
you'd share it with a person. No script does this automatically — if
`GOOGLE_SA_KEY` is rotated to a *different* service account, or the
spreadsheet is ever recreated, this sharing step has to be redone by hand or
every sync fails on a permission error.

## When something is wrong

**The owner says nothing happens when she edits.** Check `Status!B2` first.

- Stuck on "Edit noted — publishing in about 30 seconds" forever: the
  installable trigger was deleted. Apps Script project → Triggers → re-add
  `onEditInstallable`, From spreadsheet, On edit. It must be installable —
  Code.gs's own header comment explains why a simple `onEdit(e)` cannot call
  `UrlFetchApp` and would fail silently.
- "the site's publishing connection is not set up": `GH_TOKEN` is missing
  from Script Properties.
- "could not be reached (error `<code>`)": `GH_TOKEN` is present but GitHub
  rejected it — usually 401 because the fine-grained PAT expired. Reissue it
  and update Script Properties.

**Every publish keeps spawning another one, roughly every debounce cycle,
without ever settling.** The `MACHINE_TABS` guard in `apps-script/Code.gs`
(`['Status', 'Inquiries']`) is not matching the `Status` tab's actual name —
maybe it was renamed in the sheet, or the array wasn't updated to match. When
that guard doesn't catch a tab, `report-status.mjs`'s own write to `Status!B2`
gets treated as a fresh edit, which re-arms the debounce, which publishes
again, which writes `Status!B2` again — the loop Code.gs's own comment
describes as "which would trigger another status write, and so on." Fix the
tab name in the array (or in the sheet) so they match exactly, spelling and
case both.

**A credentials or connectivity failure reading the sheet sends no email, and
the owner never reports it.** This is easy to miss because it looks like the
system is working: `Status!B2` does get a generic line ("Not published — the
content could not be read. Ask the developer."), written by the "Report a
failed sync to the sheet" step in `deploy.yml`. But
`scripts/notify-failure.mjs` only emails when `sync.log` contains at least
one `  • ` bulleted line, and this class of failure — a bad or expired
`GOOGLE_SA_KEY`, a wrong `VINYA_SHEET_ID`, the service account losing access
to the sheet, a Google API outage — throws before `scripts/lib/schema.mjs`'s
`validate()` ever runs, so it never produces one. (A genuinely malformed cell
*does* produce a bullet and does get emailed — this gap is specific to
failures in reading the sheet at all, not in what's in it.) If the site looks
stale and the owner says she got no email, check the Action run's log
directly rather than her inbox.

**A publish failed and the reported message is unclear, or you want to see a
validation failure without waiting on a real edit.** Re-run the sync by hand:

```bash
GOOGLE_SA_KEY='<the service account JSON, one line>' VINYA_SHEET_ID=<the sheet id> \
  node scripts/sync-content.mjs
```

Or add both to a local, gitignored `.env` (they are not in `.env.example`
because normally only CI needs them) and run `pnpm content:sync`, which loads
`.env` automatically if present. Either way this is the same code the Action
runs, so a validation error prints the identical `  • tab, row N: …` bullets
you'd otherwise only see in the sheet or the owner's inbox.

`deploy.yml` has no `workflow_dispatch` trigger, so there is no "Run
workflow" button in the Actions tab for this. For a failure that was purely
infrastructure (a Vercel outage, a transient network error) rather than
content, re-running the failed job from its own run page works, because the
sheet's content hasn't changed. For a content failure, re-running the job
just fails the same way again — fix the cell, which fires a fresh dispatch on
its own.

**Bad content went live** (valid enough to pass every check, but wrong). It's
an ordinary commit:

```bash
git revert <sha of the "content: update from the spreadsheet [skip ci]" commit>
git push origin main
```

Then fix the sheet too, or the next edit — even an unrelated one — republishes
the same bad content from the sheet about thirty seconds later, since the
sheet is upstream of the commit, not the other way round.

## What must never move into the sheet

`PAY` in `src/lib/data.js` — the payment URLs and their QR image paths — and
any credential. See the design's "The payment boundary" and "Secrets"
sections for the reasoning. `scripts/lib/schema.mjs` rejects any `prices` cell
that looks like a URL; that rule is load-bearing, not tidiness. As a standing
check: `grep -r "tikkie" src/lib/content.generated.json` should always return
nothing. If it doesn't, the boundary has a gap somewhere.

## Seeding a spreadsheet from scratch

`scripts/seed-sheet.mjs` fills an *empty* spreadsheet from the content
already committed at `src/lib/content.generated.json`, via `flatten.mjs`. It
pre-flights that every tab in `REQUIRED` already exists (case-sensitive)
before writing anything, and refuses to write at all if one is missing,
rather than seeding some tabs and not others. It is meant to run exactly
once: running it again overwrites every edit the owner has made since, with
no warning beyond the one it prints on success. Run with `pnpm content:seed`.
