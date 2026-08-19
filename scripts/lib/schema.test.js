import { describe, it, expect } from 'vitest';
import { validate } from './schema.mjs';
import { rowsToObjects } from './sheets.mjs';

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

	// openBooking() preselects on an exact string match. rowsToObjects() already
	// trims ordinary leading/trailing spaces, so an *ordinary* trailing space
	// never reaches this file — the real hazard is a character trim() cannot
	// remove: a non-breaking space in the middle of a value (trim only strips
	// the ends) or a zero-width space anywhere (trim never strips it at all).
	// The fixture is pushed through the real rowsToObjects() rather than
	// hand-built, so this only passes if the rule fires on what the actual
	// pipeline can deliver.
	it('rejects a class name with an invisible character that survives trimming', async () => {
		const tabs = await withCopy(ok());
		const [row] = rowsToObjects([['name'], ['Kundalini Yoga']]);
		tabs.classes[0].name = row.name;
		expect(messages(validate(tabs))).toContain('invisible');
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

	// eventLabel() does Number(item.d), same as this file's Number(e.day). A
	// date-formatted day cell serialises to something Number() cannot parse
	// sensibly, and the booking label drifts from what the picker offers.
	it('rejects an events day that is not two digits', async () => {
		const tabs = await withCopy(ok());
		tabs.events[0].day = '2026-09-05';
		const errors = validate(tabs);
		expect(errors[0].tab).toBe('events');
		expect(errors[0].message).toContain('08');
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

	// This file reconstructs an event's booking label itself (it never imports
	// eventLabel() — src/ is off limits from here), so nothing stops the two
	// formulas from drifting apart. Asserting the exact literal string pins
	// this file's formula to eventLabel()'s: `${item.name} · ${Number(item.d)}
	// ${group.month.slice(0, 3)}` for a day of "08" and a month of "August 2026"
	// is `Full Moon · 8 Aug`. If either formula changes, this breaks loudly
	// instead of the two silently disagreeing.
	it('reconstructs an event booking label identically to eventLabel() in data.js', async () => {
		const tabs = await withCopy(ok());
		tabs.events.push({ ...tabs.events[0], __row: 3 });
		expect(messages(validate(tabs))).toContain('"Full Moon · 8 Aug" is already used');
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

	// A required column that is entirely absent from the row (e.g. a renamed or
	// misspelled header) is a different failure than a blank cell: `row[column]`
	// reads `undefined`, not `''`.
	it('rejects a row missing a required column entirely, not just a blank cell', async () => {
		const tabs = await withCopy(ok());
		delete tabs.classes[0].blurb;
		const errors = validate(tabs);
		expect(errors[0].tab).toBe('classes');
		expect(errors[0].message).toContain('no "blurb" column');
	});

	// A row on the copy tab whose key was mistyped, or whose key the markup no
	// longer references, edits nothing on the live site and raises no error
	// anywhere else — this is the one rule that catches it.
	it('rejects a copy row whose key is not used anywhere on the site', async () => {
		const tabs = await withCopy(ok());
		tabs.copy.push({ key: 'nowhere.at.all', text: 'x', where: '', __row: tabs.copy.length + 2 });
		expect(messages(validate(tabs))).toContain('nowhere.at.all');
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
	// discovering them one deploy at a time. Split in two because the passes
	// have different rules about combining: once a required column is missing
	// or blank, downstream semantic rules would fail on undefined and bury the
	// one error the owner needs to read, so the structural pass returns early
	// rather than mixing with semantic failures. Each test below proves
	// batching happens within its own pass, across multiple tabs.
	it('reports every structural failure in one pass rather than stopping at the first', async () => {
		const tabs = await withCopy(ok());
		tabs.faqs[0].answer = '';
		tabs.testimonials[0].who = '';
		expect(validate(tabs).length).toBeGreaterThanOrEqual(2);
	});

	it('reports every semantic failure in one pass rather than stopping at the first', async () => {
		const tabs = await withCopy(ok());
		tabs.classes[0].provider = 'nope';
		tabs.events[0].month = 'not a month';
		tabs.prices[0].id = 'drop-inn';
		expect(validate(tabs).length).toBeGreaterThanOrEqual(3);
	});
});
