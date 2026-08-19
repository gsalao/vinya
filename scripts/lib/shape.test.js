import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shape } from './shape.mjs';
import { flatten } from './flatten.mjs';

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
	pastEvents: [
		{ date: '26 Jul', name: 'Breathwork Circle', status: 'Full', __row: 2 },
		{ date: '12 Jul', name: 'Solstice Slow Flow', status: 'Full', __row: 3 }
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
	testimonials: [{ quote: 'Good.', who: 'Marieke', __row: 2 }],
	images: [{ key: 'home.hero', src: '/images/x-2200.jpg', alt: 'X', fx: '50', fy: '70', fyMobile: '', __row: 2 }],
	gallery: [{ src: '/images/plain.jpeg', alt: 'Plain', fx: '50', fy: '40', __row: 2 }]
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

	// pastEvents is not grouped and not sorted: it's a flat list, rendered in
	// exactly the order the owner put the rows in.
	it('maps pastEvents columns to the keys the markup uses, preserving sheet order', () => {
		expect(shape(tabs).pastEvents).toEqual([
			{ dt: '26 Jul', nm: 'Breathwork Circle', st: 'Full' },
			{ dt: '12 Jul', nm: 'Solstice Slow Flow', st: 'Full' }
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

	// A file following the -2200 convention has the other three variants; an older
	// single-file image does not, and claiming a srcset for it would point the
	// browser at .webp files that were never generated.
	it('derives a srcset only for images that have variants', () => {
		const out = shape(tabs);
		expect(out.images['home.hero'].srcset).toBe('/images/x-1400.jpg 1400w, /images/x-2200.jpg 2200w');
		expect(out.images['home.hero'].srcsetWebp).toBe('/images/x-1400.webp 1400w, /images/x-2200.webp 2200w');
		expect(out.gallery[0].srcset).toBeUndefined();
		expect(out.gallery[0].srcsetWebp).toBeUndefined();
		expect(out.gallery[0].src).toBe('/images/plain.jpeg');
	});

	it('omits a blank mobile focal point rather than emitting an empty one', () => {
		expect(shape(tabs).images['home.hero'].fyMobile).toBeUndefined();
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
// spreadsheet tab would hold (flatten(), the inverse of shape()), and confirm
// shape() puts it back together into exactly the same bytes. This is the same
// round trip Task 11 performs when it seeds a real spreadsheet from this file
// and then runs a sync expecting "unchanged": here it runs with no network and
// no credentials, on every commit, so shape(), flatten() and schema.mjs's
// column names staying in agreement is proven rather than assumed.
describe('shape (round trip against the real content file, via flatten())', () => {
	const CONTENT_PATH = fileURLToPath(new URL('../../src/lib/content.generated.json', import.meta.url));
	const raw = readFileSync(CONTENT_PATH, 'utf8');
	const content = JSON.parse(raw);

	it('reproduces src/lib/content.generated.json byte-for-byte: shape(flatten(content)) === content', () => {
		expect(JSON.stringify(shape(flatten(content)), null, 2) + '\n').toBe(raw);
	});
});
