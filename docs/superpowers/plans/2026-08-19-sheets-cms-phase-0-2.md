# Spreadsheet Content System — Phases 0-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every editorial string on the site editable from a Google Sheet, with validated auto-publishing thirty seconds after the owner stops typing, and visible success/failure state in the sheet itself.

**Architecture:** All content moves into a single generated JSON file that `data.js` and a new `copy.js` read from. A GitHub Action, triggered by a debounced Apps Script dispatch, reads the spreadsheet through a service account, validates every row against a schema, writes that JSON, commits it, and deploys through the existing Vercel workflow. Validation failure aborts before anything is written, so the last good content stays live.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), vitest, pnpm, Node 22, Vercel CLI, GitHub Actions, Google Apps Script, Google Sheets v4 REST API.

**Spec:** `docs/superpowers/specs/2026-08-19-sheets-cms-design.md`

**Scope:** This plan covers Phases 0, 1 and 2 of that spec — the smallest set that is usable by a non-technical owner. Phase 3 (settings lane), Phase 4 (Drive images), Phase 5 (inquiries) and Phase 6 (handover docs) get their own plans.

## Global Constraints

- **Node 22.x**, pnpm as package manager. `pnpm install --frozen-lockfile` runs in CI, so any new dependency must be committed to `pnpm-lock.yaml`.
- **The repository is public.** Nothing committed may contain an email address, credential, or personal data. `MAIL_TO` and booking data are explicitly out of scope for this plan for that reason.
- **Never `{@html}`.** Sheet content is untrusted input. All content renders as text nodes.
- **`pay.url` and `pay.qr` stay hardcoded in `src/lib/data.js`.** No sheet, no generated file, no exceptions.
- **The `prices` tab rejects any cell matching `https?://`.** Enforced by the validator, not by convention.
- **Copy keys follow `page.section.role`** — lowercase, dot-separated, e.g. `home.hero.title`.
- **The copy accessor is named `txt`.** Not `t` or `c`: both are already used as loop variables in `teachers/+page.svelte` and `+page.svelte`, and the manifest test greps for the accessor by name.
- **Existing test suite must stay green:** 55 tests across 4 files. `pnpm test`.
- Pre-existing a11y warning at `src/lib/components/Photo.svelte:108` is unrelated and out of scope. Do not fix it here; it will show in every vitest run.

## File Structure

**Created:**

| Path | Responsibility |
| ---- | -------------- |
| `src/lib/content.generated.json` | All site content. Written by the sync script, committed, never hand-edited after Task 6 |
| `src/lib/copy.js` | Copy accessor `txt()` and the paragraph splitter `paras()`. Nothing else |
| `src/lib/copy-manifest.js` | The list of every copy key the markup uses. The contract between markup and sheet |
| `src/lib/copy.test.js` | Unit tests for `paras()` and `txt()` |
| `src/lib/copy-manifest.test.js` | Greps `.svelte` files and fails when markup and manifest disagree |
| `src/routes/pages.snapshot.test.js` | SSR-renders all five routes. The safety net for Phase 0 |
| `scripts/lib/sheets.mjs` | Service-account auth and Sheets v4 read/write. No knowledge of Vinya's data |
| `scripts/lib/schema.mjs` | Per-tab validation rules. Pure functions, no I/O |
| `scripts/lib/schema.test.js` | A failing case per validation rule |
| `scripts/lib/shape.mjs` | Turns flat sheet rows into the nested shape `content.generated.json` needs. Pure |
| `scripts/lib/shape.test.js` | Fixture-driven tests for grouping and derivation |
| `scripts/sync-content.mjs` | The orchestrator: read, validate, shape, write, report. I/O only |
| `scripts/seed-sheet.mjs` | Run-once: writes today's content into the empty spreadsheet |
| `apps-script/Code.gs` | Debounce, dispatch, menu. Committed for version control; pasted into the Script editor |

**Modified:**

| Path | Change |
| ---- | ------ |
| `src/lib/data.js` | Becomes a reader over `content.generated.json`. Keeps derived exports and `pay` |
| `src/routes/+page.svelte` | Inline copy replaced by `txt()` calls; next-gathering band derived |
| `src/routes/about/+page.svelte` | Inline copy replaced by `txt()` calls; duplicated founder paragraph fixed |
| `src/routes/classes/+page.svelte` | Inline copy replaced by `txt()` calls |
| `src/routes/teachers/+page.svelte` | Inline copy replaced by `txt()` calls |
| `src/routes/events/+page.svelte` | Inline copy replaced by `txt()` calls |
| `src/lib/components/Footer.svelte` | Inline copy replaced by `txt()` calls |
| `.github/workflows/deploy.yml` | `repository_dispatch` trigger, production flags, content concurrency group, sync + commit steps |
| `package.json` | Adds `google-auth-library` devDependency and two scripts |

**Why these boundaries:** `sheets.mjs` knows Google but not Vinya. `schema.mjs` and `shape.mjs` know Vinya but do no I/O, so they are testable with plain fixtures and no network. `sync-content.mjs` is the only file that does both, and it stays thin. That split is what makes Task 8 and Task 9 independently reviewable.

---

## Phase 0 — Foundations

The site must render identically at the end of Task 4. Tasks 5 and 6 change output deliberately, and the snapshot diff is how you confirm the change was the intended one.

### Task 1: SSR snapshot harness

Nothing else in Phase 0 is safe without this. It renders every route to a string and freezes the result, so any accidental word change during extraction shows up as a failing diff.

**Files:**
- Create: `src/routes/pages.snapshot.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: a committed snapshot file at `src/routes/__snapshots__/pages.snapshot.test.js.snap` that later tasks must either leave untouched (Tasks 2-4) or update deliberately (Tasks 5-6)

- [ ] **Step 1: Write the snapshot test**

Create `src/routes/pages.snapshot.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Home from './+page.svelte';
import About from './about/+page.svelte';
import Classes from './classes/+page.svelte';
import Teachers from './teachers/+page.svelte';
import Events from './events/+page.svelte';
import Footer from '$lib/components/Footer.svelte';

// The safety net for the copy extraction. `render` from svelte/server returns the
// markup as a string with no DOM involved, so the `use:reveal` action never runs
// and no jsdom is needed. Any word that changes during extraction shows up here as
// a diff instead of reaching the site.
const pages = [
	['home', Home],
	['about', About],
	['classes', Classes],
	['teachers', Teachers],
	['events', Events],
	['footer', Footer]
];

describe('rendered pages', () => {
	for (const [name, Component] of pages) {
		it(`${name} renders unchanged`, () => {
			const { body } = render(Component);
			expect(body).toMatchSnapshot();
		});
	}
});
```

- [ ] **Step 2: Run it to generate the snapshots**

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: PASS, 6 tests, with vitest reporting `6 written` snapshots. A vite-plugin-svelte a11y warning about `Photo.svelte:108` prints; it is pre-existing and expected.

- [ ] **Step 3: Verify the snapshots actually captured content**

Run: `wc -c src/routes/__snapshots__/pages.snapshot.test.js.snap && grep -c "Bloom into who you already are" src/routes/__snapshots__/pages.snapshot.test.js.snap`
Expected: a file over 40,000 bytes, and a count of 1. An empty or tiny snapshot means the render silently produced nothing and the net is not real.

- [ ] **Step 4: Verify the net catches a change**

Temporarily edit `src/routes/events/+page.svelte:14`, changing `Gatherings, month by month.` to `Gatherings, month by MONTH.`

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: FAIL on `events renders unchanged`, with a diff showing that string.

Revert the edit and re-run. Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: 5 test files, 61 tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/routes/pages.snapshot.test.js src/routes/__snapshots__/
git commit -m "test: snapshot the SSR output of every route

The copy extraction that follows touches every page, and a mistyped word
would otherwise reach the site with nothing to catch it. render() from
svelte/server returns the markup as a string, so this needs no jsdom and
no new dependency."
```

---

### Task 2: The copy module

`paras()` and `txt()`, plus the generated file they read from. Home page copy only — the remaining pages follow in Task 3, so this task stays small enough to review.

**Files:**
- Create: `src/lib/content.generated.json`, `src/lib/copy.js`, `src/lib/copy.test.js`
- Modify: `src/routes/+page.svelte`

**Interfaces:**
- Consumes: the snapshot harness from Task 1
- Produces: `txt(key: string) => string` which throws on an unknown key; `paras(s: string) => string[]`; and `src/lib/content.generated.json` with a top-level `copy` object mapping key to string. Tasks 3-6 add to that same file

- [ ] **Step 1: Write the failing tests**

Create `src/lib/copy.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { paras, txt } from './copy.js';

describe('paras', () => {
	// The owner writes long passages in one cell using Alt+Enter. She should not
	// have to know whether one line break or two makes a new paragraph.
	it('splits on a single newline', () => {
		expect(paras('One.\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('splits on a blank line', () => {
		expect(paras('One.\n\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('handles Windows line endings', () => {
		expect(paras('One.\r\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('trims each paragraph and drops empties', () => {
		expect(paras('  One.  \n\n\n   \n  Two.  ')).toEqual(['One.', 'Two.']);
	});

	it('returns a single paragraph unchanged', () => {
		expect(paras('Just the one.')).toEqual(['Just the one.']);
	});

	it('returns an empty array rather than throwing on nullish input', () => {
		expect(paras(undefined)).toEqual([]);
		expect(paras(null)).toEqual([]);
		expect(paras('')).toEqual([]);
	});
});

describe('txt', () => {
	it('returns the string for a known key', () => {
		expect(txt('home.hero.title')).toBe(
			'Breathe through the hesitation. Bloom into who you already are.'
		);
	});

	// A deleted sheet row must not blank a headline on a live page. Throwing here
	// is what turns that into a build failure in Task 4.
	it('throws on an unknown key, naming it', () => {
		expect(() => txt('home.hero.nonexistent')).toThrow('home.hero.nonexistent');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/copy.test.js`
Expected: FAIL — `Failed to resolve import "./copy.js"`.

- [ ] **Step 3: Create the generated content file**

Create `src/lib/content.generated.json`. Home-page keys only at this stage. Copy each string **verbatim** from the current markup, including the curly apostrophes where they appear:

```json
{
  "copy": {
    "home.hero.title": "Breathe through the hesitation. Bloom into who you already are.",
    "home.hero.cta.book": "Book a class",
    "home.hero.cta.events": "See what's coming",
    "home.practice.eyebrow": "The practice",
    "home.practice.title": "Schedule for this week",
    "home.practice.link": "See the full timetable",
    "home.practice.book": "Book a place",
    "home.about.eyebrow": "About Vinya",
    "home.about.title": "A space with room to breathe.",
    "home.about.body": "Vinya is a yoga inspired initiative in the Netherlands. Most people who find us are somewhere in the middle of: a change, a tiredness, a hesitation they can't name or ready to step out of their comfort zone. Either you're ready to work on your physical and mental state.",
    "home.about.link": "More about Vinya",
    "home.pillars.1.title": "Breathe",
    "home.pillars.1.body": "Breathe is the bridge between who you are guarded and who you are open. We start there, every time.",
    "home.pillars.2.title": "Connect",
    "home.pillars.2.body": "Moving together creates connection together. Come for the practice, stay for the connection.",
    "home.pillars.3.title": "Bloom",
    "home.pillars.3.body": "Come as you are today, not as the version you think is ready.",
    "home.teachers.eyebrow": "Your teachers",
    "home.teachers.title": "Held by people who came to yoga the long way around.",
    "home.teachers.cta.meet": "Meet the teachers",
    "home.teachers.cta.offerings": "Explore our offerings",
    "home.gathering.eyebrow": "Next gathering",
    "home.gathering.cta": "Reserve your place",
    "home.gathering.link": "All events",
    "home.testimonials.eyebrow": "In their words",
    "home.testimonials.title": "Quietly, people keep coming back.",
    "home.testimonials.rating": "Loved by a small, growing circle · real reviews to be gathered here",
    "home.gallery.divider": "In this together",
    "home.gallery.quote": "Leave a little more room to bloom.",
    "home.partners.divider": "Partners & Facilitators",
    "home.jump.eyebrow": "Where to next",
    "home.jump.classes": "Find a class for you",
    "home.jump.events": "Workshops & gatherings",
    "home.jump.prices": "Passes & prices",
    "home.jump.teachers": "Meet your teachers"
  }
}
```

Note on `home.pillars.2.body`: the current markup has a trailing newline inside that `<p>`. It is whitespace-collapsed by the browser and carries no meaning, so it is dropped here. The snapshot will show that one-character difference in Step 6 — accept it.

Note on `home.partners.divider` and `home.jump.events`: the markup writes these as `Partners &amp; Facilitators` and `Workshops &amp; gatherings`. The entity is HTML escaping, not content. Store the literal `&`; Svelte re-escapes it on render, so the output is unchanged.

- [ ] **Step 4: Write the copy module**

Create `src/lib/copy.js`:

```js
import content from './content.generated.json';

/** Alt+Enter inside a spreadsheet cell, or a blank line, both mean "new
 *  paragraph". Split on any run of newlines so the owner does not have to know
 *  which one the build wants. */
export const paras = (s) =>
	String(s ?? '')
		.split(/\r?\n\s*\r?\n|\r?\n/)
		.map((p) => p.trim())
		.filter(Boolean);

/** Named `txt` rather than `t` or `c`: both of those are already loop variables
 *  in the markup, and copy-manifest.test.js finds keys by grepping for this name.
 *
 *  Throwing on an unknown key is deliberate. The alternative — returning '' — is
 *  how a deleted spreadsheet row silently blanks a headline on a live page. */
export function txt(key) {
	const value = content.copy[key];
	if (value === undefined) {
		throw new Error(`copy: no such key "${key}". Add a row to the copy tab, or fix the markup.`);
	}
	return value;
}
```

- [ ] **Step 5: Run to verify the tests pass**

Run: `pnpm vitest run src/lib/copy.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 6: Replace the home page copy**

In `src/routes/+page.svelte`, add `txt` to the imports:

```js
import { txt } from '$lib/copy.js';
```

Then replace each literal with its key. The hero, for example:

```svelte
<h1>{txt('home.hero.title')}</h1>
<div class="hero-cta">
	<button class="btn btn-primary lg" onclick={() => openBooking('a class')}>{txt('home.hero.cta.book')}</button>
	<a class="btn btn-ghost lg" href="/events">{txt('home.hero.cta.events')}</a>
</div>
```

The philosophy triptych:

```svelte
<div class="wrap triptych">
	{#each [1, 2, 3] as i (i)}
		<div class="t reveal" use:reveal>
			<div class="h">{txt(`home.pillars.${i}.title`)}</div>
			<p>{txt(`home.pillars.${i}.body`)}</p>
		</div>
	{/each}
</div>
```

Work through every key in Step 3 the same way. Leave alone: the `marquee` band (`Breathe`/`Connect`/`Bloom`/`Vinya` — it is `aria-hidden` decoration repeated six times, not editorial copy), the `Book {c.name}` template, and everything already coming from `data.js`.

The next-gathering band's `<h2>` and `<p>` are **not** in the key list. They are handled in Task 5, where they become derived. Leave them as literals for now.

- [ ] **Step 7: Run the snapshot to prove nothing changed**

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: PASS on all six. If `home renders unchanged` fails, read the diff: it is either the documented `home.pillars.2.body` newline, or a typo in a key's value. Fix the value; do not update the snapshot to match a typo.

If the only diff is that single trailing newline, run `pnpm vitest run src/routes/pages.snapshot.test.js -u` to accept it, and say so in the commit message.

- [ ] **Step 8: Run the whole suite**

Run: `pnpm test`
Expected: 6 test files, 69 tests passed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/copy.js src/lib/copy.test.js src/lib/content.generated.json src/routes/+page.svelte src/routes/__snapshots__/
git commit -m "feat: move home page copy behind keys

txt() throws on an unknown key rather than returning an empty string,
because a deleted spreadsheet row that silently blanks a headline is the
failure this whole system has to prevent.

paras() splits on any run of newlines so the owner can use one Alt+Enter
or two and get the same paragraphs either way."
```

---

### Task 3: The remaining pages

Same operation as Task 2, applied to the other four routes and the footer. Separated because a reviewer can reject one page's extraction while accepting the home page's.

**Files:**
- Modify: `src/lib/content.generated.json`, `src/routes/about/+page.svelte`, `src/routes/classes/+page.svelte`, `src/routes/teachers/+page.svelte`, `src/routes/events/+page.svelte`, `src/lib/components/Footer.svelte`

**Interfaces:**
- Consumes: `txt` and `paras` from `src/lib/copy.js` (Task 2)
- Produces: a `copy` object in `content.generated.json` covering all five routes plus the footer. Task 4 asserts it matches the markup exactly

- [ ] **Step 1: Add the remaining keys to `content.generated.json`**

Add to the `copy` object, verbatim from the markup. Curly apostrophes (`’`) in the about page are intentional — keep them exactly:

```json
    "about.hero.eyebrow": "About Vinya",
    "about.hero.title": "A space with room to breathe.",
    "about.hero.lede": "Vinya is a yoga inspired initiative in the Netherlands. Most people who find us are somewhere in the middle of: a change, a tiredness, a hesitation they can’t name or ready to step out of their comfort zone. Either you’re ready to work on your physical and mental state.",
    "about.hero.body": "The practice sits in two places at once: The physical and the mental. Breathe is rarely just breathe. It’s the beginning of changing the narrative. Using it as a tool to control our mind, so we are choosing who we become.\n\nVinya is just creating a space for you to make space for yourself.",
    "about.expect.eyebrow": "What to expect",
    "about.expect.title": "How the room is held.",
    "about.expect.1.title": "How we teach",
    "about.expect.1.body": "Personal attention is our non negotiable. There are hands-on adjustments and deepening, if consent has been given.",
    "about.expect.2.title": "Who it’s for",
    "about.expect.2.body": "Complete beginners, and regulars who want to deepen their practice.",
    "about.expect.3.title": "Training",
    "about.expect.3.body": "Teaching hours and certifications, to be confirmed and listed here.",
    "about.expect.4.title": "Beyond class",
    "about.expect.4.body": "1:1 holistic sessions, private groups, and retreats a few times a year.",
    "about.expect.cta.book": "Book a 1:1 session",
    "about.expect.cta.timetable": "See the timetable",
    "about.founder.eyebrow": "About the founder",
    "about.founder.name": "Nikita Coppens",
    "about.founder.role": "Founder · Yoga, breathwork and Kirtan",
    "about.founder.body": "Before starting Vinya, Nikita has been studying different forms of yoga in India, exploring the body, movement, breath and the connection between physical and mental wellbeing. After her studies, she travelled to Sri Lanka, where she taught yoga and continued to deepen her experience of working with the body.\n\nOriginally from Amsterdam, Nikita now lives and works there, bringing these different experiences together through Vinya. Through yoga, movement, breath and sound, she creates spaces where people can reconnect with their bodies and create more space for healing, awareness and connection.",
    "about.founder.link": "Meet the teachers",
    "about.find.divider": "Find us",
    "about.find.title": "Where we practice.",
    "about.find.body": "Classes are held at partner studios around the city. Every class on the timetable says where it meets.",
    "about.find.maps": "Open in maps",

    "classes.hero.eyebrow": "Classes",
    "classes.hero.title": "A week with room in it.",
    "classes.hero.body": "Classes facilitated in different studios. Book the class you need. No membership, no pressure to keep a streak.",
    "classes.detail.class": "Class",
    "classes.detail.session": "Session",
    "classes.detail.cue": "Details",
    "classes.timetable.eyebrow": "Weekly rhythm",
    "classes.timetable.title": "The timetable",
    "classes.timetable.hint": "Tap a session to book",
    "classes.timetable.book": "Book",
    "classes.prices.eyebrow": "Passes & prices",
    "classes.prices.title": "Pay for the week you need.",
    "classes.prices.note": "Paying a pass and booking a class are separate — pay whenever suits, book when you know the date.",
    "classes.offerings.eyebrow": "Our offerings",
    "classes.offerings.title": "Beyond the weekly mat.",
    "classes.offerings.enquire": "Enquire",
    "classes.faq.eyebrow": "First time?",
    "classes.faq.title": "Everything you're quietly wondering",

    "teachers.hero.eyebrow": "Who we are",
    "teachers.hero.title": "Meet our teachers.",
    "teachers.hero.timetable": "See the timetable",
    "teachers.work.eyebrow": "How Vinya teachers work",
    "teachers.work.title": "Care first, always.",
    "teachers.work.1.title": "How we teach",
    "teachers.work.1.body": "Patient and attuned. We meet you where you are today, offering an invitation as clearly as an instruction.",
    "teachers.work.2.title": "Care background",
    "teachers.work.2.body": "Years in Dutch mental-health care (GGZ) as a personal support worker, and training as an addiction counsellor.",
    "teachers.work.3.title": "Studied in India",
    "teachers.work.3.body": "Yoga, sound healing and alternative medicine, where our view of health widened to body and mind as one.",
    "teachers.work.4.title": "Beyond class",
    "teachers.work.4.body": "1:1 holistic sessions and community sound-healing gatherings, built around not standing alone.",

    "events.hero.eyebrow": "Events",
    "events.hero.title": "Gatherings, month by month.",
    "events.hero.body": "Workshops, full-moon flows, sound baths and the occasional day retreat. Each one is its own thing, with its own place and price.",
    "events.reserve": "Reserve",
    "events.archive.label": "Past gatherings",

    "footer.tagline": "Breathe. Connect. Bloom.",
    "footer.site.heading": "Site",
    "footer.practical.heading": "Practical",
    "footer.practical.faq": "First-timer FAQ",
    "footer.practical.prices": "Passes & prices",
    "footer.practical.find": "Find us",
    "footer.subscribe.heading": "Stay close",
    "footer.subscribe.body": "A quiet note when a new month of events opens. Nothing else.",
    "footer.subscribe.cta": "Join",
    "footer.subscribe.placeholder": "you@email.com",
    "footer.copyright": "© 2026 Vinya Yoga"
```

Two things to notice while transcribing:

`about.hero.body` merges what are currently two separate `<p>` elements at `about/+page.svelte:27-28` into one cell separated by `\n\n`. That is the paragraph splitter doing its job — the owner gets one editable block instead of two rows she has to keep in order.

`about.founder.body` is **two** paragraphs, not three. The current markup at `about/+page.svelte:80-84` renders the identical paragraph twice — a copy-paste bug that is live right now. Task 5 removes the duplicate and updates the snapshot. For this task, keep the markup rendering three paragraphs so the snapshot stays clean; you will wire `about.founder.body` in Task 5.

- [ ] **Step 2: Replace the copy on the about page**

Import `txt` and `paras` in `src/routes/about/+page.svelte`, then substitute. The multi-paragraph block:

```svelte
{#each paras(txt('about.hero.body')) as p, i (i)}
	<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:{i === 0 ? 26 : 22}px">{p}</p>
{/each}
```

The inline `margin-top` differs between the two paragraphs in the current markup (26px then 22px), and the index expression above reproduces that exactly so the snapshot stays clean. Leave the founder section's three `<p>` elements as literals — Task 5.

The four `about.expect.N` blocks become an `{#each [1, 2, 3, 4] as i (i)}` loop, matching the pattern used for the home page pillars in Task 2.

- [ ] **Step 3: Replace the copy on classes, teachers, events and the footer**

Same substitution. Three things to leave alone:

- `events/+page.svelte:39-43`, the three hardcoded archive rows. They are stale demo data, not editorial copy, and they get their own decision later. Out of scope here.
- `teachers/+page.svelte:30`, `aria-label="Previous teacher"`. Interface behaviour, not content — see Global Constraints.
- `classes/+page.svelte:37`, `Book {c.name}`. Template, not copy.

- [ ] **Step 4: Run the snapshot**

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: PASS on all six. Any failure is a transcription error — read the diff and fix the JSON value, not the snapshot.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: 6 test files, 69 tests passed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content.generated.json src/routes src/lib/components/Footer.svelte
git commit -m "feat: move the remaining page copy behind keys

The about page's two body paragraphs merge into one cell separated by a
blank line, so the owner edits one block rather than keeping two rows in
the right order.

The founder section stays literal for now: it currently renders the same
paragraph twice, and fixing that changes rendered output, which belongs in
its own commit."
```

---

### Task 4: Enforce the manifest

Markup and content can now disagree in two directions: a key used but not defined (a runtime throw on a live page), or defined but unused (dead rows the owner keeps editing to no effect). CI catches both.

**Files:**
- Create: `src/lib/copy-manifest.js`, `src/lib/copy-manifest.test.js`

**Interfaces:**
- Consumes: `content.generated.json` and the `txt(...)` call sites in `.svelte` files
- Produces: `KEYS: string[]`, the authoritative list. `scripts/lib/schema.mjs` (Task 8) imports it to check that every manifest key has a spreadsheet row

- [ ] **Step 1: Write the failing test**

Create `src/lib/copy-manifest.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { KEYS } from './copy-manifest.js';
import content from './content.generated.json';

/** Every .svelte file under src/, recursively. */
function svelteFiles(dir, found = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) svelteFiles(path, found);
		else if (entry.name.endsWith('.svelte')) found.push(path);
	}
	return found;
}

/** txt('literal.key') and txt(`templated.${i}.key`) both appear in the markup.
 *  The template form is expanded against the digits actually used, because a
 *  regex cannot evaluate `${i}`. */
function keysUsedIn(source) {
	const used = new Set();
	for (const [, key] of source.matchAll(/\btxt\('([^']+)'\)/g)) used.add(key);
	for (const [, tpl] of source.matchAll(/\btxt\(`([^`]+)`\)/g)) {
		for (const n of [1, 2, 3, 4]) used.add(tpl.replace(/\$\{[^}]+\}/g, String(n)));
	}
	return used;
}

const used = new Set();
for (const file of svelteFiles('src')) {
	for (const key of keysUsedIn(readFileSync(file, 'utf8'))) used.add(key);
}

describe('copy manifest', () => {
	it('lists every key the markup asks for', () => {
		const missing = [...used].filter((k) => !KEYS.includes(k)).sort();
		expect(missing, 'used in markup but absent from the manifest').toEqual([]);
	});

	it('lists no key the markup never asks for', () => {
		const unused = KEYS.filter((k) => !used.has(k)).sort();
		expect(unused, 'in the manifest but never rendered').toEqual([]);
	});

	// This is the check the spreadsheet has to satisfy. Task 8 runs the same
	// comparison against sheet rows before any deploy.
	it('has content for every manifest key', () => {
		const absent = KEYS.filter((k) => content.copy[k] === undefined).sort();
		expect(absent, 'in the manifest but missing from content.generated.json').toEqual([]);
	});
});
```

The template expansion covers indices 1 to 4, which is every `{#each}` copy loop introduced in Tasks 2 and 3 (three pillars, four expect blocks, four teacher-work blocks). If a later task adds a fifth, extend that array and the manifest together.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/copy-manifest.test.js`
Expected: FAIL — `Failed to resolve import "./copy-manifest.js"`.

- [ ] **Step 3: Generate the manifest from the content file**

Run:

```bash
node -e "
const c = require('./src/lib/content.generated.json');
const keys = Object.keys(c.copy).sort();
process.stdout.write(
  '// Every copy key the markup renders. Generated once from content.generated.json,\n' +
  '// then maintained by hand: copy-manifest.test.js fails when this list and the\n' +
  '// txt() call sites disagree, in either direction.\n' +
  'export const KEYS = [\n' + keys.map((k) => '\t' + JSON.stringify(k) + ',').join('\n') + '\n];\n'
);
" > src/lib/copy-manifest.js
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/copy-manifest.test.js`
Expected: PASS, 3 tests.

A failure on `lists no key the markup never asks for` means a key was added to the JSON in Task 2 or 3 but never wired into markup. Wire it, or delete the key — do not delete it from the manifest to silence the test.

- [ ] **Step 5: Verify the test catches a real break**

Temporarily add `"home.hero.ghost": "nothing renders this"` to the `copy` object in `content.generated.json` and add `"home.hero.ghost",` to `KEYS`.

Run: `pnpm vitest run src/lib/copy-manifest.test.js`
Expected: FAIL on `lists no key the markup never asks for`, naming `home.hero.ghost`.

Revert both edits and re-run. Expected: PASS.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: 7 test files, 72 tests passed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/copy-manifest.js src/lib/copy-manifest.test.js
git commit -m "test: fail CI when markup and copy content disagree

Both directions matter. A key used but undefined throws on a live page.
A key defined but unused is a spreadsheet row the owner will edit and
then wonder why nothing changed."
```

---

### Task 5: Fix the drift

Three places where the same fact is written twice, plus one paragraph that is written twice by accident. Each one gets worse under a spreadsheet, because the owner would edit one copy and the other would silently stay stale. This task changes rendered output on purpose, so the snapshot is updated deliberately here.

**Files:**
- Modify: `src/lib/content.generated.json`, `src/lib/copy-manifest.js`, `src/routes/+page.svelte`, `src/routes/about/+page.svelte`, `src/routes/events/+page.svelte`, `src/lib/data.js`
- Create: `src/lib/data.test.js`

**Interfaces:**
- Consumes: `events`, `eventLabel` from `src/lib/data.js`
- Produces: `testimonials: {quote: string, who: string}[]` exported from `data.js`; `events[].n` computed rather than stored; a single shared lede key `about.hero.lede` used by both the home and about pages

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { events, eventLabel, testimonials } from './data.js';

describe('events', () => {
	// `n` was typed by hand ("2 gatherings") next to the items it counts. Adding an
	// event should not also mean remembering to update a counter.
	it('derives the gathering count from the items', () => {
		for (const group of events) {
			expect(group.n).toBe(`${group.items.length} gathering${group.items.length === 1 ? '' : 's'}`);
		}
	});

	it('builds a booking label the picker can match', () => {
		expect(eventLabel(events[0].items[0], events[0])).toBe('Full Moon Flow & Sound Bath · 8 Aug');
	});
});

describe('testimonials', () => {
	it('is content, not markup', () => {
		expect(testimonials).toHaveLength(3);
		expect(testimonials[0].who).toBe('Marieke · Slow Yoga Adjustment');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/data.test.js`
Expected: FAIL — `testimonials` is not exported, and `group.n` is the stored string.

- [ ] **Step 3: Move testimonials into content and derive the event count**

Add to `src/lib/content.generated.json`, as a sibling of `copy`:

```json
  "testimonials": [
    { "quote": "\"I came in stiff and a little cynical. I left breathing differently. The room is so quiet you can actually hear yourself soften.\"", "who": "Marieke · Slow Yoga Adjustment" },
    { "quote": "\"First yoga in my life at 43. Nobody made me feel behind. I've been back every week since.\"", "who": "Tomas · Beginners course" },
    { "quote": "\"The 1:1 sessions with Nikita did more for my sleep than anything else this year. Gentle, and exactly what I needed.\"", "who": "Sanne · 1:1 Holistic" }
  ]
```

In `src/lib/data.js`, add the import and export, and strip the hand-kept `n` from each events group, deriving it instead:

```js
import content from './content.generated.json';

export const testimonials = content.testimonials;
```

For `events`, remove the `n: '2 gatherings'` property from both group literals and wrap the array:

```js
// `n` is derived rather than stored: it is items.length spelled out, and a
// spreadsheet editor adding an event should not also have to update a counter.
const eventGroups = [ /* the existing array, with every `n:` removed */ ];

export const events = eventGroups.map((g) => ({
	...g,
	n: `${g.items.length} gathering${g.items.length === 1 ? '' : 's'}`
}));
```

- [ ] **Step 4: Render testimonials from content**

In `src/routes/+page.svelte`, import `testimonials` from `$lib/data.js` and replace the three hardcoded blocks:

```svelte
<div class="quotes">
	{#each testimonials as t, i (i)}
		<div class="quote reveal" use:reveal><p>{t.quote}</p><div class="who">{t.who}</div></div>
	{/each}
</div>
```

- [ ] **Step 5: Derive the next-gathering band**

`src/routes/+page.svelte:180` currently hardcodes "Saturday 19:00 · 90 minutes · €28 · Location to be confirmed. Slow flow as the light goes, then sound to close." The event it describes says "19:00 · 90 min · €28 · Location to confirm" and "…then bowls and voice to close." They have already drifted apart.

In the `<script>` block, alongside the existing `nextGathering`:

```js
// The band shows events[0].items[0]. Its date chip, title and body all come from
// that one object, so a sheet edit to the event cannot leave this section stale —
// which is exactly what happened while both were kept by hand.
const next = events[0].items[0];
const nextMonth = events[0].month.slice(0, 3);
```

Then the band's markup:

```svelte
<div class="date-chip reveal" use:reveal><div class="d">{next.d}</div><div class="m">{nextMonth}</div></div>
<div class="reveal" use:reveal>
	<div class="eyebrow gold" style="color:var(--gold-500)">{txt('home.gathering.eyebrow')}</div>
	<h2 style="margin-top:14px">{next.name}</h2>
	<p>{next.det}. {next.p}</p>
</div>
```

The rendered sentence becomes "19:00 · 90 min · €28 · Location to confirm. Slow flow as the light goes, then bowls and voice to close." The weekday ("Saturday") is dropped: it is not on the event object, and `next.w` holds the abbreviated form ("Sat") that the calendar chip uses. Carrying a second, longer weekday string would reintroduce exactly the duplication this step removes.

- [ ] **Step 6: Share the lede between the home and about pages**

`home.about.body` and `about.hero.lede` are the same paragraph, differing only in apostrophe style — the home page uses `'` and the about page uses `’`. Delete `home.about.body` from `content.generated.json` and from `copy-manifest.js`, and point the home page at `about.hero.lede`:

```svelte
<p class="lede" style="margin-top:26px">{txt('about.hero.lede')}</p>
```

This changes the home page's rendered apostrophes from straight to curly. That is the intended direction — the curly form is the typographically correct one and is what the rest of the about page already uses.

- [ ] **Step 7: Remove the duplicated founder paragraph**

`about/+page.svelte:80-84` renders the identical paragraph twice. Replace all three `<p>` elements with the two-paragraph block from `about.founder.body`, which Task 3 already wrote:

```svelte
{#each paras(txt('about.founder.body')) as p, i (i)}
	<p class={i === 0 ? 'lede' : null} style="margin-top:{i === 0 ? 28 : 22}px">{p}</p>
{/each}
```

- [ ] **Step 8: Drop the dead `venue` export**

`src/lib/data.js:42` exports `venue`, and nothing imports it. Confirm and remove:

Run: `grep -rn "venue" src/ | grep -v "venues\|venue-\|\.venue"`
Expected: only the `data.js` declaration itself, plus two unrelated CSS class names in `about/+page.svelte`.

Delete the line.

- [ ] **Step 9: Run the tests**

Run: `pnpm vitest run src/lib/data.test.js src/lib/copy-manifest.test.js`
Expected: PASS on both. If the manifest test fails on `home.about.body`, it was removed from one of the two lists and not the other.

- [ ] **Step 10: Update the snapshots deliberately**

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: FAIL on `home` and `about`. Read both diffs and confirm each change is one of these four, and nothing else:

1. Home: the next-gathering band's text now matches the event data
2. Home: the lede's apostrophes are curly
3. About: the founder section has two paragraphs, not three
4. Home: testimonials render from data with identical text

Then accept: `pnpm vitest run src/routes/pages.snapshot.test.js -u`

- [ ] **Step 11: Run the whole suite**

Run: `pnpm test`
Expected: 8 test files, 78 tests passed.

- [ ] **Step 12: Commit**

```bash
git add src/lib src/routes
git commit -m "fix: remove the four places content was written twice

The next-gathering band on the home page had already drifted from the
event it describes — '90 minutes' against '90 min', 'sound to close'
against 'bowls and voice to close'. It is derived now, so a sheet edit
cannot leave it stale.

The about page rendered the same founder paragraph twice. The home and
about pages carried the same lede with different apostrophes. The events
group counted its own items in a hand-typed string. And `venue` was
exported and never imported.

Testimonials move out of markup into content, since the owner will want
to add one."
```

---

### Task 6: `data.js` becomes a reader

The last Phase 0 step. Structured content moves into the generated file so the sync script has exactly one file to write, and `data.js` keeps only the code that derives things from it.

**Files:**
- Modify: `src/lib/data.js`, `src/lib/content.generated.json`
- Modify: `src/lib/data.test.js`

**Interfaces:**
- Consumes: `content.generated.json`
- Produces: `content.generated.json` with top-level keys `copy`, `providers`, `teachers`, `classes`, `timetable`, `events`, `offerings`, `faqs`, `partners`, `prices`, `testimonials`. `data.js` exports stay byte-identical in shape, so no consumer changes. Task 9's `shape.mjs` must produce exactly this structure

- [ ] **Step 1: Write the failing test**

Add to `src/lib/data.test.js`:

```js
import content from './content.generated.json';
import { classes, prices, providers, locationOf } from './data.js';

describe('content boundary', () => {
	it('sources structured content from the generated file', () => {
		expect(classes).toEqual(content.classes);
		expect(providers).toEqual(content.providers);
	});

	// The payment boundary. A spreadsheet can set what a pass is called and what
	// it costs; it can never set where the money goes. See the spec, "The payment
	// boundary": a QR cannot be checked by eye.
	it('keeps every payment URL out of the generated file', () => {
		const serialised = JSON.stringify(content);
		expect(serialised).not.toContain('tikkie.me');
		expect(serialised).not.toMatch(/https?:\/\//);
	});

	it('still attaches a pay target to every price', () => {
		for (const p of prices) {
			expect(p.pay.url, p.id).toMatch(/^https:\/\/tikkie\.me\/pay\//);
			expect(p.pay.qr, p.id).toMatch(/^\/qr\//);
		}
	});

	it('resolves a venue for every class', () => {
		for (const c of classes) expect(locationOf(c.name), c.name).not.toBe('');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/data.test.js`
Expected: FAIL — `content.classes` is undefined.

- [ ] **Step 3: Move the structured content into the generated file**

Move `providers`, `teachers`, `classes`, `timetable`, `events`, `offerings`, `faqs` and `partners` from `data.js` into `content.generated.json` verbatim, as top-level keys alongside `copy` and `testimonials`.

For `events`, use the group array **without** the `n` property — it is derived in `data.js`.

For `prices`, move only the label fields. The `pay` object does not go in:

```json
  "prices": [
    { "id": "drop-in", "lbl": "Drop-in", "amt": "€15", "note": "One class, whenever it suits." },
    { "id": "5-class", "lbl": "5-class pass", "amt": "€50", "note": "Valid three months. No rush." },
    { "id": "10-class", "lbl": "10-class pass", "amt": "€90", "note": "Most people land here.", "feature": true },
    { "id": "1on1", "lbl": "1:1 session", "amt": "€60", "note": "75 min, yoga or holistic." }
  ]
```

The `10-class` note is currently "Valid six months. Most people land here." Keep it verbatim — the shortened version above is illustrative only. Copy the real string.

The keys stay `lbl` and `amt` rather than `label` and `amount`, because renaming them would touch `classes/+page.svelte` and `PayModal.svelte` for no gain. The spreadsheet columns are the friendlier `label` and `amount`; `shape.mjs` in Task 9 maps between them.

- [ ] **Step 4: Rewrite `data.js` as a reader**

```js
import content from './content.generated.json';

export const providers = content.providers;
export const teachers = content.teachers;
export const classes = content.classes;
export const timetable = content.timetable;
export const offerings = content.offerings;
export const faqs = content.faqs;
export const partners = content.partners;
export const testimonials = content.testimonials;

export function locationOf(className) {
	const c = classes.find((cl) => cl.name === className);
	const p = c && providers[c.provider];
	return p ? `${p.name} · ${p.address}` : '';
}

// `n` is derived rather than stored: it is items.length spelled out, and a
// spreadsheet editor adding an event should not also have to update a counter.
export const events = content.events.map((g) => ({
	...g,
	n: `${g.items.length} gathering${g.items.length === 1 ? '' : 's'}`
}));

// Where the money goes is the one thing the spreadsheet cannot touch. A QR code
// cannot be read by eye, so anything able to change the link behind one can
// redirect real payments and nobody would see it. The CSP in svelte.config.js is
// the control that makes injecting such a change hard; putting these URLs in a
// sheet would route around it entirely. The visible tikkie.me text next to each
// code is the backstop for a visitor who wants to check.
//
// The `?utm_medium=qr` that Tikkie bakes into the code is deliberately absent: it
// is true of a scan and false of a click, and these links are the click.
const PAY = {
	'drop-in': { url: 'https://tikkie.me/pay/hbhaj5t0kco445btahr7', qr: '/qr/tikkie-drop-in.png' },
	'5-class': { url: 'https://tikkie.me/pay/lnldc5puflb6knrj4nr4', qr: '/qr/tikkie-5-class.png' },
	'10-class': { url: 'https://tikkie.me/pay/b0v2fuqfv0f8umcb4cqu', qr: '/qr/tikkie-10-class.png' },
	'1on1': { url: 'https://tikkie.me/pay/79ocuktsdsb8uaetuvek', qr: '/qr/tikkie-1on1.png' }
};

export const prices = content.prices.map((p) => {
	const pay = PAY[p.id];
	if (!pay) throw new Error(`prices: no payment target for id "${p.id}". Add it to PAY in data.js.`);
	return { ...p, pay };
});

export const priceById = (id) => prices.find((p) => p.id === id) ?? null;

// A 1:1 booking cannot be paid for with a class pass, so the booking form pins
// it to the €60 price instead of letting someone select a €15 drop-in for it.
export const isOneToOne = (name) => /1:1|one to one|one-to-one/i.test(name);

// The one place an event's booking label is spelled out. Number() drops the
// leading zero the calendar chip needs ('08'), so the label the Reserve button
// sends and the label in the picker can't drift apart.
export function eventLabel(item, group) {
	return `${item.name} · ${Number(item.d)} ${group.month.slice(0, 3)}`;
}

// Picker entries that aren't a class, an offering or an event.
const standaloneBookOptions = ['1:1 Holistic session', 'Beginners course (4 evenings)'];

// Derived, never hand-kept. openBooking() preselects on an exact match against
// this list, so a label written out a second time anywhere else opens an empty
// picker with the submit button disabled.
export const bookOptions = [
	...new Set([
		...classes.map((c) => c.name),
		...standaloneBookOptions,
		...offerings.flatMap((g) => g.items.map((i) => i.name)),
		...events.flatMap((g) => g.items.map((i) => eventLabel(i, g)))
	])
];
```

Note the `prices` map now throws on an unknown id. A spreadsheet row with a new `id` and no `PAY` entry must fail the build rather than render a pass with no way to pay for it.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/lib/data.test.js`
Expected: PASS.

- [ ] **Step 6: Run the snapshot**

Run: `pnpm vitest run src/routes/pages.snapshot.test.js`
Expected: PASS on all six, unchanged. This task moves content between files without altering a single string; any diff is a transcription error.

- [ ] **Step 7: Verify the site still builds and runs**

Run: `pnpm build`
Expected: build completes with no errors.

Run: `pnpm dev`, then open the home, classes, teachers, events and about pages. Click a price to open the pay modal and confirm the QR and the `tikkie.me` link both appear. Open the booking modal and confirm the class picker is populated.

- [ ] **Step 8: Run the whole suite**

Run: `pnpm test`
Expected: 8 test files, 82 tests passed.

- [ ] **Step 9: Commit**

```bash
git add src/lib
git commit -m "refactor: read all content from one generated file

data.js keeps only what is derived — locationOf, eventLabel, bookOptions,
the price-to-payment mapping — and the content itself moves to
content.generated.json, which the sync script will own from here.

prices now throws on an id with no PAY entry. A spreadsheet row for a new
pass with no payment target must fail the build rather than render a
price nobody can pay."
```

---

## Phase 1 — The text lane

### Task 7: Sheets client

Google authentication and the v4 REST calls, with no knowledge of Vinya's data. Keeping that boundary is what lets Tasks 8 and 9 be tested with plain fixtures and no network.

**Files:**
- Create: `scripts/lib/sheets.mjs`, `scripts/lib/sheets.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `GOOGLE_SA_KEY` (JSON service-account key as a string) and `VINYA_SHEET_ID` from the environment
- Produces:
  - `rowsToObjects(values: string[][]) => Record<string,string>[]` — pure, exported for testing
  - `readTabs(tabs: string[]) => Promise<Record<string, Record<string,string>[]>>`
  - `writeCell(range: string, value: string) => Promise<void>`

- [ ] **Step 1: Add the dependency**

Run: `pnpm add -D google-auth-library`

It handles service-account JWT signing, token exchange and refresh. The heavier `googleapis` package is not needed — the two Sheets endpoints used here are called directly through the authenticated client's `request()`.

- [ ] **Step 2: Write the failing test**

Create `scripts/lib/sheets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { rowsToObjects } from './sheets.mjs';

describe('rowsToObjects', () => {
	it('uses the first row as headers', () => {
		expect(rowsToObjects([['name', 'tone'], ['Kundalini Yoga', 'tan']]))
			.toEqual([{ name: 'Kundalini Yoga', tone: 'tan' }]);
	});

	// Sheets omits trailing empty cells entirely rather than padding the row, so a
	// row whose last column is blank comes back short.
	it('fills missing trailing cells with empty strings', () => {
		expect(rowsToObjects([['name', 'tone', 'blurb'], ['Kundalini Yoga', 'tan']]))
			.toEqual([{ name: 'Kundalini Yoga', tone: 'tan', blurb: '' }]);
	});

	// The owner will leave a gap between blocks of rows. That is formatting, not data.
	it('skips rows that are entirely empty', () => {
		expect(rowsToObjects([['name'], ['A'], ['   '], [''], ['B']]))
			.toEqual([{ name: 'A' }, { name: 'B' }]);
	});

	it('trims every cell', () => {
		expect(rowsToObjects([['  name  '], ['  Kundalini Yoga  ']]))
			.toEqual([{ name: 'Kundalini Yoga' }]);
	});

	it('returns an empty array for a tab with only headers', () => {
		expect(rowsToObjects([['name', 'tone']])).toEqual([]);
	});

	it('returns an empty array for a completely empty tab', () => {
		expect(rowsToObjects([])).toEqual([]);
		expect(rowsToObjects(undefined)).toEqual([]);
	});

	it('keeps the row number so errors can name it', () => {
		const [first] = rowsToObjects([['name'], ['A']]);
		expect(first.__row).toBe(2);
	});
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run scripts/lib/sheets.test.js`
Expected: FAIL — `Failed to resolve import "./sheets.mjs"`.

- [ ] **Step 4: Write the client**

Create `scripts/lib/sheets.mjs`:

```js
import { JWT } from 'google-auth-library';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** Turns a tab's raw value grid into objects keyed by its header row.
 *
 *  `__row` carries the 1-based spreadsheet row number through to validation, so
 *  a failure can say "events tab, row 7" rather than "events tab, item 5" — the
 *  owner is looking at row numbers, not array indices. */
export function rowsToObjects(values) {
	if (!Array.isArray(values) || values.length === 0) return [];
	const headers = values[0].map((h) => String(h ?? '').trim());
	const out = [];
	for (let i = 1; i < values.length; i++) {
		const cells = values[i] ?? [];
		// Sheets omits trailing empty cells rather than padding, so index past the
		// end is normal and means "blank", not "malformed".
		const row = {};
		let empty = true;
		for (let c = 0; c < headers.length; c++) {
			const value = String(cells[c] ?? '').trim();
			if (value !== '') empty = false;
			row[headers[c]] = value;
		}
		if (empty) continue;
		row.__row = i + 1;
		out.push(row);
	}
	return out;
}

function auth() {
	const raw = process.env.GOOGLE_SA_KEY;
	if (!raw) throw new Error('GOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.');
	let key;
	try {
		key = JSON.parse(raw);
	} catch {
		throw new Error('GOOGLE_SA_KEY is not valid JSON. Paste the whole service-account key file, not just the private key.');
	}
	return new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
}

function sheetId() {
	const id = process.env.VINYA_SHEET_ID;
	if (!id) throw new Error('VINYA_SHEET_ID is not set.');
	return id;
}

/** One batchGet for every tab, so a sync is a single API call rather than one
 *  per tab. Returns { tabName: rows[] }. */
export async function readTabs(tabs) {
	const client = auth();
	const ranges = tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join('&');
	const { data } = await client.request({
		url: `${API}/${sheetId()}/values:batchGet?${ranges}&majorDimension=ROWS`
	});
	const out = {};
	data.valueRanges.forEach((vr, i) => {
		out[tabs[i]] = rowsToObjects(vr.values);
	});
	return out;
}

/** Used for the Status cell. RAW so a status line starting with '=' or '+' is
 *  stored as text rather than interpreted as a formula. */
export async function writeCell(range, value) {
	const client = auth();
	await client.request({
		url: `${API}/${sheetId()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
		method: 'PUT',
		data: { values: [[value]] }
	});
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run scripts/lib/sheets.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: 9 test files, 89 tests passed.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/sheets.mjs scripts/lib/sheets.test.js package.json pnpm-lock.yaml
git commit -m "feat: add a Sheets client for the content sync

Knows Google, not Vinya. Everything Vinya-specific lives in schema.mjs
and shape.mjs, which are pure and testable without a network.

rowsToObjects carries the spreadsheet row number through as __row, so a
validation failure can name the row the owner is actually looking at.

writeCell uses RAW input so a status line beginning with '=' lands as
text instead of being evaluated as a formula."
```

---

### Task 8: Validation

The load-bearing part. There is no review step under a debounce, so this is the only gate between a mistyped cell and the live site.

**Files:**
- Create: `scripts/lib/schema.mjs`, `scripts/lib/schema.test.js`

**Interfaces:**
- Consumes: `KEYS` from `src/lib/copy-manifest.js`; tab objects as produced by `rowsToObjects`
- Produces: `validate(tabs: Record<string, object[]>) => {tab: string, row: number|null, message: string}[]` — an empty array means the content is safe to ship

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/schema.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validate } from './schema.mjs';

/** A minimal set of tabs that passes every rule. Each test below breaks exactly
 *  one thing, so a failure names the rule that caught it. */
const ok = () => ({
	providers: [{ key: 'truColours', name: 'Tru Colours', address: 'Geschutswerf 12-14, 1018 BX Amsterdam', __row: 2 }],
	classes: [{ name: 'Kundalini Yoga', tone: 'tan', meta: '60 min', blurb: 'Breath.', provider: 'truColours', __row: 2 }],
	timetable: [{ day: 'Tuesday', time: '10:30', class: 'Kundalini Yoga', duration: '60 min', __row: 2 }],
	events: [{ month: 'August 2026', day: '08', weekday: 'Sat', name: 'Full Moon', detail: '19:00', blurb: 'Slow flow.', remaining: '6 places left', __row: 2 }],
	offerings: [{ category: 'Weekly', name: 'Multi-Style Yoga Classes', note: 'A mix.', __row: 2 }],
	faqs: [{ question: 'Really okay?', answer: 'Yes.', __row: 2 }],
	teachers: [{ slug: 'nikita-coppens', name: 'Nikita Coppens', role: 'Teacher', intro: 'Long way round.', highlights: 'One\nTwo', photo: '/images/nikita-standing-2200.jpg', alt: 'Nikita', fx: '50', fy: '20', ctaLabel: 'Book a 1:1', ctaOption: '1:1 Holistic session', __row: 2 }],
	partners: [{ name: 'ClassPass', logo: '/partner-logos/classpass-logo.svg', href: 'https://classpass.com/', height: '68', __row: 2 }],
	prices: [{ id: 'drop-in', label: 'Drop-in', amount: '€15', note: 'One class.', feature: '', __row: 2 }],
	testimonials: [{ quote: 'Good.', who: 'Marieke', __row: 2 }],
	copy: [] // filled per-test from the manifest
});

/** Every manifest key present, so copy rules pass unless a test breaks them. */
async function withCopy(tabs) {
	const { KEYS } = await import('../../src/lib/copy-manifest.js');
	tabs.copy = KEYS.map((key, i) => ({ key, text: 'x', where: '', __row: i + 2 }));
	return tabs;
}

const messages = (errors) => errors.map((e) => e.message).join(' | ');

describe('validate', () => {
	it('passes a well-formed set of tabs', async () => {
		expect(validate(await withCopy(ok()))).toEqual([]);
	});

	// openBooking() preselects on an exact string match, so a trailing space opens
	// an empty picker with submit disabled. Spreadsheet cells accumulate them.
	it('rejects a class name that is not already trimmed', async () => {
		const tabs = await withCopy(ok());
		tabs.classes[0].name = 'Kundalini Yoga ';
		expect(messages(validate(tabs))).toContain('whitespace');
	});

	// eventLabel() does group.month.slice(0, 3). A date-formatted cell serialises
	// to ISO and the booking label becomes nonsense.
	it('rejects an events month that is not "Month YYYY"', async () => {
		const tabs = await withCopy(ok());
		tabs.events[0].month = '2026-09-05';
		const errors = validate(tabs);
		expect(errors[0].tab).toBe('events');
		expect(errors[0].row).toBe(2);
		expect(errors[0].message).toContain('September 2026');
	});

	// locationOf() returns '' for an unknown provider — the venue silently
	// disappears from the page with no error anywhere.
	it('rejects a class whose provider does not resolve', async () => {
		const tabs = await withCopy(ok());
		tabs.classes[0].provider = 'truColors';
		expect(messages(validate(tabs))).toContain('truColors');
	});

	it('rejects a timetable entry whose class does not resolve', async () => {
		const tabs = await withCopy(ok());
		tabs.timetable[0].class = 'Kundalini Yogo';
		expect(messages(validate(tabs))).toContain('Kundalini Yogo');
	});

	// A duplicate label makes the booking picker's preselect ambiguous.
	it('rejects a booking label used twice across tabs', async () => {
		const tabs = await withCopy(ok());
		tabs.offerings.push({ category: 'Private', name: 'Kundalini Yoga', note: 'x', __row: 3 });
		expect(messages(validate(tabs))).toContain('more than once');
	});

	// The payment boundary. Enforced, not left to convention.
	it('rejects any URL in the prices tab', async () => {
		const tabs = await withCopy(ok());
		tabs.prices[0].note = 'Pay at https://tikkie.me/pay/attacker';
		const errors = validate(tabs);
		expect(errors[0].tab).toBe('prices');
		expect(errors[0].message).toContain('payment links');
	});

	it('rejects a price id with no payment target in the code', async () => {
		const tabs = await withCopy(ok());
		tabs.prices[0].id = 'drop-inn';
		expect(messages(validate(tabs))).toContain('drop-inn');
	});

	// A deleted row must not blank a headline on a live page.
	it('rejects a missing copy key', async () => {
		const tabs = await withCopy(ok());
		const dropped = tabs.copy.pop();
		expect(messages(validate(tabs))).toContain(dropped.key);
	});

	it('rejects an empty copy cell as firmly as a missing row', async () => {
		const tabs = await withCopy(ok());
		tabs.copy[0].text = '';
		expect(messages(validate(tabs))).toContain(tabs.copy[0].key);
	});

	it('rejects a duplicate teacher slug', async () => {
		const tabs = await withCopy(ok());
		tabs.teachers.push({ ...tabs.teachers[0], name: 'Someone Else', __row: 3 });
		expect(messages(validate(tabs))).toContain('nikita-coppens');
	});

	it('rejects a teacher slug that is not kebab-case', async () => {
		const tabs = await withCopy(ok());
		tabs.teachers[0].slug = 'Nikita Coppens';
		expect(messages(validate(tabs))).toContain('kebab-case');
	});

	it('rejects a focal point outside 0-100', async () => {
		const tabs = await withCopy(ok());
		tabs.teachers[0].fy = '120';
		expect(messages(validate(tabs))).toContain('between 0 and 100');
	});

	it('rejects a required cell left blank', async () => {
		const tabs = await withCopy(ok());
		tabs.faqs[0].answer = '';
		const errors = validate(tabs);
		expect(errors[0].tab).toBe('faqs');
		expect(errors[0].message).toContain('answer');
	});

	it('rejects a tab that is entirely empty', async () => {
		const tabs = await withCopy(ok());
		tabs.classes = [];
		expect(messages(validate(tabs))).toContain('no rows');
	});

	// Every failure at once, so the owner fixes them in one pass rather than
	// discovering them one deploy at a time.
	it('reports every failure rather than stopping at the first', async () => {
		const tabs = await withCopy(ok());
		tabs.classes[0].provider = 'nope';
		tabs.events[0].month = 'not a month';
		tabs.faqs[0].question = '';
		expect(validate(tabs).length).toBeGreaterThanOrEqual(3);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run scripts/lib/schema.test.js`
Expected: FAIL — `Failed to resolve import "./schema.mjs"`.

- [ ] **Step 3: Write the validator**

Create `scripts/lib/schema.mjs`:

```js
import { KEYS } from '../../src/lib/copy-manifest.js';

// Every price id the code has a Tikkie target for. A spreadsheet row for a pass
// with no way to pay for it must fail here rather than render.
const PRICE_IDS = ['drop-in', '5-class', '10-class', '1on1'];

const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
const URL_LIKE = /https?:\/\//i;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const REQUIRED = {
	providers: ['key', 'name', 'address'],
	classes: ['name', 'tone', 'meta', 'blurb', 'provider'],
	timetable: ['day', 'time', 'class', 'duration'],
	events: ['month', 'day', 'weekday', 'name', 'detail', 'blurb'],
	offerings: ['category', 'name', 'note'],
	faqs: ['question', 'answer'],
	teachers: ['slug', 'name', 'role', 'intro', 'highlights', 'photo', 'alt', 'fx', 'fy', 'ctaLabel', 'ctaOption'],
	partners: ['name', 'logo'],
	prices: ['id', 'label', 'amount', 'note'],
	testimonials: ['quote', 'who'],
	copy: ['key', 'text']
};

export function validate(tabs) {
	const errors = [];
	const fail = (tab, row, message) => errors.push({ tab, row, message });

	// --- structural: every tab present, non-empty, with its required columns ---
	for (const [tab, columns] of Object.entries(REQUIRED)) {
		const rows = tabs[tab];
		if (!Array.isArray(rows)) {
			fail(tab, null, `the "${tab}" tab is missing from the spreadsheet.`);
			continue;
		}
		if (rows.length === 0) {
			fail(tab, null, `the "${tab}" tab has no rows. The site needs at least one.`);
			continue;
		}
		for (const row of rows) {
			for (const column of columns) {
				const value = row[column];
				if (value === undefined) {
					fail(tab, row.__row, `there is no "${column}" column. Check the header row spelling.`);
				} else if (value === '') {
					fail(tab, row.__row, `"${column}" is empty, and it is required.`);
				} else if (value !== value.trim()) {
					// rowsToObjects already trims, so reaching here means a non-breaking
					// space or similar. Booking preselect matches exactly, so it matters.
					fail(tab, row.__row, `"${column}" has leading or trailing whitespace that will break exact matching.`);
				}
			}
		}
	}
	if (errors.length > 0) return errors; // later rules assume the shape is sound

	// --- providers resolve ---
	const providerKeys = new Set(tabs.providers.map((p) => p.key));
	for (const c of tabs.classes) {
		if (!providerKeys.has(c.provider)) {
			fail('classes', c.__row, `provider "${c.provider}" is not a key on the providers tab, so this class would show no venue at all.`);
		}
	}

	// --- timetable references a real class ---
	const classNames = new Set(tabs.classes.map((c) => c.name));
	for (const t of tabs.timetable) {
		if (!classNames.has(t.class)) {
			fail('timetable', t.__row, `class "${t.class}" is not on the classes tab, so this session would show no venue.`);
		}
	}

	// --- events month format ---
	for (const e of tabs.events) {
		if (!MONTH.test(e.month)) {
			fail('events', e.__row, `month reads "${e.month}" but must read like "September 2026". A date-formatted cell will not work — set the cell format to plain text.`);
		}
		if (!/^\d{2}$/.test(e.day)) {
			fail('events', e.__row, `day reads "${e.day}" but must be two digits, like "08".`);
		}
	}

	// --- booking labels unique ---
	const seen = new Map();
	const claim = (label, tab, row) => {
		if (seen.has(label)) {
			const first = seen.get(label);
			fail(tab, row, `"${label}" is already used on the ${first.tab} tab, row ${first.row}. The booking form matches on the exact label, so it cannot appear more than once.`);
		} else {
			seen.set(label, { tab, row });
		}
	};
	for (const c of tabs.classes) claim(c.name, 'classes', c.__row);
	for (const o of tabs.offerings) claim(o.name, 'offerings', o.__row);
	for (const e of tabs.events) claim(`${e.name} · ${Number(e.day)} ${e.month.slice(0, 3)}`, 'events', e.__row);

	// --- the payment boundary ---
	for (const p of tabs.prices) {
		for (const [column, value] of Object.entries(p)) {
			if (column !== '__row' && URL_LIKE.test(String(value))) {
				fail('prices', p.__row, `"${column}" contains a link. Payment links are set in the site's code, not here — see the design doc. Remove it.`);
			}
		}
		if (!PRICE_IDS.includes(p.id)) {
			fail('prices', p.__row, `id "${p.id}" has no payment target in the site's code. Valid ids: ${PRICE_IDS.join(', ')}. A new pass needs a developer to add its Tikkie link.`);
		}
	}

	// --- teachers ---
	const slugs = new Set();
	for (const t of tabs.teachers) {
		if (!KEBAB.test(t.slug)) {
			fail('teachers', t.__row, `slug "${t.slug}" must be kebab-case: lowercase letters, numbers and hyphens only, like "nikita-coppens".`);
		}
		if (slugs.has(t.slug)) {
			fail('teachers', t.__row, `slug "${t.slug}" is used more than once. Each teacher needs their own.`);
		}
		slugs.add(t.slug);
		for (const axis of ['fx', 'fy']) {
			const n = Number(t[axis]);
			if (!Number.isFinite(n) || n < 0 || n > 100) {
				fail('teachers', t.__row, `${axis} reads "${t[axis]}" but must be a number between 0 and 100.`);
			}
		}
	}

	// --- copy covers the manifest ---
	const copyByKey = new Map(tabs.copy.map((r) => [r.key, r]));
	for (const key of KEYS) {
		const row = copyByKey.get(key);
		if (!row) {
			fail('copy', null, `there is no row for "${key}", and the site renders it. Add a row with that key.`);
		} else if (row.text === '') {
			fail('copy', row.__row, `"${key}" has no text, and the site renders it.`);
		}
	}
	for (const row of tabs.copy) {
		if (!KEYS.includes(row.key)) {
			fail('copy', row.__row, `"${row.key}" is not used anywhere on the site. Editing it will change nothing — delete the row, or check the spelling.`);
		}
	}

	return errors;
}
```

Note the early return after the structural pass. Once a required column is missing, every downstream rule would fail on `undefined` and bury the one error the owner needs to read.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run scripts/lib/schema.test.js`
Expected: PASS, 16 tests.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: 10 test files, 105 tests passed.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/schema.mjs scripts/lib/schema.test.js
git commit -m "feat: validate spreadsheet content before it can deploy

There is no review step under a debounced publish, so this is the only
gate between a mistyped cell and the live site. Every rule here maps to a
failure that is currently silent: a trailing space that empties the
booking picker, a date-formatted month that garbles the booking label, a
mistyped provider that makes the venue disappear.

Messages are written for the owner, not for a log: they name the tab, the
row, what is wrong, and what to type instead."
```

---

### Task 9: Shape

Flat spreadsheet rows into the nested structure `content.generated.json` needs. Pure, so it is testable against fixtures with no network.

**Files:**
- Create: `scripts/lib/shape.mjs`, `scripts/lib/shape.test.js`

**Interfaces:**
- Consumes: tab objects as produced by `rowsToObjects`, already validated
- Produces: `shape(tabs) => object` matching `content.generated.json` exactly, as defined in Task 6

- [ ] **Step 1: Write the failing tests**

Create `scripts/lib/shape.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { shape } from './shape.mjs';

const tabs = {
	copy: [{ key: 'home.hero.title', text: 'Bloom.', where: 'Home', __row: 2 }],
	providers: [{ key: 'truColours', name: 'Tru Colours', address: 'Geschutswerf 12-14', __row: 2 }],
	classes: [{ name: 'Kundalini Yoga', tone: 'tan', meta: '60 min', blurb: 'Breath.', provider: 'truColours', __row: 2 }],
	timetable: [
		{ day: 'Tuesday', time: '10:30', class: 'Kundalini Yoga', duration: '60 min', __row: 2 },
		{ day: 'Tuesday', time: '18:00', class: 'Kundalini Yoga', duration: '60 min', __row: 3 },
		{ day: 'Sunday', time: '12:45', class: 'Slow Yoga', duration: '60 min', __row: 4 }
	],
	events: [
		{ month: 'August 2026', day: '08', weekday: 'Sat', name: 'Full Moon', detail: '19:00', blurb: 'Slow.', remaining: '6 left', __row: 2 },
		{ month: 'August 2026', day: '23', weekday: 'Sun', name: 'Bloom Slowly', detail: '10:00', blurb: 'Three hours.', remaining: '10 places', __row: 3 }
	],
	offerings: [
		{ category: 'Weekly', name: 'Multi-Style', note: 'A mix.', __row: 2 },
		{ category: 'Private', name: '1:1 Sessions', note: 'One on one.', __row: 3 }
	],
	faqs: [{ question: 'Okay?', answer: 'Yes.', __row: 2 }],
	teachers: [{
		slug: 'nikita-coppens', name: 'Nikita Coppens', role: 'Teacher', intro: 'Long way.',
		highlights: 'From the Netherlands\nTeaches Kirtan', photo: '/images/nikita-standing-2200.jpg',
		alt: 'Nikita', fx: '50', fy: '20', ctaLabel: 'Book a 1:1', ctaOption: '1:1 Holistic session', __row: 2
	}],
	partners: [
		{ name: 'ClassPass', logo: '/partner-logos/classpass-logo.svg', href: 'https://classpass.com/', height: '68', __row: 2 },
		{ name: 'Tru Colours', logo: '/partner-logos/trucolours.webp', href: '', height: '104', __row: 3 }
	],
	prices: [
		{ id: 'drop-in', label: 'Drop-in', amount: '€15', note: 'One class.', feature: '', __row: 2 },
		{ id: '10-class', label: '10-class pass', amount: '€90', note: 'Most land here.', feature: 'yes', __row: 3 }
	],
	testimonials: [{ quote: 'Good.', who: 'Marieke', __row: 2 }]
};

describe('shape', () => {
	it('turns the copy tab into a key-to-text object', () => {
		expect(shape(tabs).copy).toEqual({ 'home.hero.title': 'Bloom.' });
	});

	it('keys providers by their key column', () => {
		expect(shape(tabs).providers).toEqual({
			truColours: { name: 'Tru Colours', address: 'Geschutswerf 12-14' }
		});
	});

	it('groups timetable rows by day, preserving sheet order', () => {
		expect(shape(tabs).timetable).toEqual([
			{ day: 'Tuesday', slots: [['10:30', 'Kundalini Yoga', '60 min'], ['18:00', 'Kundalini Yoga', '60 min']] },
			{ day: 'Sunday', slots: [['12:45', 'Slow Yoga', '60 min']] }
		]);
	});

	it('groups events by month without a hand-kept count', () => {
		const [august] = shape(tabs).events;
		expect(august.month).toBe('August 2026');
		expect(august.n).toBeUndefined();
		expect(august.items).toEqual([
			{ d: '08', w: 'Sat', name: 'Full Moon', det: '19:00', p: 'Slow.', rem: '6 left' },
			{ d: '23', w: 'Sun', name: 'Bloom Slowly', det: '10:00', p: 'Three hours.', rem: '10 places' }
		]);
	});

	it('groups offerings by category, preserving sheet order', () => {
		expect(shape(tabs).offerings).toEqual([
			{ cat: 'Weekly', items: [{ name: 'Multi-Style', note: 'A mix.' }] },
			{ cat: 'Private', items: [{ name: '1:1 Sessions', note: 'One on one.' }] }
		]);
	});

	// The sheet's friendlier column names map to the shorter keys the markup
	// already uses, rather than renaming them across four components.
	it('maps price columns to the keys the markup uses', () => {
		expect(shape(tabs).prices).toEqual([
			{ id: 'drop-in', lbl: 'Drop-in', amt: '€15', note: 'One class.' },
			{ id: '10-class', lbl: '10-class pass', amt: '€90', note: 'Most land here.', feature: true }
		]);
	});

	it('never emits a payment field', () => {
		expect(JSON.stringify(shape(tabs))).not.toContain('tikkie');
		expect(JSON.stringify(shape(tabs))).not.toContain('"pay"');
	});

	it('splits teacher highlights on newlines and builds the photo object', () => {
		const [t] = shape(tabs).teachers;
		expect(t.highlights).toEqual(['From the Netherlands', 'Teaches Kirtan']);
		expect(t.photo).toEqual({
			src: '/images/nikita-standing-2200.jpg',
			srcset: '/images/nikita-standing-1400.jpg 1400w, /images/nikita-standing-2200.jpg 2200w',
			srcsetWebp: '/images/nikita-standing-1400.webp 1400w, /images/nikita-standing-2200.webp 2200w',
			alt: 'Nikita',
			fx: 50,
			fy: 20
		});
		expect(t.cta).toEqual({ label: 'Book a 1:1', option: '1:1 Holistic session' });
	});

	// `href` is optional: with it the logo links out, without it it only shows a
	// tooltip. An empty cell must not become href: ''.
	it('omits an empty partner href rather than emitting a blank one', () => {
		const [classpass, tru] = shape(tabs).partners;
		expect(classpass).toEqual({ name: 'ClassPass', logo: '/partner-logos/classpass-logo.svg', href: 'https://classpass.com/', h: 68 });
		expect(tru).toEqual({ name: 'Tru Colours', logo: '/partner-logos/trucolours.webp', h: 104 });
	});

	it('omits a blank partner height rather than emitting zero', () => {
		const blank = { ...tabs, partners: [{ name: 'X', logo: '/x.svg', href: '', height: '', __row: 2 }] };
		expect(shape(blank).partners[0]).toEqual({ name: 'X', logo: '/x.svg' });
	});

	it('sorts copy keys so an unrelated edit produces no diff noise', () => {
		const many = { ...tabs, copy: [
			{ key: 'z.last', text: 'Z', __row: 2 },
			{ key: 'a.first', text: 'A', __row: 3 }
		] };
		expect(Object.keys(shape(many).copy)).toEqual(['a.first', 'z.last']);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run scripts/lib/shape.test.js`
Expected: FAIL — `Failed to resolve import "./shape.mjs"`.

- [ ] **Step 3: Write the shaper**

Create `scripts/lib/shape.mjs`:

```js
/** Groups rows by a column, keeping the order the keys first appear in the sheet.
 *  Row order is the owner's ordering tool — Tuesday before Sunday is a choice,
 *  not an accident — so nothing here sorts. */
function groupBy(rows, column) {
	const groups = new Map();
	for (const row of rows) {
		if (!groups.has(row[column])) groups.set(row[column], []);
		groups.get(row[column]).push(row);
	}
	return groups;
}

/** The responsive set is derived from the 2200-wide original by convention:
 *  <name>-2200.jpg implies <name>-1400.jpg and the .webp of each. Phase 4's Drive
 *  pipeline emits exactly those four files, so this stays true once images are
 *  automated. sync-content.mjs checks all four exist on disk before writing. */
function photoOf(row) {
	const wide = row.photo;
	const narrow = wide.replace('-2200.', '-1400.');
	const webp = (p) => p.replace(/\.(jpe?g|png)$/i, '.webp');
	return {
		src: wide,
		srcset: `${narrow} 1400w, ${wide} 2200w`,
		srcsetWebp: `${webp(narrow)} 1400w, ${webp(wide)} 2200w`,
		alt: row.alt,
		fx: Number(row.fx),
		fy: Number(row.fy)
	};
}

export function shape(tabs) {
	const copy = {};
	// Sorted so that adding one key produces a one-line diff rather than reordering
	// the file according to wherever the owner happened to insert the row.
	for (const key of tabs.copy.map((r) => r.key).sort()) {
		copy[key] = tabs.copy.find((r) => r.key === key).text;
	}

	const providers = {};
	for (const p of tabs.providers) providers[p.key] = { name: p.name, address: p.address };

	const timetable = [...groupBy(tabs.timetable, 'day')].map(([day, rows]) => ({
		day,
		slots: rows.map((r) => [r.time, r.class, r.duration])
	}));

	const events = [...groupBy(tabs.events, 'month')].map(([month, rows]) => ({
		month,
		items: rows.map((r) => ({ d: r.day, w: r.weekday, name: r.name, det: r.detail, p: r.blurb, rem: r.remaining }))
	}));

	const offerings = [...groupBy(tabs.offerings, 'category')].map(([cat, rows]) => ({
		cat,
		items: rows.map((r) => ({ name: r.name, note: r.note }))
	}));

	return {
		copy,
		providers,
		classes: tabs.classes.map((c) => ({ name: c.name, tone: c.tone, meta: c.meta, blurb: c.blurb, provider: c.provider })),
		timetable,
		events,
		offerings,
		faqs: tabs.faqs.map((f) => ({ q: f.question, a: f.answer })),
		teachers: tabs.teachers.map((t) => ({
			slug: t.slug,
			name: t.name,
			role: t.role,
			intro: t.intro,
			highlights: t.highlights.split(/\r?\n/).map((h) => h.trim()).filter(Boolean),
			photo: photoOf(t),
			cta: { label: t.ctaLabel, option: t.ctaOption }
		})),
		// Both `href` and `h` are optional and must be absent rather than empty:
		// the markup falls back to a 72px height when `h` is missing, and an
		// emitted 0 would only reach that fallback by accident.
		partners: tabs.partners.map((p) => ({
			name: p.name,
			logo: p.logo,
			...(p.href ? { href: p.href } : {}),
			...(p.height ? { h: Number(p.height) } : {})
		})),
		// `pay` is deliberately absent. data.js attaches it from PAY, keyed by id.
		prices: tabs.prices.map((p) => ({
			id: p.id,
			lbl: p.label,
			amt: p.amount,
			note: p.note,
			...(/^(yes|true|1|x)$/i.test(p.feature ?? '') ? { feature: true } : {})
		})),
		testimonials: tabs.testimonials.map((t) => ({ quote: t.quote, who: t.who }))
	};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run scripts/lib/shape.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: 11 test files, 116 tests passed.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/shape.mjs scripts/lib/shape.test.js
git commit -m "feat: shape flat sheet rows into the site's content structure

Nothing sorts except the copy keys. Row order is the owner's ordering
tool — Tuesday before Sunday is a choice — so grouping preserves first
appearance. Copy keys sort so that adding one line produces a one-line
diff rather than reshuffling the file."
```

---

### Task 10: The sync script

The only file that both reads the network and writes to disk. Everything it decides was decided in Tasks 8 and 9; this one orchestrates and reports.

**Files:**
- Create: `scripts/sync-content.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readTabs` (Task 7), `validate` (Task 8), `shape` (Task 9)
- Produces: a rewritten `src/lib/content.generated.json`; exit code 0 on success, 1 on validation failure; a machine-readable failure summary on stdout that Task 14 forwards to the sheet and to email

- [ ] **Step 1: Write the script**

Create `scripts/sync-content.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readTabs } from './lib/sheets.mjs';
import { validate } from './lib/schema.mjs';
import { shape } from './lib/shape.mjs';

const TABS = [
	'copy', 'providers', 'classes', 'timetable', 'events',
	'offerings', 'faqs', 'teachers', 'partners', 'prices', 'testimonials'
];

const OUT = new URL('../src/lib/content.generated.json', import.meta.url);
const STATIC = new URL('../static', import.meta.url);

/** Every image path the content references must exist in static/. The schema
 *  cannot check this — it is pure and has no filesystem — but a broken image is
 *  exactly the kind of silent failure this pipeline exists to prevent. */
function missingFiles(content) {
	const paths = new Set();
	for (const t of content.teachers) {
		paths.add(t.photo.src);
		for (const set of [t.photo.srcset, t.photo.srcsetWebp]) {
			for (const entry of set.split(',')) paths.add(entry.trim().split(' ')[0]);
		}
	}
	for (const p of content.partners) paths.add(p.logo);
	return [...paths].filter((p) => !existsSync(new URL(`.${p}`, STATIC + '/')));
}

function report(errors) {
	console.error(`\nContent was not published. ${errors.length} problem${errors.length === 1 ? '' : 's'} to fix:\n`);
	for (const e of errors) {
		const where = e.row ? `${e.tab} tab, row ${e.row}` : `${e.tab} tab`;
		console.error(`  • ${where}: ${e.message}`);
		// Surfaces each one on the workflow's own summary page too.
		console.error(`::error title=${where}::${e.message}`);
	}
	console.error('\nNothing was deployed. The site is still showing the last version that passed.\n');
}

const tabs = await readTabs(TABS);

const errors = validate(tabs);
if (errors.length > 0) {
	report(errors);
	process.exit(1);
}

const content = shape(tabs);

const missing = missingFiles(content);
if (missing.length > 0) {
	report(missing.map((p) => ({
		tab: 'teachers or partners',
		row: null,
		message: `the image "${p}" is referenced but does not exist on the site. Check the spelling, or ask the developer to add the file.`
	})));
	process.exit(1);
}

// Trailing newline and two-space indent match what an editor would write, so the
// committed diff stays readable rather than being one enormous line.
const next = JSON.stringify(content, null, 2) + '\n';
const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';

if (next === current) {
	console.log('Content is already up to date. Nothing to deploy.');
	console.log('SYNC_RESULT=unchanged');
	process.exit(0);
}

writeFileSync(OUT, next);
console.log('Content updated.');
console.log('SYNC_RESULT=changed');
```

`SYNC_RESULT` is read by the workflow in Task 12 to decide whether to commit and deploy at all. A sync that changes nothing — the owner reformatted a cell, or the debounce fired twice — must not produce an empty commit and a pointless production deploy.

- [ ] **Step 2: Add the script entry**

In `package.json`, under `scripts`:

```json
"content:sync": "node --env-file-if-exists=.env scripts/sync-content.mjs",
```

`--env-file-if-exists` rather than `--env-file`: in CI the variables come from the workflow environment and there is no `.env` file, which `--env-file` treats as fatal. Node 22 supports the conditional form.

- [ ] **Step 3: Verify it fails cleanly with no credentials**

Run: `node scripts/sync-content.mjs`
Expected: exits non-zero with `GOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.` — not a stack trace about `undefined`.

- [ ] **Step 4: Verify the file-existence check against the current content**

Run:

```bash
node -e "
import('./scripts/lib/shape.mjs').then(async () => {
  const { existsSync } = await import('node:fs');
  const c = JSON.parse(await import('node:fs').then(fs => fs.readFileSync('src/lib/content.generated.json','utf8')));
  const paths = new Set();
  for (const t of c.teachers) {
    paths.add(t.photo.src);
    for (const set of [t.photo.srcset, t.photo.srcsetWebp])
      for (const e of set.split(',')) paths.add(e.trim().split(' ')[0]);
  }
  for (const p of c.partners) paths.add(p.logo);
  const missing = [...paths].filter(p => !existsSync('static' + p));
  console.log(missing.length === 0 ? 'all present' : 'MISSING: ' + missing.join(', '));
});
"
```

Expected: `all present`. If not, the derived `-1400` or `.webp` variants do not exist for a teacher photo, and `photoOf` in `shape.mjs` needs adjusting to the real filenames before the pipeline can run.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: 11 test files, 116 tests passed. This task adds no tests of its own — every decision it makes is already covered by `schema.test.js` and `shape.test.js`, and the remaining logic is I/O that the Task 12 end-to-end run exercises for real.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-content.mjs package.json
git commit -m "feat: add the content sync entry point

Exits 0 without writing when the sheet produces content identical to
what is committed. A debounce that fires twice, or an owner reformatting
a cell, must not produce an empty commit and a production deploy.

Checks that every referenced image exists on disk. The schema cannot —
it is pure — and a broken image is the same class of silent failure the
rest of the validation exists to catch."
```

---

### Task 11: Seed the spreadsheet

Google Cloud setup, the spreadsheet itself, and a run-once script that fills it from the committed content. The owner must never retype what already exists.

**Files:**
- Create: `scripts/seed-sheet.mjs`
- Modify: `scripts/lib/sheets.mjs`, `package.json`

**Interfaces:**
- Consumes: `content.generated.json`, `KEYS` from `copy-manifest.js`
- Produces: `writeTab(tab: string, rows: string[][]) => Promise<void>` added to `sheets.mjs`; a populated spreadsheet whose columns match the `REQUIRED` map in `schema.mjs` exactly

- [ ] **Step 1: Create the Google Cloud service account**

1. Go to `console.cloud.google.com`, create a project named `vinya-content`.
2. APIs & Services → Library → enable **Google Sheets API**.
3. IAM & Admin → Service Accounts → Create. Name it `vinya-sync`. No roles needed — access comes from sharing the sheet, not from IAM.
4. On the new account: Keys → Add Key → Create new key → **JSON**. It downloads once.
5. Note the account's email address, of the form `vinya-sync@vinya-content.iam.gserviceaccount.com`.

- [ ] **Step 2: Create the spreadsheet**

1. Create a spreadsheet named **Vinya — site content**.
2. Create one tab per entry in the `REQUIRED` map in `scripts/lib/schema.mjs`: `copy`, `providers`, `classes`, `timetable`, `events`, `offerings`, `faqs`, `teachers`, `partners`, `prices`, `testimonials`. Names are case-sensitive.
3. Share it with the service account email from Step 1, as **Editor**.
4. Copy the spreadsheet id out of its URL — the segment between `/d/` and `/edit`.

- [ ] **Step 3: Put the credentials in your local `.env`**

```bash
VINYA_SHEET_ID=<the id from step 2>
GOOGLE_SA_KEY=<the entire JSON key file, on one line>
```

Confirm `.env` is git-ignored before pasting anything into it:

Run: `git check-ignore -v .env`
Expected: a line naming `.gitignore`. If it prints nothing, **stop** — the key would be committed to a public repository.

- [ ] **Step 4: Add `writeTab` to the Sheets client**

In `scripts/lib/sheets.mjs`:

```js
/** Replaces a tab's contents entirely. USER_ENTERED so that a header row lands
 *  as text and the owner's own later edits behave the way typing does. */
export async function writeTab(tab, rows) {
	const client = auth();
	await client.request({
		url: `${API}/${sheetId()}/values/${encodeURIComponent(tab)}?valueInputOption=USER_ENTERED`,
		method: 'PUT',
		data: { values: rows }
	});
}
```

- [ ] **Step 5: Write the seed script**

Create `scripts/seed-sheet.mjs`:

```js
#!/usr/bin/env node
// Run once, to fill an empty spreadsheet from the committed content. After this,
// the spreadsheet is upstream and this script must not be run again — it would
// overwrite whatever the owner has since typed.
import { readFileSync } from 'node:fs';
import { writeTab } from './lib/sheets.mjs';
import { KEYS } from '../src/lib/copy-manifest.js';

const content = JSON.parse(readFileSync(new URL('../src/lib/content.generated.json', import.meta.url), 'utf8'));

// A short human hint per key prefix, so the copy tab can be navigated by someone
// who has never seen the site's source.
const WHERE = {
	'home.': 'Home page',
	'about.': 'About page',
	'classes.': 'Classes page',
	'teachers.': 'Teachers page',
	'events.': 'Events page',
	'footer.': 'Footer, every page'
};
const whereFor = (key) => Object.entries(WHERE).find(([p]) => key.startsWith(p))?.[1] ?? '';

const tabs = {
	copy: [
		['key', 'text', 'where'],
		...KEYS.map((k) => [k, content.copy[k], whereFor(k)])
	],
	providers: [
		['key', 'name', 'address'],
		...Object.entries(content.providers).map(([key, p]) => [key, p.name, p.address])
	],
	classes: [
		['name', 'tone', 'meta', 'blurb', 'provider'],
		...content.classes.map((c) => [c.name, c.tone, c.meta, c.blurb, c.provider])
	],
	timetable: [
		['day', 'time', 'class', 'duration'],
		...content.timetable.flatMap((r) => r.slots.map((s) => [r.day, s[0], s[1], s[2]]))
	],
	events: [
		['month', 'day', 'weekday', 'name', 'detail', 'blurb', 'remaining'],
		...content.events.flatMap((g) => g.items.map((i) => [g.month, i.d, i.w, i.name, i.det, i.p, i.rem]))
	],
	offerings: [
		['category', 'name', 'note'],
		...content.offerings.flatMap((g) => g.items.map((i) => [g.cat, i.name, i.note]))
	],
	faqs: [['question', 'answer'], ...content.faqs.map((f) => [f.q, f.a])],
	teachers: [
		['slug', 'name', 'role', 'intro', 'highlights', 'photo', 'alt', 'fx', 'fy', 'ctaLabel', 'ctaOption'],
		...content.teachers.map((t) => [
			t.slug, t.name, t.role, t.intro, t.highlights.join('\n'),
			t.photo.src, t.photo.alt, String(t.photo.fx), String(t.photo.fy),
			t.cta.label, t.cta.option
		])
	],
	partners: [
		['name', 'logo', 'href', 'height'],
		...content.partners.map((p) => [p.name, p.logo, p.href ?? '', String(p.h)])
	],
	prices: [
		['id', 'label', 'amount', 'note', 'feature'],
		...content.prices.map((p) => [p.id, p.lbl, p.amt, p.note, p.feature ? 'yes' : ''])
	],
	testimonials: [['quote', 'who'], ...content.testimonials.map((t) => [t.quote, t.who])]
};

for (const [tab, rows] of Object.entries(tabs)) {
	await writeTab(tab, rows);
	console.log(`${tab}: ${rows.length - 1} rows`);
}
console.log('\nSeeded. Do not run this again — the spreadsheet is upstream from here.');
```

- [ ] **Step 6: Add the script entry and run it**

In `package.json`:

```json
"content:seed": "node --env-file=.env scripts/seed-sheet.mjs",
```

Run: `pnpm content:seed`
Expected: one line per tab with a plausible row count, ending in the warning.

- [ ] **Step 7: Freeze the header rows by hand**

In each tab: View → Freeze → 1 row, then bold row 1. Cosmetic, and it is what makes the sheet usable while scrolling.

- [ ] **Step 8: Verify the round trip**

Run: `pnpm content:sync`
Expected: `Content is already up to date. Nothing to deploy.` and `SYNC_RESULT=unchanged`.

This is the important check in the whole task: the sheet now reproduces the committed content byte for byte, which means `seed-sheet.mjs`, `shape.mjs` and `schema.mjs` all agree on the same column names and the same shape. Any mismatch surfaces here as a diff or a validation error, before the pipeline is live.

Run: `git status --short`
Expected: no modification to `src/lib/content.generated.json`.

- [ ] **Step 9: Verify validation fires against the real sheet**

In the spreadsheet, change the `events` tab's `month` cell in row 2 to `2026-09-05`.

Run: `pnpm content:sync`
Expected: exit code 1, and a message naming `events tab, row 2` and telling you to write `September 2026`.

Put the cell back and re-run. Expected: `unchanged`.

- [ ] **Step 10: Commit**

```bash
git add scripts/seed-sheet.mjs scripts/lib/sheets.mjs package.json
git commit -m "feat: seed the spreadsheet from the committed content

The owner must never retype what already exists. Running sync straight
after seed and getting 'unchanged' is also the proof that seed, shape and
schema agree on the same columns and the same shape."
```

---

### Task 12: The workflow

Wires the dispatch event into the existing deploy path. Three fixes are required for it to reach production at all, and two loop guards for it not to run away.

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `scripts/sync-content.mjs` and its `SYNC_RESULT` output (Task 10)
- Produces: a `repository_dispatch` path that syncs, commits and deploys to production; `steps.deploy.outputs.url` is unchanged and remains what Task 14 writes into the sheet

- [ ] **Step 1: Add the trigger and a content concurrency group**

At the top of `.github/workflows/deploy.yml`:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  # Fired by the spreadsheet's Apps Script, thirty seconds after the owner's last
  # edit. See docs/superpowers/specs/2026-08-19-sheets-cms-design.md
  repository_dispatch:
    types: [content-update]

# Code pushes still supersede each other: a slow older build must never land on
# top of a newer one. Content runs get their own group and do NOT cancel, because
# a run cancelled between its commit and its deploy would leave main ahead of the
# live site with nothing scheduled to fix it.
concurrency:
  group: >-
    ${{ github.event_name == 'repository_dispatch'
        && 'content-sync'
        || format('deploy-{0}', github.ref) }}
  cancel-in-progress: ${{ github.event_name != 'repository_dispatch' }}
```

- [ ] **Step 2: Fix the production flags**

Both `VERCEL_ENV` and `PROD_FLAG` currently derive from `github.event_name == 'push'`, so a dispatch run would take the `else` branch of each and deploy to a throwaway preview that nobody ever sees. In the `env:` block:

```yaml
  # push to main and content updates => production, pull request => throwaway preview
  IS_PROD: ${{ github.event_name == 'push' || github.event_name == 'repository_dispatch' }}
  VERCEL_ENV: ${{ (github.event_name == 'push' || github.event_name == 'repository_dispatch') && 'production' || 'preview' }}
  PROD_FLAG: ${{ (github.event_name == 'push' || github.event_name == 'repository_dispatch') && '--prod' || '' }}
```

The same expression appears in the job's `environment.name` and in the secrets-check step's echo. Replace both with the `IS_PROD` form so the four places cannot drift:

```yaml
    environment:
      name: ${{ (github.event_name == 'push' || github.event_name == 'repository_dispatch') && 'production' || 'preview' }}
      url: ${{ steps.deploy.outputs.url }}
```

- [ ] **Step 3: Grant write permission for the content commit**

The job currently declares `contents: read`. The sync commits:

```yaml
    permissions:
      contents: write
      pull-requests: write
```

- [ ] **Step 4: Add the sync and commit steps**

Insert after `Install dependencies` and before `Install Vercel CLI`:

```yaml
      - name: Sync content from the spreadsheet
        id: sync
        if: github.event_name == 'repository_dispatch'
        env:
          GOOGLE_SA_KEY: ${{ secrets.GOOGLE_SA_KEY }}
          VINYA_SHEET_ID: ${{ vars.VINYA_SHEET_ID }}
        run: |
          # 2>&1 because every failure bullet is written to stderr, and the
          # reporting steps below read this file. pipefail because GitHub's
          # default shell is `bash -e {0}`: without it the pipeline reports
          # tee's exit code and a rejected sync would look like a success.
          set -o pipefail
          node scripts/sync-content.mjs 2>&1 | tee sync.log

      - name: Commit the updated content
        id: commit
        if: github.event_name == 'repository_dispatch' && success()
        run: |
          if ! grep -q 'SYNC_RESULT=changed' sync.log; then
            echo "Nothing changed. Skipping the commit and the deploy."
            echo "changed=false" >> "$GITHUB_OUTPUT"
            exit 0
          fi

          git config user.name  "vinya-content[bot]"
          git config user.email "vinya-content[bot]@users.noreply.github.com"
          git add src/lib/content.generated.json

          # [skip ci] belt and braces: a push made with the default GITHUB_TOKEN
          # already does not trigger further workflow runs, which is the guard that
          # stops this deploying itself in a loop. The marker documents the intent
          # for anyone reading the history.
          git commit -m "content: update from the spreadsheet [skip ci]"

          # Rebase rather than merge: content runs are serialised by the concurrency
          # group, but a code push can still land between checkout and here.
          git pull --rebase origin main
          git push origin HEAD:main
          echo "changed=true" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 5: Skip the deploy when nothing changed**

Add the same guard to the `Build`, `Deploy` and `Pull Vercel project settings` steps, so a no-op dispatch costs a few seconds rather than a full production deploy:

```yaml
        if: github.event_name != 'repository_dispatch' || steps.commit.outputs.changed == 'true'
```

- [ ] **Step 6: Add the repository secret and variable**

- Settings → Secrets and variables → Actions → **Secrets** → New: `GOOGLE_SA_KEY`, the entire service-account JSON on one line.
- The same page → **Variables** → New: `VINYA_SHEET_ID`, the spreadsheet id.

The sheet id is a variable rather than a secret deliberately: it is not sensitive, and a secret would be masked in the logs, which makes a misconfiguration much harder to diagnose.

- [ ] **Step 7: Extend the secrets-check step**

The workflow's first step names missing secrets before anything slow runs. Add the two new ones so a dispatch fails in seconds with a useful name:

```yaml
          if [ "${{ github.event_name }}" = "repository_dispatch" ]; then
            [ -n "${{ secrets.GOOGLE_SA_KEY }}" ] || missing+=(GOOGLE_SA_KEY)
            [ -n "${{ vars.VINYA_SHEET_ID }}" ]   || missing+=(VINYA_SHEET_ID)
          fi
```

- [ ] **Step 8: Commit and push the workflow**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy content updates from the spreadsheet

Three fixes were needed for a dispatch to reach production at all:
VERCEL_ENV, PROD_FLAG and environment.name were all derived from
event_name == 'push', so a content update would have deployed to a
throwaway preview and never gone live.

Content runs do not cancel each other. A run killed between its commit
and its deploy would leave main ahead of the live site with nothing
scheduled to fix it."
git push -u origin HEAD
```

- [ ] **Step 9: Fire a dispatch by hand and watch it**

```bash
gh api repos/gsalao/vinya/dispatches -f event_type=content-update
gh run watch
```

Expected: the run reaches `Sync content from the spreadsheet`, prints `Content is already up to date`, skips the commit and the deploy, and finishes green. That confirms auth, the secret, the variable and the no-op path.

Then change one cell in the `copy` tab and fire it again. Expected: a commit authored by `vinya-content[bot]`, a production deploy, and the change visible on the live site. Confirm the bot's commit did **not** trigger a second workflow run:

Run: `gh run list --limit 5`
Expected: exactly one new run, not two.

- [ ] **Step 10: Verify a bad cell blocks the deploy**

Set the `events` month cell to `2026-09-05` again and fire a dispatch.

Expected: the run fails at the sync step, the annotation names `events tab, row 2`, no commit is made, and the live site is unchanged.

Restore the cell.

---

### Task 13: The debounce

Twenty lines of Apps Script. It knows nothing about the content — it fires an event and stops.

**Files:**
- Create: `apps-script/Code.gs`, `apps-script/README.md`

**Interfaces:**
- Consumes: the `content-update` dispatch type from Task 12
- Produces: an installed `onEditInstallable` trigger on the spreadsheet, and a `Vinya` menu with `Publish now`

- [ ] **Step 1: Create the GitHub token**

github.com → Settings → Developer settings → **Fine-grained** personal access tokens → Generate new.

- Repository access: **Only select repositories** → `gsalao/vinya`
- Permissions → Repository permissions → **Contents: Read and write**

`repository_dispatch` is gated by the Contents permission; there is no narrower scope for it. This is why the token is fine-grained and single-repo: anyone who can edit the Apps Script project can read it out of Script Properties, so it must be the weakest credential that works. Set a 1-year expiry and put the renewal in a calendar.

- [ ] **Step 2: Write the script**

Create `apps-script/Code.gs`. This file is committed for version control and history; the Apps Script editor is where it actually runs.

```js
/**
 * Vinya — content publisher.
 *
 * Committed at apps-script/Code.gs. Paste changes into Extensions -> Apps Script
 * on the "Vinya — site content" spreadsheet.
 *
 * Setup, once:
 *   1. Project Settings -> Script Properties -> add GH_TOKEN (fine-grained PAT,
 *      gsalao/vinya only, Contents: read and write).
 *   2. Triggers -> Add Trigger -> onEditInstallable -> From spreadsheet -> On edit.
 *      This must be an INSTALLABLE trigger. A simple onEdit(e) runs unauthorized
 *      and cannot call UrlFetchApp at all, so the dispatch would silently never
 *      fire.
 */

var REPO = 'gsalao/vinya';
var DEBOUNCE_MS = 30 * 1000;
var MACHINE_TABS = ['Status', 'Inquiries'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vinya')
    .addItem('Publish now', 'firePublish')
    .addToUi();
}

function onEditInstallable(e) {
  var tab = e.range.getSheet().getName();
  // A status write must not trigger a publish, which would trigger another status
  // write, and so on.
  if (MACHINE_TABS.indexOf(tab) !== -1) return;

  cancelPending();
  ScriptApp.newTrigger('firePublish').timeBased().after(DEBOUNCE_MS).create();
  setStatus('Edit noted — publishing in about 30 seconds.');
}

/** Delete-then-create is what makes this a debounce rather than a fixed window:
 *  each edit pushes the deadline out. It also keeps the trigger count at one,
 *  well under the twenty-per-script limit. */
function cancelPending() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'firePublish') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function firePublish() {
  cancelPending(); // one-shot triggers do not remove themselves
  setStatus('Publishing…');

  var token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) {
    setStatus('Not published: GH_TOKEN is missing from Script Properties. Ask the developer.');
    return;
  }

  var response = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'content-update' }),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 204) {
    // 401 means the token expired, which will happen once a year and is otherwise
    // completely invisible: the owner edits, nothing happens, and nobody knows why.
    setStatus('Not published: GitHub refused the request (' + code + '). Ask the developer to check the token.');
  }
}

function setStatus(text) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Status');
  if (sheet) sheet.getRange('B2').setValue(text);
}
```

- [ ] **Step 3: Install it**

1. On the spreadsheet: Extensions → Apps Script.
2. Replace `Code.gs` with the file above. Save.
3. Project Settings → Script Properties → add `GH_TOKEN`.
4. Add a `Status` tab with `Last publish` in `A2`, leaving `B2` empty.
5. Triggers → Add Trigger → function `onEditInstallable`, source **From spreadsheet**, event type **On edit**. Authorize when prompted.
6. Reload the spreadsheet. A `Vinya` menu appears.

- [ ] **Step 4: Verify the debounce collapses a burst**

Edit six different cells on the `copy` tab within thirty seconds.

Expected: `Status!B2` says `Edit noted — publishing in about 30 seconds.` after each. About thirty seconds after the last one it changes to `Publishing…`.

Run: `gh run list --limit 5`
Expected: exactly **one** new run for the whole burst.

- [ ] **Step 5: Verify the manual override**

Vinya → Publish now.
Expected: `Publishing…` immediately, and a run within seconds.

- [ ] **Step 6: Verify a status write does not publish**

Run: `gh run list --limit 3` and note the newest run id. Wait a minute.
Run it again. Expected: no new run — the Action's own `Status` write in Task 14 must not become a publish loop. At this stage the Action does not write the cell yet; edit `Status!B2` by hand instead and confirm no dispatch fires.

- [ ] **Step 7: Commit the script**

```bash
mkdir -p apps-script
git add apps-script/
git commit -m "feat: debounce spreadsheet edits into a single publish

Each edit cancels the pending timer and arms a new one, so a burst of
edits produces exactly one deploy thirty seconds after the last of them
rather than one per cell.

The trigger has to be installable. A simple onEdit runs unauthorized and
cannot call UrlFetchApp at all, so the dispatch would silently never
fire — which is the worst possible failure mode here."
```

---

## Phase 2 — Feedback

### Task 14: Status write-back

The owner has no Deploy button to watch. Without this she edits, waits, and guesses.

**Files:**
- Modify: `.github/workflows/deploy.yml`, `scripts/lib/sheets.mjs`
- Create: `scripts/report-status.mjs`

**Interfaces:**
- Consumes: `writeCell` (Task 7), `steps.deploy.outputs.url` (Task 12)
- Produces: `node scripts/report-status.mjs "<text>"` writes a timestamped line into `Status!B2`. No separate history table: the spreadsheet's own File -> Version history already records every write, and a second copy would be one more thing to keep correct

- [ ] **Step 1: Write the reporter**

Create `scripts/report-status.mjs`:

```js
#!/usr/bin/env node
// Writes one line into the spreadsheet's Status tab. Called from the workflow on
// both success and failure, so the owner sees the outcome where she is already
// looking rather than in an inbox or a GitHub log she has never opened.
import { writeCell } from './lib/sheets.mjs';

const text = process.argv[2];
if (!text) {
	console.error('usage: report-status.mjs "<text>"');
	process.exit(2);
}

// Amsterdam, because that is where the person reading it is.
const now = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Amsterdam',
	day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
}).format(new Date());

const line = `${now} — ${text}`;

// Never fail the workflow over a status write. A deploy that succeeded but could
// not report itself is still a deploy that succeeded.
try {
	await writeCell('Status!B2', line);
	console.log(`Status: ${line}`);
} catch (error) {
	console.error(`::warning::Could not write the Status cell: ${error.message}`);
}
```

- [ ] **Step 2: Wire it into the workflow**

Three call sites in `.github/workflows/deploy.yml`, each with the same env block as the sync step.

On validation failure, immediately after the sync step:

```yaml
      - name: Report a failed sync to the sheet
        if: github.event_name == 'repository_dispatch' && failure()
        env:
          GOOGLE_SA_KEY: ${{ secrets.GOOGLE_SA_KEY }}
          VINYA_SHEET_ID: ${{ vars.VINYA_SHEET_ID }}
        run: |
          # The first bullet from the sync's own report. It already names the tab,
          # the row and what to type instead, so it needs no reformatting.
          problem=$(grep -m1 '^  • ' sync.log | sed 's/^  • //')
          node scripts/report-status.mjs "Not published — ${problem:-the content could not be read. Ask the developer.}"
```

At the very end of the job, after the deploy step:

```yaml
      - name: Report success to the sheet
        if: github.event_name == 'repository_dispatch' && success() && steps.commit.outputs.changed == 'true'
        env:
          GOOGLE_SA_KEY: ${{ secrets.GOOGLE_SA_KEY }}
          VINYA_SHEET_ID: ${{ vars.VINYA_SHEET_ID }}
        run: node scripts/report-status.mjs "Live — ${{ steps.deploy.outputs.url }}"

      - name: Report a no-op to the sheet
        if: github.event_name == 'repository_dispatch' && success() && steps.commit.outputs.changed != 'true'
        env:
          GOOGLE_SA_KEY: ${{ secrets.GOOGLE_SA_KEY }}
          VINYA_SHEET_ID: ${{ vars.VINYA_SHEET_ID }}
        run: node scripts/report-status.mjs "Nothing to publish — the site already matches the sheet."
```

The no-op message matters more than it looks. Without it, a formatting-only edit leaves `Publishing…` on screen forever and the owner reasonably concludes the system is broken.

- [ ] **Step 3: Verify all three paths**

Edit a `copy` cell. Expected, in order: `Edit noted…`, `Publishing…`, then `Live — https://…` with a timestamp.

Re-apply the same value to the same cell. Expected: ends at `Nothing to publish — the site already matches the sheet.`

Set the `events` month cell to `2026-09-05`. Expected: `Not published — events tab, row 2: month reads "2026-09-05" but must read like "September 2026"…` and the live site unchanged. Restore the cell.

- [ ] **Step 4: Verify the status write does not loop**

Run: `gh run list --limit 10`
Expected: one run per publish. If each publish spawns another, the `MACHINE_TABS` guard in `Code.gs` is not matching the tab name — check the spelling and its capitalisation.

- [ ] **Step 5: Commit**

```bash
git add scripts/report-status.mjs .github/workflows/deploy.yml
git commit -m "feat: report publish state into the spreadsheet

A failed status write is a warning, never a failure. A deploy that
succeeded but could not report itself is still a deploy that succeeded.

The no-op message earns its place: without it, an edit that changes
nothing leaves 'Publishing…' on screen forever and the owner reasonably
concludes the system is broken."
```

---

### Task 15: Failure email

The sheet says what went wrong, but only while she is looking at it. A rejected edit made on the way out the door needs to follow her.

**Files:**
- Create: `scripts/notify-failure.mjs`
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `sendMail`, `mailReady`, `ownerRecipients` from `src/lib/server/mail.js`
- Produces: an email to the owner naming the tab, the row and the fix

- [ ] **Step 1: Check what the mail module needs**

Run: `sed -n '1,60p' src/lib/server/mail.js`

Confirm the exported names are `sendMail`, `mailReady` and `ownerRecipients`, and note which environment variables they read. If `mail.js` imports from `$env/dynamic/private`, it cannot be imported by a plain Node script — in that case this task reads `process.env` and builds its own `nodemailer` transport rather than importing the module. Decide from what the file actually does, and say which in the commit message.

- [ ] **Step 2: Write the notifier**

Create `scripts/notify-failure.mjs`:

```js
#!/usr/bin/env node
// Emails the owner when the spreadsheet's content was rejected. Success is
// visible in the sheet and does not need mail: a success message she learns to
// ignore is how a failure message gets ignored too.
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';

const log = readFileSync('sync.log', 'utf8');
const problems = [...log.matchAll(/^ {2}• (.+)$/gm)].map((m) => m[1]);

if (problems.length === 0) {
	console.log('No itemised problems in sync.log. Not sending mail.');
	process.exit(0);
}

const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, MAIL_TO } = process.env;
if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !MAIL_TO) {
	console.warn('::warning::Mail is not configured for this job, so the failure was not emailed.');
	process.exit(0);
}

const body = [
	'Your latest change to the Vinya content sheet was not published.',
	'',
	problems.length === 1 ? 'Here is the problem:' : `Here are the ${problems.length} problems:`,
	'',
	...problems.map((p) => `  • ${p}`),
	'',
	'The website has not changed. It is still showing the last version that worked.',
	'Fix the cells above and it will publish itself about thirty seconds later.',
	'',
	'The Status tab of the sheet shows the same message.'
].join('\n');

const transport = nodemailer.createTransport({
	host: MAIL_HOST,
	port: Number(MAIL_PORT ?? 465),
	secure: Number(MAIL_PORT ?? 465) === 465,
	auth: { user: MAIL_USER, pass: MAIL_PASS }
});

await transport.sendMail({
	from: MAIL_FROM || MAIL_USER,
	to: MAIL_TO,
	subject: 'Vinya website: your change was not published',
	text: body
});

console.log(`Emailed ${problems.length} problem(s) to the owner.`);
```

The message says what happened, what it means for the site, and what to do. It never mentions GitHub, a build, or a workflow — those are not things the reader has a way to act on.

- [ ] **Step 3: Wire it into the workflow**

Immediately after the `Report a failed sync to the sheet` step:

```yaml
      - name: Email the owner about the failure
        if: github.event_name == 'repository_dispatch' && failure()
        continue-on-error: true
        env:
          MAIL_HOST: ${{ secrets.MAIL_HOST }}
          MAIL_PORT: ${{ secrets.MAIL_PORT }}
          MAIL_USER: ${{ secrets.MAIL_USER }}
          MAIL_PASS: ${{ secrets.MAIL_PASS }}
          MAIL_FROM: ${{ secrets.MAIL_FROM }}
          MAIL_TO: ${{ secrets.MAIL_TO }}
        run: node scripts/notify-failure.mjs
```

`continue-on-error` because the run has already failed and reported to the sheet. A mail server outage must not turn one clear failure into two confusing ones.

Add the six `MAIL_*` values as repository secrets, matching what is already in Vercel's environment. `MAIL_TO` is a secret here rather than a variable: it is the owner's address, and this repository is public, so it must be masked in logs.

- [ ] **Step 4: Verify**

Set the `events` month cell to `2026-09-05` and let the debounce fire.

Expected: the sheet shows the failure, an email arrives naming `events tab, row 2` and the correction, and the live site is unchanged.

Restore the cell and confirm a successful publish sends **no** mail.

- [ ] **Step 5: Commit**

```bash
git add scripts/notify-failure.mjs .github/workflows/deploy.yml
git commit -m "feat: email the owner when her change was rejected

Failure only. A success mail she learns to ignore is how a failure mail
gets ignored too.

The message never mentions GitHub, a build or a workflow. It says what
happened, what it means for the site, and which cell to fix."
```

---

### Task 16: Make the sheet safe to use

Protected ranges so the machine tabs cannot be edited by accident, and a `Read me first` tab so the system explains itself inside the tool it lives in.

**Files:**
- Create: `apps-script/README.md`
- Modify: the spreadsheet

**Interfaces:**
- Consumes: everything above
- Produces: a spreadsheet a non-technical person can use without supervision

- [ ] **Step 1: Protect the machine tabs**

On `Status`: Data → Protect sheets and ranges → Sheet → `Status` → Set permissions → **Only you** → Done. Repeat for `Inquiries` when Phase 5 creates it.

The service account still writes through the API — protection applies to the UI, not to the owner of the sheet's API access. That is exactly the split wanted.

- [ ] **Step 2: Protect the `key` column on the copy tab**

Data → Protect sheets and ranges → Range → `copy!A:A` → **Only you**.

The keys are the contract with the markup. The `text` column is hers to edit; the `key` column is what makes editing it work, and a renamed key fails the build with a message about a missing row that will read as nonsense to her.

- [ ] **Step 3: Write the `Read me first` tab**

Create a tab named `Read me first`, drag it to first position, and fill column A:

```
How this sheet works

Everything you type here appears on vinyayoga's website. There is no publish
button: about thirty seconds after you stop typing, the site updates itself.
Watch the Status tab to see it happen.

If something you typed cannot be published, the site does not change. It keeps
showing the last version that worked, and you get an email saying which cell to
fix. Nothing you can type in this sheet can break the website.

What each tab is for

  copy          Every heading and paragraph on the site. The 'where' column
                tells you which page each one is on. Do not edit the 'key'
                column — that is how the site finds the text.
  classes       The classes you offer, and which studio each one is at.
  timetable     Which class runs on which day, at what time.
  events        One row per gathering. The 'month' column must be written like
                'September 2026' — not as a date.
  offerings     The 'Beyond the weekly mat' section on the Classes page.
  faqs          The first-timer questions on the Classes page.
  teachers      Teacher profiles. Put each highlight on its own line, using
                Alt+Enter inside the cell.
  partners      The logos at the bottom of the home page.
  providers     The studios you teach at, with their addresses.
  prices        What each pass is called and what it costs. The payment links
                themselves are set in the site's code and cannot be changed
                here — ask the developer.
  testimonials  The quotes on the home page.
  Status        Written by the website. You cannot edit it, and you do not
                need to.

Writing more than one paragraph

Press Alt+Enter inside a cell to start a new line. Every new line becomes a new
paragraph on the site. One line break or two makes no difference.

If nothing seems to be happening

Check the Status tab first. If it says 'Publishing…' and has said so for more
than five minutes, use the Vinya menu at the top and choose 'Publish now'. If it
still does nothing, that is a technical problem — contact the developer.

Who can see this sheet

Anyone you share it with can change every word on the website. Treat sharing it
the way you would treat giving someone the keys to the studio.
```

- [ ] **Step 4: Write the developer runbook**

Create `apps-script/README.md`:

```markdown
# Content pipeline — operating notes

The spreadsheet is the source of truth for site content. It reaches the site
through `.github/workflows/deploy.yml` on a `repository_dispatch`.

Design: `docs/superpowers/specs/2026-08-19-sheets-cms-design.md`

## Credentials, and where each one lives

| What | Where | Rotate |
| ---- | ----- | ------ |
| `GH_TOKEN` — fine-grained PAT, `gsalao/vinya` only, Contents: read+write | Apps Script → Project Settings → Script Properties | Yearly. Expiry is silent: the owner edits and nothing happens |
| `GOOGLE_SA_KEY` — service account JSON | GitHub → Secrets → Actions | On staff change |
| `VINYA_SHEET_ID` | GitHub → Variables → Actions | Never |
| `MAIL_*` | GitHub → Secrets, and Vercel env | With the mailbox |

## When something is wrong

**The owner says nothing happens when she edits.** Check `Status!B2` first. If
it never leaves `Edit noted…`, the installable trigger was deleted — Apps Script
→ Triggers → re-add `onEditInstallable`, From spreadsheet, On edit. If it says
GitHub refused the request, the PAT expired.

**A publish failed and the message is unclear.** Re-run it by hand:

```bash
VINYA_SHEET_ID=... GOOGLE_SA_KEY='...' node scripts/sync-content.mjs
```

**Bad content went live.** It is a commit like any other:

```bash
git revert <sha> && git push
```

Then fix the sheet, or it republishes the same thing thirty seconds later.

**Every publish spawns two workflow runs.** The `MACHINE_TABS` guard in
`apps-script/Code.gs` is not matching the `Status` tab name.

## What must never move into the sheet

`pay.url` and `pay.qr` in `src/lib/data.js`, and any credential. See the spec's
"The payment boundary" and "Secrets". `scripts/lib/schema.mjs` rejects a URL in
the prices tab; that rule is load-bearing, not tidiness.
```

- [ ] **Step 5: Walk the owner through it**

Sit with her and have her make three changes unaided: a paragraph edit on the home page, a new FAQ row, and a price change. Watch where she hesitates and fix the `Read me first` wording rather than explaining it verbally.

- [ ] **Step 6: Commit**

```bash
git add apps-script/README.md
git commit -m "docs: runbook for the content pipeline

Written for whoever picks this up in a year, including me. The failure
modes that are actually likely — an expired PAT, a deleted trigger — are
both completely silent from the owner's side, so they are first."
```

---

## Done when

- The owner changes any heading, paragraph, class, timetable slot, event, FAQ, offering, teacher, partner, testimonial or price label from the spreadsheet, and the site updates itself within two minutes.
- A malformed cell stops the deploy, leaves the site untouched, and produces a message in the sheet and by email that names the cell and the fix.
- `pnpm test` passes. `grep -r "tikkie" src/lib/content.generated.json` returns nothing.
- A burst of edits produces exactly one deploy. The Action's own commit produces none.

## Deferred to later plans

- **Phase 3** — `Settings` tab driving `MAIL_TO` through `vercel env`, with the previous recipients notified before any change applies.
- **Phase 4** — Drive image pipeline: originals in a folder, `sharp` derivatives committed, `photos` tab for alt text and focal points.
- **Phase 5** — Inquiries written back from `/api/booking`, with a 12-month retention sweep and a privacy line on the form.
- **Phase 6** — Handover.
- The three hardcoded archive rows at `src/routes/events/+page.svelte:39-43`. They are stale demo data and need a decision — real past events, or delete the section — not a sheet tab.
