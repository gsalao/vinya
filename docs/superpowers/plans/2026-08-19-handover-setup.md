# Setup you have to do yourself

**All the code is built, reviewed and committed.** Everything below needs an
account only you have — a Google Cloud project, a spreadsheet, and a GitHub
token. Work through it in order; each step says how to know it worked.

Nothing here is reversible-by-accident, but two steps handle credentials. Those
are marked.

## What already works, before any of this

- Every word on the site comes from `src/lib/content.generated.json`.
- `scripts/lib/schema.mjs` validates spreadsheet rows and rejects the failures
  that are silent today.
- `scripts/lib/shape.mjs` turns flat rows into that file, and a test proves the
  two agree byte-for-byte on every commit.
- `scripts/sync-content.mjs` orchestrates read → validate → shape → write.
- `scripts/seed-sheet.mjs` fills an empty spreadsheet from that file, and checks
  every tab exists before writing anything.
- `.github/workflows/deploy.yml` responds to the spreadsheet, commits and deploys.
- `apps-script/Code.gs` is the 30-second debounce, ready to paste in.
- `scripts/report-status.mjs` and `scripts/notify-failure.mjs` report the outcome
  into the sheet and to your inbox.

What does not exist yet: the spreadsheet, the credentials, and the Apps Script
installed against them. That is all this document is for.

---

## 1. Google Cloud service account

1. `console.cloud.google.com` → create a project named `vinya-content`.
2. APIs & Services → Library → enable **Google Sheets API**.
3. IAM & Admin → Service Accounts → Create. Name it `vinya-sync`. **No roles** —
   access comes from sharing the sheet, not from IAM.
4. On the new account: Keys → Add Key → Create new key → **JSON**. It downloads
   once and cannot be downloaded again.
5. Note the account's email, of the form
   `vinya-sync@vinya-content.iam.gserviceaccount.com`.

**Worked when:** you have a `.json` key file and the service-account email.

---

## 2. The spreadsheet

1. Create a spreadsheet named **Vinya — site content**.
2. Create one tab per name below. **Names are case-sensitive and must match
   exactly** — `scripts/lib/schema.mjs` looks them up by these strings:

   `copy` · `providers` · `classes` · `timetable` · `events` · `pastEvents` ·
   `offerings` · `faqs` · `teachers` · `partners` · `prices` · `testimonials`

   Twelve of them. If you get one wrong, the seed script says so and writes
   nothing, rather than filling some tabs and stopping halfway.

3. Add one more tab named `Status`, with `Last publish` in cell `A2`. Leave
   `B2` empty.
4. Add one more tab named `Read me first`. Paste the whole contents of
   `apps-script/read-me-first.md` into cell `A1`, as plain text — that file
   is the only copy of this text; nothing pastes it into the sheet for you.
5. Share the spreadsheet with the service-account email from step 1, as
   **Editor**.
6. Copy the spreadsheet id out of its URL — the segment between `/d/` and
   `/edit`.

**Worked when:** fourteen tabs exist — the twelve content tabs, `Status` and
`Read me first` — and the service account appears in Share.

---

## 3. Local credentials — handles secrets

**Before pasting anything, confirm `.env` is git-ignored.** The repository is
public, and a committed service-account key grants write access to the sheet to
anyone who reads the history.

```bash
git check-ignore -v .env
```

This must print a line naming `.gitignore`. **If it prints nothing, stop** and
tell me — do not continue.

Then add to `.env`:

```
VINYA_SHEET_ID=<the id from step 2>
GOOGLE_SA_KEY=<the entire JSON key file, on one line>
```

**Worked when:** `git status --short` does not list `.env`.

---

## 4. Seed the spreadsheet

`scripts/seed-sheet.mjs` fills the empty tabs from the committed content, so
nothing is retyped. It runs **once**: after this the spreadsheet is upstream, and
running it again would overwrite whatever has been typed since.

If any tab is missing or misspelled it writes nothing at all and tells you which
ones to create, so a half-filled sheet is not a state you can reach.

```bash
pnpm content:seed     # writes today's content into the sheet
pnpm content:sync     # must report: Content is already up to date
```

That second command is the important one. It proves the seed script, the
shaper and the validator all agree on the same columns and the same structure.
Any disagreement surfaces there, before the pipeline is live.

---

## 5. GitHub repository secrets and variables

Settings → Secrets and variables → Actions.

**Secrets** tab:

| Name | Value |
| ---- | ----- |
| `GOOGLE_SA_KEY` | the entire service-account JSON, on one line |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USER` `MAIL_PASS` `MAIL_FROM` `MAIL_TO` | the same values already in Vercel |

**Variables** tab (not Secrets):

| Name | Value |
| ---- | ----- |
| `VINYA_SHEET_ID` | the spreadsheet id |

The sheet id is a variable rather than a secret deliberately: it is not
sensitive, and a secret would be masked in the logs, which makes a
misconfiguration much harder to diagnose.

`MAIL_TO` **is** a secret rather than a variable, because it is the owner's
email address and this repository is public.

---

## 6. GitHub token for the Apps Script — handles secrets

github.com → Settings → Developer settings → **Fine-grained** personal access
tokens → Generate new.

- Repository access: **Only select repositories** → `gsalao/vinya`
- Permissions → Repository permissions → **Contents: Read and write**

`repository_dispatch` is gated by the Contents permission; there is no narrower
scope for it.

This is the weakest credential that works, and it needs to stay that way:
**anyone who can edit the Apps Script project can read this token out of Script
Properties.** Give it a 1-year expiry and put the renewal in a calendar —
expiry is completely silent from the owner's side. She edits, nothing happens,
and nobody knows why.

---

## 7. Install the Apps Script

1. On the spreadsheet: Extensions → Apps Script.
2. Replace `Code.gs` with the committed file. Save.
3. Project Settings → Script Properties → add `GH_TOKEN` with the token from
   step 6.
4. Triggers → Add Trigger → function `onEditInstallable`, source **From
   spreadsheet**, event type **On edit**. Authorize when prompted.
5. Reload the spreadsheet. A `Vinya` menu appears.

**Step 4 is the one that silently fails if done wrong.** It must be an
*installable* trigger. A simple `onEdit(e)` runs unauthorized and cannot call
`UrlFetchApp` at all, so the dispatch would never fire and nothing would
indicate why.

---

## 8. Protect the machine tabs

- `Status`: Data → Protect sheets and ranges → Sheet → `Status` → Set
  permissions → **Only you**.
- `copy!A:A`: same, as a Range. The keys are the contract with the markup; the
  `text` column is hers to edit, the `key` column is what makes editing it work.

The service account still writes through the API — protection applies to the UI,
not to API access. That is exactly the split wanted.

---

## After it is running

Watch these five things on the first live run, in this order:

1. **Retype one timetable time and one event month by hand**, then let it publish
   and look at what came back. This is where Google's own helpfulness bites: it
   turns `10:30` into a time value and `August 2026` into a date unless the cell
   is formatted as plain text. The validator now rejects both, so you should get
   a clear message rather than a mangled site — but this is the first thing to
   confirm, because it is the most ordinary edit anyone will make.
2. **One full cycle end to end:** `Status` should move `Edit noted…` →
   `Publishing…` → `Live — <url>` with a timestamp.
3. **Break something on purpose.** Put `2026-09-05` in an `events` month cell.
   The site must not change, `Status` must name the tab and row, and an email
   must arrive.
4. **Check the seeded `copy` tab has 110 rows** and a filled-in `where` column.
5. **Check the first content commit on `main`** is authored by
   `vinya-content[bot]` and did *not* trigger a second workflow run.

## One thing I could not verify and you should

`pnpm dev`, then click through: open the pay modal and confirm the QR and the
`tikkie.me` link both appear, and open the booking modal and confirm the class
picker is populated. Phase 0 moved all of that content between files without
changing a rendered byte — proven by an SSR snapshot test and by byte-identical
export comparison — but nobody has actually clicked it.
