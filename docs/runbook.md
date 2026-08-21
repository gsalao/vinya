# Runbook — the content system

For whoever maintains this next, including whoever wrote it. Read
`docs/architecture.md` first if you have not; this file is what to do when
something is wrong.

## The one-line summary

The owner edits at `/vinyadmin`. Saving writes to Supabase and fires a GitHub
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
pnpm test             # 248 tests
pnpm dev              # local site + admin at :5173
pnpm health           # the daily checks, needs SITE_URL
pnpm images:backup    # copy the image bucket into ./backup, list orphans
pnpm images:restore   # dry run; add --apply to upload
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
then fix the content in `/vinyadmin`.

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

## Keeping the bill small

Code cannot guarantee a bill. Only a cap can. Everything below the first
section is damage limitation; the first section is the actual guarantee, and
it is clicked, not written.

### Set the caps (do this, nothing else replaces it)

- **Vercel** → Settings → Billing → Spend Management. Set a hard limit and an
  alert well below it. Vercel can pause the project at the limit; that is the
  behaviour you want on a studio site, because a paused site is recoverable and
  a surprise invoice is not.
- **Supabase** → Organization → Billing → Cost Control. Set a spend cap. The
  free tier already caps by pausing; on any paid plan it does not, and
  **Storage egress is the uncapped vector here** — every image on the site is a
  public URL anyone can request in a loop.
- Put both alert emails somewhere the studio actually reads, not only the
  developer's inbox.

### What the app does about it

| Door | Limit | Where |
| --- | --- | --- |
| Send a sign-in code | 5 per IP, 3 per address / 15 min | `api/otp/+server.js` |
| Submit a booking | 10 per IP / 15 min | `api/booking/+server.js` |
| Newsletter signup | 5 per IP, 3 per address / hour | `api/subscribe/+server.js` |
| Sign in to the editor | 15 per IP, 8 per address / 15 min | `vinyadmin/login/+page.server.js` |

Counting happens in Postgres via `rate_limit_hit` (`supabase/security.sql`), so
every serverless instance counts against one total. `ratelimit-shared.js` falls
back to the in-memory counter when the database cannot be reached — a Supabase
outage degrades the limit to best-effort rather than removing it, which matters
because the OTP endpoint spends the studio's own mail quota and enough abuse
there gets the sending account suspended.

The fallback announces itself in the logs:

```
[ratelimit] shared counter unavailable, falling back: ...
```

Seeing that regularly means `security.sql` was never run, or the function was
dropped. The limits still hold approximately, but not exactly.

### The publish sweep

`pg_cron` calls `/api/publish/tick` every five minutes. It was every minute,
which cost ~43,000 invocations a month to catch something that rarely happens,
since saving fires its own dispatch. The worst case at five minutes is that a
stranded publish waits four minutes longer.

## Security boundaries worth knowing

**The anon key is public.** It ships in the site's JavaScript. Anything `anon`
is granted in Postgres is granted to the entire internet, reachable directly at
PostgREST without touching Vercel — so no application rate limit can see it.
The newsletter box worked exactly that way once. `no-browser-db.test.js` fails
if any browser-reachable module constructs a Supabase client, which is the only
reliable way to stop it coming back.

**The editor's URL lives in one constant.** `ADMIN_BASE` in
`src/lib/admin/paths.js`. SvelteKit takes the URL from the route directory
name and the guard takes it from the constant, and nothing but
`paths.test.js` makes them agree. They fail asymmetrically: a stale link 404s
and someone notices, a stale guard prefix leaves the editor unauthenticated
and looks normal. Moving the editor means renaming both, together.

**Renaming the editor is not a security control.** It cuts scanner noise,
which is a cost measure. Treat the password and the allow-list as the control.

**There is no 2FA.** It was considered and deliberately deferred: for a
single non-technical owner with nobody to call, the lockout risk on a lost
phone outweighed the credential-stuffing risk it would remove. Revisit if the
studio ever runs more than one or two accounts, since a second admin is what
makes recovery possible.

## Monitoring and alerting

Vercel shows traffic, function logs and speed. All real, none of it about this
system. It cannot tell you that a publish was claimed and never released, that
the sweep stopped firing, or that the image bucket is filling — failures that
leave the site looking perfectly healthy while it quietly refuses to change
again. `.github/workflows/health.yml` watches those, daily.

| Check | Fires when |
| --- | --- |
| Site responds | Not 200, or 200 with a truncated page |
| Publish stuck | `publishing` for over 30 min — **this blocks every later publish** |
| Sweep stalled | `pending` for over 20 min (four missed sweeps) |
| Failure ignored | `failed` for over 24 h — she was told and has not fixed it |
| Storage filling | Over 80% of the limit; critical over 95% |

**A failed run is the alert.** GitHub emails whoever watches the repository, so
this needs no monitoring service and no new credential. Setting the `ALERT_TO`
secret adds a direct mail on top. It is deliberately not `MAIL_TO`: that is
where booking enquiries go, and nothing here is the owner's to act on — a
technical alert she cannot use is how she learns to ignore mail from the site.

A fresh publish failure stays quiet on purpose. She already sees it in the
editor and gets a mail; repeating it to the developer the same day is noise.
After a day it means she did not fix it and the site has been stale since,
which is worth knowing.

Run it by hand any time:

```bash
SITE_URL=https://your-site pnpm health
```

**⚠ GitHub disables scheduled workflows after 60 days with no repository
activity.** Publishing content pushes a commit, so ordinary use keeps the
schedule alive. A studio that does not touch the site for two months gets an
email from GitHub asking to re-enable it — and until someone clicks, *nothing
is watching.* This is the one part of the monitoring that can fail silently.

## Backups

**Content is already backed up.** Every publish is a commit, so git history
holds every word the site has shown. `git revert` restores it.

**Photos are the gap.** They deliberately never enter the repository — eleven
images were already 7 MB and git never forgets — so deleting one deletes it.
`.github/workflows/backup-images.yml` copies the bucket monthly.

### Where to find one

GitHub → Actions → **Backup images** → pick a run → **Artifacts** →
`vinya-images-<run id>`. Retention is 90 days, so a monthly cadence keeps
roughly three generations. Anything that must outlive that has to be downloaded
and kept somewhere deliberate.

The archive holds the image files plus `manifest.json`: what was taken, when,
and the reconciliation below. It contains nothing else on purpose — in
particular not the `settings` table, which holds the editors' email addresses,
because artifacts on a public repository are public. The images already are.

### Restoring

```bash
unzip vinya-images-123456.zip -d recovered
node scripts/restore-images.mjs recovered            # dry run — shows the plan
node scripts/restore-images.mjs recovered --apply    # actually uploads
```

**The site needs no change and no redeploy.** Content stores each photo as a
full URL ending in its filename, so re-uploading under the same names makes
every existing reference resolve again. That falls out of the naming convention
`shape.mjs` already depends on, and it is why the restore is twenty lines.

Dry run is the default because a backup applied over newer photos is itself
data loss. Files that changed since the backup are listed separately, marked
`~`, and applying replaces them with the older copy.

Supabase serves images with a year-long cache header, so someone who already
saw a broken image may keep seeing it for a while after a restore.

### What a backup does not do

It does not help with a full bucket. That was the question worth asking, and
the honest answer is that a copy of the files is the opposite of what a
capacity problem needs. A full bucket needs **space** — delete or upgrade. The
monitoring above is what addresses capacity; the backup addresses deletion and
corruption. They are different failures.

It is also not a failover. Nothing switches to it automatically, and nothing
should: a live mirror that silently serves stale photos is harder to notice
than a broken image.

### Orphans — what to delete when it does fill

Every backup reconciles the bucket against what the site actually points at:

- **orphans** — stored files nothing references. Safe to delete, and the first
  thing to remove when space runs short.
- **missing** — references with no file behind them. A broken image on the live
  site, which no dashboard would ever show you.

Both are printed by the run and recorded in `manifest.json`.

```bash
pnpm images:backup     # locally, into ./backup (gitignored)
```

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
