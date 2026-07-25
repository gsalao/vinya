# Vinya Yoga

Marketing + booking site for Vinya, a small yoga studio in the Netherlands.
Built with **SvelteKit**, a **Supabase** backend for booking requests and the
newsletter, and deployed on **Vercel**.

Pages: Home, Classes, Instructors (Nikita Coppens), Events, About.

---

## Run it locally

Requires Node 18+ and [pnpm](https://pnpm.io).

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

## Deploy to Vercel

```bash
npm i -g vercel      # if not installed
vercel login
vercel --prod
```

Vercel auto-detects SvelteKit (via `@sveltejs/adapter-auto`) — no extra config
needed. The first `vercel` run links the project and gives you a
`*.vercel.app` URL.

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
