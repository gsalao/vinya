# Vinya Yoga

### 🌿 Live site: **[vinya-app-gold.vercel.app](https://vinya-app-gold.vercel.app)**

[![Deploy](https://github.com/gsalao/vinya/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/gsalao/vinya/actions/workflows/deploy.yml)

Marketing + booking site for Vinya, a small yoga studio in the Netherlands.
Built with **SvelteKit**, a **Supabase** backend for booking requests and the
newsletter, and deployed on **Vercel**.

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
booking form and newsletter simulate a successful submit so you can demo the
whole flow. Wire up Supabase (below) when you want submissions actually stored.

---

## Connect Supabase (optional, for real submissions)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard: **SQL Editor → New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and **Run**. This creates the
   `booking_requests` and `subscribers` tables with insert-only access for
   anonymous visitors.
3. In **Settings → API**, copy the **Project URL** and the **anon public** key.
4. Create a `.env` file (copy `.env.example`) and fill them in:

   ```
   PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```

5. Restart `pnpm dev`. Bookings and sign-ups now land in your Supabase tables.

On Vercel, add the same two variables under **Project → Settings → Environment
Variables**, then redeploy.

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

App environment variables (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) do
**not** go in GitHub. They live in Vercel's project settings; `vercel pull`
fetches them at build time.

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
