# Setup you have to do yourself

Tasks 1-10 of `2026-08-19-sheets-cms-phase-0-2.md` are built, reviewed and
committed. Everything below needs an account only you have — a Google Cloud
project, a spreadsheet, and a GitHub token. Work through it in order; each step
says how to know it worked.

Nothing here is reversible-by-accident, but two steps handle credentials. Those
are marked.

## What already works, before any of this

- Every word on the site comes from `src/lib/content.generated.json`.
- `scripts/lib/schema.mjs` validates spreadsheet rows and rejects the failures
  that are silent today.
- `scripts/lib/shape.mjs` turns flat rows into that file, and a test proves the
  two agree byte-for-byte on every commit.
- `scripts/sync-content.mjs` orchestrates read → validate → shape → write.

What does not exist yet: the spreadsheet, the credentials, the workflow trigger,
and the Apps Script debounce.

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
4. Share the spreadsheet with the service-account email from step 1, as
   **Editor**.
5. Copy the spreadsheet id out of its URL — the segment between `/d/` and
   `/edit`.

**Worked when:** thirteen tabs exist — the twelve content tabs plus `Status` —
and the service account appears in Share.

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

Task 11 writes `scripts/seed-sheet.mjs`, which fills the empty tabs from the
committed content so nothing is retyped. That task is not built yet — it is the
first thing I do when you come back.

Once it exists:

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

Task 13 writes `apps-script/Code.gs`. Once it exists:

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

## What I do when you come back

Tasks 11-16, in order:

| Task | Deliverable |
| ---- | ----------- |
| 11 | `scripts/seed-sheet.mjs` + `writeTab` in the Sheets client |
| 12 | `deploy.yml`: dispatch trigger, production flags fix, content concurrency group, sync + commit steps |
| 13 | `apps-script/Code.gs` — the 30-second debounce and `Publish now` menu |
| 14 | `scripts/report-status.mjs` — writes publish state into the Status tab |
| 15 | `scripts/notify-failure.mjs` — emails the owner when an edit was rejected |
| 16 | `Read me first` tab content and `apps-script/README.md` runbook |

Steps 4, 7 and 8 above interleave with those: I write the code, you run it
against your own accounts.

## One thing I could not verify and you should

`pnpm dev`, then click through: open the pay modal and confirm the QR and the
`tikkie.me` link both appear, and open the booking modal and confirm the class
picker is populated. Phase 0 moved all of that content between files without
changing a rendered byte — proven by an SSR snapshot test and by byte-identical
export comparison — but nobody has actually clicked it.
