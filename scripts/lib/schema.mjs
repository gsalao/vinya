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
				fail('prices', p.__row, `"${column}" contains a link — payment links are set in the site's code, not here (see the design doc). Remove it.`);
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
