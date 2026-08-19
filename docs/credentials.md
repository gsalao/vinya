# Credentials inventory

Every secret this project uses: what it is for, where it lives, and when to
replace it. **No values here** — this file is committed to a public repository.
Keep the values in a password manager.

## The list

| Name | What it does | Where it lives | Rotate |
| ---- | ------------ | -------------- | ------ |
| `PUBLIC_SUPABASE_URL` | Address of the Supabase project | Vercel env, `.env`, GitHub Actions variable | Never (not secret) |
| `PUBLIC_SUPABASE_ANON_KEY` | Browser-side key. Row-level security decides what it can reach | Vercel env, `.env` | Only if RLS policies change | 
| `SUPABASE_SERVICE_ROLE_KEY` | **Full database access, bypasses row-level security.** Used by the sync script and the admin's server routes | Vercel env, GitHub Actions secret, `.env` | Immediately if exposed; otherwise on staff change |
| `GH_DISPATCH_TOKEN` | Fine-grained PAT, `gsalao/vinya` only, Contents read+write. Lets the admin trigger a publish | Vercel env, `.env` | Yearly — expiry is silent from the owner's side |
| `MAIL_HOST` `MAIL_PORT` `MAIL_USER` `MAIL_PASS` `MAIL_FROM` | SMTP for booking confirmations and failure notices | Vercel env, GitHub Actions secrets, `.env` | With the mailbox |
| `MAIL_TO` `MAIL_CC` | Who receives booking requests. Editable by the owner in the admin Settings screen | Supabase `settings` table | n/a — owner-managed |
| `OTP_SECRET` | Signs booking confirmation codes | Vercel env, `.env` | If exposed. Changing it invalidates codes in flight, which is harmless |
| `VERCEL_TOKEN` `VERCEL_ORG_ID` `VERCEL_PROJECT_ID` | Deploys from CI | GitHub Actions secrets | With the Vercel account |
| Supabase database password | Direct SQL access to Postgres | Password manager only | Not used day to day; keep it recoverable |

## Needs rotating before handover

These were transmitted over chat during setup. Nothing is at risk while the
project is empty, but replace them before real booking data exists:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Settings → API → Rotate
- `GH_DISPATCH_TOKEN` — GitHub → Settings → Developer settings → Fine-grained
  tokens → Regenerate
- The initial admin password — change it at first login in the admin Settings
  screen

## Rules

- **Nothing in this table goes in the repository.** `.env` is git-ignored; check
  with `git check-ignore -v .env` before pasting anything into it.
- `PUBLIC_` prefixed values reach the browser by design. Everything else is
  server-only, and adding that prefix to one of them would publish it.
- The repository is public, so a committed secret is a leaked secret the moment
  it lands — and it stays in the history after any correction. Rotate rather
  than rewrite history.
- `VINYA_SHEET_ID` is a GitHub Actions *variable*, not a secret, on purpose: it
  is not sensitive, and masking it makes a misconfiguration much harder to
  diagnose. It disappears when the Sheets pipeline is replaced.

## Where each one is set

**Vercel** — Project → Settings → Environment Variables. Needed for the site to
run: both `PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `GH_DISPATCH_TOKEN`,
the `MAIL_*` set, and `OTP_SECRET`.

**GitHub Actions** — Settings → Secrets and variables → Actions. Needed for the
publish pipeline: `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, the
`MAIL_*` set, and the three `VERCEL_*` values.

**Local `.env`** — everything, for development and for running the sync by hand.
