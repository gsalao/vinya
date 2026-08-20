# Handover — what is set up, and what is left

> **Historical.** Google Sheets was never used in production — creating a
> Google Cloud project on this account proved impossible. See
> `docs/adr/0001-cms-not-google-sheets.md`. This document is replaced by `docs/handover.md`.
> Kept for the reasoning it records; do not follow its steps.

Everything in this document is **done**. It is kept as a record of where things
live and what to check if something stops working.

The owner edits the site at **https://vinya-app-gold.vercel.app/admin**.

## How a change reaches the site

She edits a field and presses Save. The change is stored immediately. Thirty
seconds after she stops, a scheduled sweep in the database asks the site to
publish; the site validates everything, commits the result, and deploys. About
ninety seconds later it is live, and the banner at the top of the editor says so.

If anything she typed is malformed, nothing publishes: the site keeps showing the
last version that worked, and the editor tells her which row to fix.

## What is already configured

| Piece | Where | State |
| ----- | ----- | ----- |
| Content database | Supabase project `hggzymrkzzcnxpemxija`, region `eu-central-1` | 14 tables, RLS on all of them, seeded |
| Editor login | `salaogerard@gmail.com` | created, allow-listed in `settings.admin_emails` |
| Publish sweep | Supabase `cron.job` → `vinya-publish-tick`, every minute | active |
| Site environment | Vercel, production and preview | 5 variables set |
| Publish pipeline | GitHub Actions | secret + variable set |

## The one thing left for you

**Change the password at first sign-in.** Editor → Settings → Change your
password. The one used to create the account went through a chat transcript and
should be treated as burned.

Two credentials should also be rotated before the site is handed to the studio,
for the same reason — see `docs/credentials.md`:

- the Supabase `service_role` key
- the GitHub dispatch token

## Connecting to the database by hand

Direct connections (`db.<ref>.supabase.co`) are refused on this project and are
IPv6-only anyway. Use the pooler, and note the username carries the project ref:

```
postgresql://postgres.hggzymrkzzcnxpemxija:<password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

A plain `postgres` username fails against the pooler — it needs the tenant form.

## When something looks wrong

**The editor says "Publishing…" and stays there.** The sweep runs once a minute
and the build takes about ninety seconds, so up to three minutes is normal.
Longer than that, check GitHub Actions for a failed run.

**She saved and nothing happened.** Check `publish_state` in Supabase. If
`status` is `failed`, the message says why. If it is `pending` with a
`publish_after` in the past, the sweep is not running — check
`select * from cron.job` and that `PUBLISH_TICK_SECRET` matches between Vercel
and the scheduled job.

**Everything publishes twice.** Only one thing can cause this: the Action's own
commit re-triggering the workflow. The commit carries `[skip ci]` and is made
with the default `GITHUB_TOKEN`, which does not re-trigger — if it started
happening, one of those two changed.

**A validation message mentions a row she cannot find.** Row numbers count from
the top of that section as displayed, starting at 1.

## What was not built

- Photos. Adding a new image is still a developer task; the editor lets her
  change which file a teacher or partner points at, not upload a new one.
- Booking enquiries are emailed, not stored. Her mailbox is the record.
- One editor account. Multiple people with separate logins would need roles and
  an audit trail, which is a different piece of work — though `updated_at` is
  already recorded on every row, so the data would not need migrating.
