import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

// The fixtures above are small and hand-picked. This test goes the other
// direction: start from the real, committed content.generated.json — the
// file the whole site actually reads — take it apart into the flat rows a
// spreadsheet tab would hold, and confirm shape() puts it back together into
// exactly the same bytes. This is the same round trip Task 11 performs when
// it seeds a real spreadsheet from this file and then runs a sync expecting
// "unchanged": here it runs with no network and no credentials, on every
// commit, so the two staying in agreement is proven rather than assumed.
describe('shape (round trip against the real content file)', () => {
	const CONTENT_PATH = fileURLToPath(new URL('../../src/lib/content.generated.json', import.meta.url));
	const raw = readFileSync(CONTENT_PATH, 'utf8');
	const content = JSON.parse(raw);

	it('reproduces src/lib/content.generated.json byte-for-byte from its own flat rows', () => {
		let row = 2; // sheet rows start after a header row
		const nextRow = () => row++;

		const copy = Object.entries(content.copy).map(([key, text]) => ({ key, text, __row: nextRow() }));

		const providers = Object.entries(content.providers).map(([key, p]) => ({
			key, name: p.name, address: p.address, __row: nextRow()
		}));

		const classes = content.classes.map((c) => ({
			name: c.name, tone: c.tone, meta: c.meta, blurb: c.blurb, provider: c.provider, __row: nextRow()
		}));

		// timetable: shape() groups flat rows by day and collects each day's
		// [time, class, duration] triples in sheet order. Reversing means one
		// row per slot, carrying its group's day.
		const timetable = content.timetable.flatMap((group) =>
			group.slots.map(([time, cls, duration]) => ({ day: group.day, time, class: cls, duration, __row: nextRow() }))
		);

		// events: shape() groups by month and drops the hand-kept count. Reversing
		// means one row per item, carrying its group's month, with the short keys
		// (d/w/det/p/rem) expanded back to the sheet's column names.
		const events = content.events.flatMap((group) =>
			group.items.map((item) => ({
				month: group.month, day: item.d, weekday: item.w, name: item.name,
				detail: item.det, blurb: item.p, remaining: item.rem, __row: nextRow()
			}))
		);

		// offerings: shape() groups by category. Reversing means one row per
		// item, carrying its group's category.
		const offerings = content.offerings.flatMap((group) =>
			group.items.map((item) => ({ category: group.cat, name: item.name, note: item.note, __row: nextRow() }))
		);

		const faqs = content.faqs.map((f) => ({ question: f.q, answer: f.a, __row: nextRow() }));

		// teachers: shape() splits a newline-joined highlights cell and derives
		// the photo's narrow/webp variants from the wide file name by convention.
		// Reversing joins highlights back on '\n' and hands back only the wide
		// src, alt, fx and fy — the rest is re-derived by shape() itself, which
		// is exactly what proves the naming convention still holds for the real
		// files, not just the fixture's.
		const teachers = content.teachers.map((t) => ({
			slug: t.slug, name: t.name, role: t.role, intro: t.intro,
			highlights: t.highlights.join('\n'),
			photo: t.photo.src, alt: t.photo.alt, fx: String(t.photo.fx), fy: String(t.photo.fy),
			ctaLabel: t.cta.label, ctaOption: t.cta.option, __row: nextRow()
		}));

		// partners: `h` and `href` are omitted on disk when blank rather than
		// stored as '' or 0, so the reverse must restore the empty string shape()
		// expects from an unfilled sheet cell.
		const partners = content.partners.map((p) => ({
			name: p.name, logo: p.logo,
			href: p.href ?? '', height: p.h !== undefined ? String(p.h) : '',
			__row: nextRow()
		}));

		// prices: `feature: true` on disk came from a sheet cell reading "yes";
		// its absence came from a blank cell.
		const prices = content.prices.map((p) => ({
			id: p.id, label: p.lbl, amount: p.amt, note: p.note,
			feature: p.feature ? 'yes' : '', __row: nextRow()
		}));

		const testimonials = content.testimonials.map((t) => ({ quote: t.quote, who: t.who, __row: nextRow() }));

		const tabs = { copy, providers, classes, timetable, events, offerings, faqs, teachers, partners, prices, testimonials };

		expect(JSON.stringify(shape(tabs), null, 2) + '\n').toBe(raw);
	});
});
