# Vinya Yoga

### 🌿 Live site: **[vinya-app-gold.vercel.app](https://vinya-app-gold.vercel.app)**

[![Deploy](https://github.com/gsalao/vinya/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/gsalao/vinya/actions/workflows/deploy.yml)

Marketing + booking site for Vinya, a small yoga studio in the Netherlands.
Built with **SvelteKit** and deployed on **Vercel**. Booking requests are emailed
to the studio after the visitor confirms a code sent to their address; the
newsletter stores sign-ups in **Supabase**.

Pages: Home, Classes, Instructors (Nikita Coppens), Events, About.

`main` is always what is live. Every push to `main` redeploys production; every
pull request gets its own throwaway preview URL. See
[CI/CD](#cicd-github-actions--vercel).

---

## Run it locally

Requires Node 22 and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev            # http://localhost:5173
```

Other commands:

```bash
pnpm build          # production build
pnpm preview        # preview the production build locally
```

The site runs fine with **no configuration** — in that "prototype mode" the
newsletter signup simulates a successful submit so you can demo it. The **booking
form needs configuration** (below) — without it the form tells the visitor that
booking is not set up, rather than pretending to send.

---

## Set up the booking email

The booking form emails the studio. Before it sends, the visitor has to type a
six-digit code that was emailed to *them*, which is what stops strangers booking
under someone else's address. There is no database: the code is proved with a
signed token, and the owner's mailbox is the record.

You need seven environment variables. Here is where each one comes from.

### Step 1 — Turn on 2-Step Verification for the studio Google account

Skip if it is already on. Google only offers app passwords on accounts that have
this enabled.

1. Sign in as the studio account at <https://myaccount.google.com/security>
2. Under **How you sign in to Google**, click **2-Step Verification**
3. Follow the prompts (it will ask for a phone number)

### Step 2 — Create an app password

A normal Google password will not work here, and you should never paste one into
a website's settings.

1. Go to <https://myaccount.google.com/apppasswords>
2. In **App name**, type `Vinya website`, click **Create**
3. Google shows a **16-character password** in a yellow box, like `abcd efgh ijkl mnop`
4. Copy it and **remove the spaces** → `abcdefghijklmnop`
5. Click Done. You cannot view it again — if you lose it, delete that entry and
   make a new one.

That 16-character string is `MAIL_PASS`. The Gmail address itself is `MAIL_USER`.

> Using Outlook instead? Create an app password at
> <https://account.microsoft.com/security> → Advanced security options → App
> passwords, and set `MAIL_HOST=smtp-mail.outlook.com` and `MAIL_PORT=587`.

### Step 3 — Generate the code-signing secret

In a terminal:

```bash
openssl rand -base64 32
```

Copy the whole line it prints. That is `OTP_SECRET`. It is only used to sign
confirmation codes; changing it later just invalidates codes already in flight,
which is harmless.

### Step 4 — Decide who receives bookings

`MAIL_TO` is a comma-separated list, and everyone on it gets the booking. Add or
remove people here later without touching the code.

```
MAIL_TO=nikita@example.com,studio@example.com
MAIL_CC=accounts@example.com
```

`MAIL_CC` is optional; leave it blank if you do not need one.

### Step 5 — Put the values into Vercel

1. Open <https://vercel.com/dashboard> and click the **vinya-app** project
2. **Settings** (top tabs) → **Environment Variables** (left sidebar)
3. Add each row below with **Add Another**. For **Environments**, tick
   **Production**, **Preview** and **Development** on every one.

   | Key          | Value                                             |
   | ------------ | ------------------------------------------------- |
   | `MAIL_HOST`  | `smtp.gmail.com`                                  |
   | `MAIL_PORT`  | `465`                                             |
   | `MAIL_USER`  | the studio Gmail address — the account that sends |
   | `MAIL_PASS`  | the 16 characters from step 2, no spaces          |
   | `MAIL_FROM`  | optional, `Vinya <same address as MAIL_USER>`     |
   | `MAIL_TO`    | who gets bookings, comma-separated                |
   | `MAIL_CC`    | optional, comma-separated                         |
   | `OTP_SECRET` | the line from step 3                              |

   `MAIL_USER` is the account mail is **sent from**; `MAIL_TO` is who **receives**
   bookings. They are often the same address, but they do not have to be.

4. Click **Save**.
5. Environment variables only apply to **new** deployments. Go to
   **Deployments**, open the most recent one, click the **⋯** menu → **Redeploy**.

> Do not prefix any of these with `PUBLIC_`. That prefix is what makes a variable
> visible to the browser, and it would publish your mail password.

### Step 6 — Check it works

Open the live site, book any class with your own email address, and confirm you
receive a code and the studio receives the booking. If the form says *"Booking is
not configured on this site yet"*, a variable is missing or the redeploy in step
5 has not finished.

### Running it locally

Copy `.env.example` to `.env` and fill in the same values. To test the flow
without sending real mail, set `MAIL_DEV_ECHO=1` — both emails are then printed
in your terminal instead of sent. That flag is ignored in production builds, so
it cannot silently swallow a real booking.

Echo mode still needs `OTP_SECRET` and `MAIL_TO` set to something; `MAIL_TO` can
be any address. It is not read in echo mode, but the endpoint refuses a booking
with no recipient rather than reporting a success nobody received.

Running locally, a missing variable is named in the response itself
(`Not configured — MAIL_TO is empty…`). In production that becomes a single
generic message, because which variable is unset is nobody else's business.

### The flow sends two different emails

Worth knowing before testing, so the first one does not look wrong:

| # | Goes to | Subject | When |
| - | ------- | ------- | ---- |
| 1 | the **visitor** | `104197 is your Vinya confirmation code` | on **Send request** |
| 2 | the **studio** (`MAIL_TO`) | `[VINYA] Kundalini Yoga` | after the code is confirmed |

The code sits in the subject of the first on purpose — it is readable from a
phone notification without opening the mail.

### Preflight: check the credentials on their own

```bash
pnpm mail:check                   # connect and authenticate
pnpm mail:check you@gmail.com     # also send a real test message
```

Run this before testing the booking form. It separates "are the SMTP credentials
right" from "does the form work", so a failure has one cause instead of two. It
reads `.env`, checks for the mistakes that actually happen — spaces left in the
app password, the account password used instead of an app password, 2-Step
Verification switched off — and names the likely fix.

### What the studio receives

```
Subject: [VINYA] Kundalini Yoga
Reply-To: visitor@email.com

Name: Amelie de Vries
Email: visitor@email.com
Mode of Payment: Tikkie €90 — 10-class pass (receipt attached)

Sessions:
  Kundalini Yoga · Tuesday Aug 18, 2026 · 10:30–11:30 · Tru Colours

Anything I should know:
  First class, a bit nervous.
```

Hitting reply in any mail client goes to the visitor, not to the studio mailbox.
If they uploaded a payment receipt it arrives as an attachment.

### Handing this over to the studio later

Nothing here is baked into the code, so a handover is an environment-variable
edit and a redeploy.

- **Change who receives bookings:** edit `MAIL_TO` in Vercel, redeploy. That is
  the whole job, and it is the change you will make most often.
- **Change the sending account:** the new owner creates their own app password
  (steps 1–2), then you replace `MAIL_USER`, `MAIL_PASS` and `MAIL_FROM`.

> **Set this up with a studio mailbox from day one, not a personal one.** Whatever
> address is in `MAIL_USER` is what every visitor sees as the sender of their
> confirmation code. Starting with a personal Gmail means handover leaves your
> address in the inbox of everyone who ever booked, and you cannot take it back.
> Create something like `vinyayoga@gmail.com` first, and handover becomes simply
> passing on that account.

`OTP_SECRET` never needs to change during a handover. Rotating it only
invalidates codes currently in flight.

### Known limits

- Consumer Gmail sends about **500 messages a day**, and a booking costs two.
- Rate limiting is held in each serverless instance's memory, so it slows casual
  abuse rather than guaranteeing a cap. See
  [the design note](docs/superpowers/specs/2026-08-18-booking-email-otp-design.md)
  for why that was an accepted trade and when to revisit it.
- Receipts are capped at 4 MB (Vercel's request limit is 4.5 MB). Photos are
  downscaled in the browser before upload, so this is rarely hit.

---

## Connect Supabase (optional, for the newsletter)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   `subscribers` table with insert-only access for anonymous visitors.
3. In **Settings → API**, copy the **Project URL** and the **anon public** key.
4. Create a `.env` file (copy `.env.example`) and fill them in:

   ```
   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

5. Restart `pnpm dev`. Newsletter sign-ups now land in your Supabase table.

On Vercel, add the same two variables under **Project → Settings → Environment
Variables**, then redeploy.

Booking requests do not go here — they are emailed to the studio. See
[Set up the booking email](#set-up-the-booking-email).

---

## CI/CD (GitHub Actions → Vercel)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) is the only
deploy path. It runs on:

| Event                 | What happens                                              |
| --------------------- | --------------------------------------------------------- |
| push to `main`        | build, then deploy to **production** (`--prod`)             |
| pull request → `main` | build, then deploy a **preview**, URL commented on the PR   |

The build runs before anything is uploaded, so a PR that does not compile fails
red and can never be merged into a deployable `main`. Concurrency is grouped per
branch with `cancel-in-progress`, so a slow older run cannot land on top of a
newer one and leave `main` stale.

### Why a deploy shows two URLs

Every deployment gets an **immutable per-deployment URL**
(`vinya-abc123-gsalaos-projects.vercel.app`) that always points at that one
build, so you can open any past deploy. A production deploy additionally
repoints the project's **stable production domains** at itself:

```
target : production
aliases: vinya-app-gold.vercel.app, vinya-app-gsalaos-projects.vercel.app, ...
```

Both serve the same build. `vercel deploy` prints the per-deployment one, so the
workflow resolves the stable alias afterwards and reports that as the live URL —
otherwise the repo's Deployments link would freeze on one old build.

Custom domains are attached to the project in Vercel, not configured here.
`vercel pull` only downloads project settings and environment variables; it does
not decide where a deploy lands. `--prod` does.

### Required repository secrets

**Settings → Secrets and variables → Actions**, or via the `gh` CLI:

```bash
# Create a token first at https://vercel.com/account/tokens
gh secret set VERCEL_TOKEN       # paste the token
gh secret set VERCEL_ORG_ID      # from .vercel/project.json  -> orgId
gh secret set VERCEL_PROJECT_ID  # from .vercel/project.json  -> projectId
```

`.vercel/` is gitignored — it holds the pulled environment file and never
belongs in the repo.

App environment variables — the `MAIL_*` set, `OTP_SECRET`, and the
`PUBLIC_SUPABASE_*` pair — do **not** go in GitHub. They live in Vercel's project
settings; `vercel pull` fetches them at build time. Keeping the mail password and
signing secret out of the repository is the point: a GitHub secret is readable by
every workflow, and these only ever need to exist on Vercel.

> **Do not also connect this repo under Vercel → Project → Git.** Vercel's own
> Git integration would deploy the same commit in parallel with this workflow,
> giving two deployments per push and a race over which one ends up live.

### Deploying by hand

Rarely needed, but the escape hatch:

```bash
npm i -g vercel
vercel login
vercel --prod
```

The adapter is pinned to `@sveltejs/adapter-vercel` with an explicit
`nodejs22.x` runtime, so a local build and a CI build produce identical output.

---

## Assets & branding

- Fonts: **Higuen Serif** (display) + **Glacial Indifference** (body), in
  `static/fonts`, loaded via `@font-face` in `src/app.css`.
- Logos and favicon live in `static/logos` and `static/favicon.png`.
- Photography is not final: image areas currently show a branded Vinya logo
  placeholder (`src/lib/components/Ph.svelte`). Drop real photos in and swap the
  `<Ph />` tags for `<img>` when the shoot is done.

Colours, type scale and spacing are defined as CSS custom properties at the top
of `src/app.css`.
