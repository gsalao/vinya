# Runbook — the content system

For whoever maintains this next, including whoever wrote it. Read
`docs/architecture.md` first if you have not; this file is what to do when
something is wrong.

## The one-line summary

The owner edits at `/admin`. Saving writes to Supabase and fires a GitHub
dispatch in the same request. The Action reads the tables, validates them,
shapes them into `src/lib/content.generated.json`, commits it, and deploys.
Visitors are served static files, so a broken publish never degrades the live
site — it keeps serving the last commit that passed.

## The failure modes that are silent

These are the ones nobody diagnoses from first principles, so they are first.

### She says nothing happens when she saves

Look at `publish_state` in Supabase.

| `status` | Meaning |
| -------- | ------- |
| `idle` | Nothing owed. If she just saved, the save itself failed — check for a validation message on screen. |
| `pending` with `dirty` | A publish is owed and the sweep has not fired. Check `select * from cron.job`, and that `PUBLISH_TICK_SECRET` matches between Vercel and the scheduled job. |
| `publishing` for more than ~5 minutes | The Action failed after claiming. Check GitHub Actions; the run will say why. |
| `failed` | The message says what happened, in her words. The Action log says it in yours. |

### Every publish fires twice

Only one thing causes this: the Action's own commit re-triggering the workflow.
Two guards stop it — a push made with the default `GITHUB_TOKEN` does not
trigger further runs, and the commit message carries `[skip ci]`. If it starts
happening, one of those changed.

### The token expired

`GH_DISPATCH_TOKEN` is a fine-grained PAT with a one-year expiry. When it lapses
the banner reads *"could not be reached (error 401)"* and publishing stops
entirely. Nothing warns you in advance. Put the renewal in a calendar.

### An uploaded photo blocks every publish

Fixed, but worth knowing the shape of it. `missingFiles()` in
`scripts/sync-content.mjs` checks referenced images exist in `static/`. Uploaded
photos are full URLs into Supabase Storage, which `existsSync` can never find, so
the check now skips anything that is not a local path. If you add a new kind of
image reference, make sure it is not checked as a local file.

## Running things by hand

```bash
pnpm content:sync     # read the database, validate, rewrite the content file
pnpm test             # 200 tests
pnpm dev              # local site + admin at :5173
```

The sync is safe to run locally — it only writes `content.generated.json`, and
`git diff` shows you exactly what changed.

### Connecting to the database

Direct connections (`db.<ref>.supabase.co`) are refused on this project and are
IPv6-only regardless. Use the pooler, and note the username carries the project
ref — a plain `postgres` user fails:

```
postgresql://postgres.<project-ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

## Recovering from a bad edit

Content is committed, so every publish is a commit:

```bash
git log --oneline --grep "content: update"
git revert <sha> && git push
```

That restores the site. **It does not restore the database**, so unless she also
fixes the editor, the next publish reproduces it. Revert to stop the bleeding,
then fix the content in `/admin`.

## Adding a new kind of content

The pipeline is column-driven. To add a field or a whole section:

1. `scripts/lib/schema.mjs` — add to `REQUIRED` (and `OPTIONAL_EXTRAS` if the
   site treats a blank as absent). This is the authority on which columns exist.
2. Migration SQL — the table, with `sort`, `updated_at`, RLS enabled, and
   `grant all to service_role`. Copy an existing table's block.
3. `scripts/lib/shape.mjs` — flat rows into the nested shape the site reads.
4. `scripts/lib/flatten.mjs` — the inverse. The round-trip test enforces that
   these two agree.
5. `src/lib/admin/fields.js` — labels, input kinds, and which page it belongs to.
6. `src/lib/data.js` — export it.

Then run `pnpm test`. The round-trip test will tell you if steps 3 and 4
disagree, and `fields.test.js` will tell you if step 5 names a column that does
not exist.

**Do not hand-edit `src/lib/content.generated.json`.** It is generated, and the
round-trip test compares against it byte for byte.

## The tests that are load-bearing

Most tests check one thing. Three protect the whole system:

- **`scripts/lib/shape.test.js`** asserts byte-for-byte that
  `shape(flatten(content))` reproduces the committed content file. This is what
  makes "five files must agree on every column" enforced rather than merely true
  today. It has caught real defects twice.
- **`scripts/lib/flatten.test.js`** asserts `validate(flatten(content))` returns
  no errors — a freshly seeded database is provably valid before one exists.
- **`src/lib/copy-manifest.test.js`** fails when the markup and the content
  disagree in either direction. A key used but undefined throws on a live page; a
  key defined but unused is a row she edits to no effect.

Two more encode bugs that actually shipped, so do not delete them as trivia:

- **`src/app.css.test.js`** rejects `aspect-ratio` with an unpinned width, and
  any height cap with a percentage inside `min()`/`max()`. The second one only
  ever broke on WebKit.
- **`src/lib/admin/ImageField.test.js`** asserts the form field is named by row
  position. When that drifted, every image save silently submitted nothing.

## What is not covered by a test

**Rendered markup.** There was an SSR snapshot test, added to prove the Phase 0
copy extraction changed nothing. It went stale three times from legitimate owner
edits — a reworded heading, a replaced photo, and finally a second venue. The
first two were fixable by stripping text and image attributes from the snapshot.
The third is not: `{#each}` output *is* structure, so on a content-driven site a
rendered snapshot can never be immune to content.

It was removed rather than kept with a habit of `-u`, because a test that cries
wolf on every content edit teaches people to ignore failures — which costs more
than the guard was worth.

If you want that guard back, the way to do it is to render each page against
fixed fixture content (mocking `$lib/data.js` and `$lib/copy.js`) rather than the
real content file. Then counts are stable and it tests markup alone. That is
worth doing before any large refactor of the routes; it was not worth doing to
protect a site whose content changes weekly.

## What must never move into the database

`pay.url` and `pay.qr` in `src/lib/data.js`. A QR code cannot be checked by eye,
so anything able to change the link behind one can redirect real money unseen.
`data.js` applies the payment target *after* the content spread, so a row
smuggling its own `pay` field is overwritten — the boundary holds by
construction, not by discipline. `schema.mjs` also rejects any URL in the prices
tab.

Credentials likewise. The database is shared by design and has no access log.

## Testing UI changes

**Use WebKit, not just Chromium.** The partner logos rendered at full size on
iPhone for days because every check was Chromium, where the CSS worked. Playwright
ships the real engine:

```js
import { webkit, devices } from 'playwright';
const b = await webkit.launch();
const p = await b.newPage({ ...devices['iPhone 13'] });
```

## Where things live

| | |
| --- | --- |
| Content, auth, storage, the publish sweep | Supabase, `eu-central-1` |
| Site and editor | Vercel, one deploy |
| Publish pipeline | GitHub Actions, `.github/workflows/deploy.yml` |
| Payment links, SMTP password, deploy token | Never in the database |

Credentials: `docs/credentials.md`.
