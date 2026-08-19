import { KEYS } from '../../src/lib/copy-manifest.js';

// Every price id the code has a Tikkie target for. A spreadsheet row for a pass
// with no way to pay for it must fail here rather than render. Exported so
// schema.test.js can pin this list against data.js's exported payIds, the
// same way it pins STANDALONE_BOOK_OPTIONS below against
// standaloneBookOptions — see that export's comment for why this file cannot
// import data.js directly instead.
export const PRICE_IDS = ['drop-in', '5-class', '10-class', '1on1'];

// Booking-form entries that are neither a class, an offering nor an event —
// mirrors standaloneBookOptions in src/lib/data.js. This file cannot import
// that module: data.js reads content.generated.json, the very file this
// validation runs ahead of regenerating, so importing it here would be
// circular. schema.test.js pins this list against data.js's exported copy,
// the same way it pins PRICE_IDS above against data.js's exported payIds.
export const STANDALONE_BOOK_OPTIONS = ['1:1 Holistic session', 'Beginners course (4 evenings)'];

const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
const URL_LIKE = /https?:\/\//i;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Catches a date Sheets has silently reformatted into a machine form, e.g.
// typing "26 Jul" and having the cell turn into "7/26/2026" or "2026-07-26" —
// pastEvents.date is the most date-shaped column in the whole schema and has
// no dedicated cell-format instruction the owner can be reminded of otherwise.
const MACHINE_DATE = /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/;
// Catches a time Sheets has silently reformatted into a machine form, e.g.
// typing "10:30" and having the cell turn into "10:30:00" — the same failure
// mode as MACHINE_DATE above, just for timetable.time, which readTabs()
// reads back as FORMATTED_VALUE the same way it does every other column.
const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;
// The only class-row "tone" values app.css actually styles (.practice .tone.*
// and .class-row .tone.*, both in src/app.css) — anything else renders as a
// colourless dot with no error anywhere. Read off the CSS itself rather than
// hand-guessed, so this can't drift from what the site can actually draw.
const TONE = new Set(['gold', 'sky', 'tan', 'rust']);

// rowsToObjects() already trims every cell with String.prototype.trim(), so by
// the time a row reaches this file, ordinary leading/trailing spaces are gone.
// Two kinds of invisible character survive that anyway: a Unicode space (like
// a non-breaking space) sitting in the *middle* of a value, which trim() never
// touches because it only strips the ends; and a zero-width character (a
// zero-width space, joiner, or word joiner), which trim() does not strip at
// all, anywhere. Either one is invisible on screen but breaks the booking
// picker's exact string match, so it is checked for anywhere in the value.
const INVISIBLE = /[\u00A0\u1680\u2000-\u200D\u202F\u205F\u3000\u2060\uFEFF]/;

// Exported so flatten.mjs (the inverse of shape.mjs) and its tests can build
// rows against the same authoritative column names rather than keeping a
// second, hand-typed copy that could drift from this one.
export const REQUIRED = {
	providers: ['key', 'name', 'address'],
	classes: ['name', 'tone', 'meta', 'blurb', 'provider'],
	timetable: ['day', 'time', 'class', 'duration'],
	events: ['month', 'day', 'weekday', 'name', 'detail', 'blurb'],
	pastEvents: ['date', 'name', 'status'],
	offerings: ['category', 'name', 'note'],
	faqs: ['question', 'answer'],
	teachers: ['slug', 'name', 'role', 'intro', 'highlights', 'photo', 'alt', 'fx', 'fy', 'ctaLabel', 'ctaOption'],
	partners: ['name', 'logo'],
	prices: ['id', 'label', 'amount', 'note'],
	testimonials: ['quote', 'who'],
	copy: ['key', 'text']
};

// Every other tab fails the build when it has no rows: a site with no classes,
// or no prices, is not a site. A studio that has not yet held a past event is
// a normal, temporary state rather than a broken one, so pastEvents is the one
// tab allowed to be empty. The events page hides the whole "Past gatherings"
// toggle when there is nothing to show it for, rather than rendering an empty
// accordion — see src/routes/events/+page.svelte.
//
// Exported so anything else that has to decide whether a tab may legitimately
// have zero rows — flatten.test.js's fixture check, seed-sheet.mjs's column
// derivation for a tab with no data row to read a shape from — asks this set
// rather than keeping its own second opinion that could drift from it.
export const OPTIONAL_WHEN_EMPTY = new Set(['pastEvents']);

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
			if (OPTIONAL_WHEN_EMPTY.has(tab)) continue;
			fail(tab, null, `the "${tab}" tab has no rows. The site needs at least one.`);
			continue;
		}
		for (const row of rows) {
			for (const column of columns) {
				const value = row[column];
				if (value === undefined) {
					fail(tab, row.__row, `there is no "${column}" column. Check the header row spelling.`);
				} else if (value === '') {
					// On the copy tab, naming the row's key (when it has one) tells the
					// owner which piece of site text is blank without her needing to
					// open the sheet and count down to the row number.
					const named = tab === 'copy' && column !== 'key' && row.key ? ` for "${row.key}"` : '';
					fail(tab, row.__row, `"${column}" is empty${named}, and it is required.`);
				} else if (INVISIBLE.test(value)) {
					fail(tab, row.__row, `"${column}" has an invisible character in it (often left behind by pasting from another app) that will break exact matching. Delete the cell's contents and retype it.`);
				}
			}
		}
	}
	if (errors.length > 0) return errors; // later rules assume the shape is sound

	// --- providers resolve, tone is one app.css can actually draw ---
	const providerKeys = new Set(tabs.providers.map((p) => p.key));
	for (const c of tabs.classes) {
		if (!providerKeys.has(c.provider)) {
			fail('classes', c.__row, `provider "${c.provider}" is not a key on the providers tab, so this class would show no venue at all.`);
		}
		if (!TONE.has(c.tone)) {
			fail('classes', c.__row, `tone "${c.tone}" is not one of gold, sky, tan or rust, so this class would show as a colourless mark with no error anywhere. Use one of those four words exactly.`);
		}
	}

	// --- timetable references a real class, and its time is plain text ---
	const classNames = new Set(tabs.classes.map((c) => c.name));
	for (const t of tabs.timetable) {
		if (!classNames.has(t.class)) {
			fail('timetable', t.__row, `class "${t.class}" is not on the classes tab, so this session would show no venue.`);
		}
		if (!CLOCK.test(t.time)) {
			fail('timetable', t.__row, `time reads "${t.time}" but must read like "10:30". A time-formatted cell will not work — set the cell format to plain text.`);
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

	// --- pastEvents date format ---
	for (const p of tabs.pastEvents) {
		if (MACHINE_DATE.test(p.date)) {
			fail('pastEvents', p.__row, `date reads "${p.date}" but must read like "26 Jul". A date-formatted cell will not work — set the cell format to plain text.`);
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
				fail('prices', p.__row, `"${column}" contains a link — payment links are set in the site's code, not here (ask your developer). Remove it.`);
			}
		}
		if (!PRICE_IDS.includes(p.id)) {
			fail('prices', p.__row, `id "${p.id}" has no payment target in the site's code. Valid ids: ${PRICE_IDS.join(', ')}. A new pass needs a developer to add its Tikkie link.`);
		}
	}

	// --- partners ---
	// height is optional (not in REQUIRED) — a blank cell is fine, shape.mjs
	// omits `h` entirely for it. A non-numeric, non-blank cell is the hazard:
	// shape.mjs's `Number(p.height)` turns it into NaN, which serialises to
	// `null` and reaches the page as `style="--logo-h: nullpx"` with no error
	// anywhere.
	for (const p of tabs.partners) {
		// `undefined` (no "height" header on this tab at all) is treated the same
		// as a blank cell — both are the documented "no custom height" case.
		if (p.height !== undefined && p.height !== '' && !Number.isFinite(Number(p.height))) {
			fail('partners', p.__row, `height "${p.height}" must be a number, like "68" — the logo's height in pixels. Leave the cell blank to use the default height instead.`);
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
		// The teacher page's booking button preselects on an exact match against
		// the booking form's list, built from every class, offering and event name
		// plus the two entries above. A ctaOption spelled even slightly differently
		// opens that list with nothing selected and the button stuck disabled — the
		// same silent failure as an unresolved provider, just one button instead of
		// a whole page.
		if (!seen.has(t.ctaOption) && !STANDALONE_BOOK_OPTIONS.includes(t.ctaOption)) {
			const options = [...seen.keys(), ...STANDALONE_BOOK_OPTIONS];
			fail('teachers', t.__row, `the booking option "${t.ctaOption}" is not one of the choices on the booking form, so this teacher's booking button would open with nothing selected. Valid options: ${options.join(', ')}.`);
		}
	}

	// --- copy covers the manifest ---
	// A blank "text" cell is already caught above — "text" is required, so the
	// structural pass returns before this ever runs on a row that has one.
	// This only has to check for a key missing its row entirely.
	const copyKeys = new Set(tabs.copy.map((r) => r.key));
	for (const key of KEYS) {
		if (!copyKeys.has(key)) {
			fail('copy', null, `there is no row for "${key}", and the site renders it. Add a row with that key.`);
		}
	}
	// shape.mjs resolves each key with .find(), which keeps only the first
	// matching row and silently ignores every row after it — the same
	// first-wins hazard the teachers.slug duplicate rule above guards against.
	// Editing the second row of a duplicated key changes nothing on the site,
	// with no error anywhere else to explain why.
	const copyRowsByKey = new Map();
	for (const row of tabs.copy) {
		if (!KEYS.includes(row.key)) {
			fail('copy', row.__row, `"${row.key}" is not used anywhere on the site. Editing it will change nothing — delete the row, or check the spelling.`);
		}
		if (copyRowsByKey.has(row.key)) {
			fail('copy', row.__row, `"${row.key}" is already used on row ${copyRowsByKey.get(row.key)} of this tab. Only the first row with a given key is used, so editing this one changes nothing. Delete this row, or give it a different key.`);
		} else {
			copyRowsByKey.set(row.key, row.__row);
		}
	}

	return errors;
}
