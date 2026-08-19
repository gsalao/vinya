/** How each content column is presented to the owner.
 *
 *  `schema.mjs` decides what is *valid*; this file decides what it is *called*
 *  and how it is typed in. Keeping them separate means a validation rule and its
 *  label can never disagree about whether a field exists — REQUIRED is still the
 *  only authority on that, and anything here without a matching column is dead
 *  weight a test catches.
 *
 *  `kind` picks the input: 'line' a single-line box, 'para' a growing textarea,
 *  'lines' one item per line, 'flag' a yes/no, 'locked' shown but not editable.
 */

/** Every editable section, in the order the owner meets it, grouped by the page
 *  it appears on. `tab` matches a key of REQUIRED in schema.mjs. */
export const SECTIONS = {
	home: [
		{ tab: 'testimonials', title: 'What people say', blurb: 'The quotes on the home page.' },
		{ tab: 'partners', title: 'Partner logos', blurb: 'Shown near the bottom of the home page. Past three, they scroll gently instead of wrapping.' }
	],
	classes: [
		{ tab: 'classes', title: 'The classes', blurb: 'Also shown on the home page.', alsoOn: 'Home' },
		{ tab: 'timetable', title: 'Timetable', blurb: 'One row per session. The class name must match one of the classes above exactly.' },
		{ tab: 'prices', title: 'Passes and prices', blurb: 'Payment links are set in the code and cannot be changed here.' },
		{ tab: 'offerings', title: 'Beyond the weekly mat', blurb: 'Grouped by the category you give each row.' },
		{ tab: 'faqs', title: 'First-timer questions', blurb: '' }
	],
	teachers: [{ tab: 'teachers', title: 'Teacher profiles', blurb: 'Put each highlight on its own line.' }],
	events: [
		{ tab: 'events', title: 'Upcoming gatherings', blurb: 'The first row is what the home page advertises as the next gathering.' },
		{ tab: 'pastEvents', title: 'Past gatherings', blurb: 'Can be left empty — the section disappears from the site if it is.' }
	],
	about: [
		{ tab: 'providers', title: 'Where you teach', blurb: 'The key is used by the classes above to say where each one meets.' }
	]
};

/** Which page each copy key belongs to, so the prose lands under the page the
 *  owner is looking at rather than in one undifferentiated list. */
export const COPY_PAGES = {
	home: 'home.',
	classes: 'classes.',
	teachers: 'teachers.',
	events: 'events.',
	about: 'about.'
};

/** The order sections appear as you scroll each page, so the words are listed
 *  the way she meets them rather than alphabetically — which put the hero
 *  headline in the middle of the list, under G. Anything unlisted sorts last. */
export const COPY_ORDER = {
	home: ['hero', 'practice', 'about', 'pillars', 'teachers', 'gathering', 'testimonials', 'gallery', 'partners', 'jump'],
	classes: ['hero', 'detail', 'timetable', 'prices', 'offerings', 'faq'],
	teachers: ['hero', 'work'],
	events: ['hero', 'reserve', 'archive'],
	about: ['hero', 'expect', 'founder', 'find']
};

/** Sorts copy rows into page order, then alphabetically within a section so two
 *  fields of the same block keep a stable position. */
export function orderCopy(rows, pageKey) {
	const order = COPY_ORDER[pageKey] ?? [];
	const rank = (key) => {
		const section = key.split('.')[1] ?? '';
		const i = order.indexOf(section);
		return i === -1 ? order.length : i;
	};
	return [...rows].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key));
}

/** Labels and input kinds, keyed by tab then column. Anything not named here
 *  falls back to a title-cased column name and a single-line box. */
export const FIELDS = {
	classes: {
		name: { label: 'Name', kind: 'line', help: 'Used on the booking form, so it must match exactly wherever it appears.' },
		tone: { label: 'Colour', kind: 'line', help: 'One of: tan, sky, gold, rust.' },
		meta: { label: 'Details line', kind: 'line', help: 'e.g. 60 min · All levels · Mat provided' },
		blurb: { label: 'Description', kind: 'para' },
		provider: { label: 'Studio', kind: 'line', help: 'Must match a key from "Where you teach" on the About page.' }
	},
	timetable: {
		day: { label: 'Day', kind: 'line' },
		time: { label: 'Time', kind: 'line', help: 'Written like 10:30.' },
		class: { label: 'Class', kind: 'line', help: 'Must match one of your classes exactly.' },
		duration: { label: 'Length', kind: 'line', help: 'e.g. 60 min' }
	},
	events: {
		month: { label: 'Month', kind: 'line', help: 'Written like September 2026.' },
		day: { label: 'Day', kind: 'line', help: 'Two digits, like 08.' },
		weekday: { label: 'Weekday', kind: 'line', help: 'Short form, like Sat.' },
		name: { label: 'Name', kind: 'line' },
		detail: { label: 'Details line', kind: 'line', help: 'e.g. 19:00 · 90 min · €28 · Location to confirm' },
		blurb: { label: 'Description', kind: 'para' },
		remaining: { label: 'Places note', kind: 'line', help: 'Optional. e.g. 6 places left' }
	},
	pastEvents: {
		date: { label: 'Date', kind: 'line', help: 'Written like 26 Jul.' },
		name: { label: 'Name', kind: 'line' },
		status: { label: 'How it went', kind: 'line', help: 'e.g. Full, or Ran twice' }
	},
	offerings: {
		category: { label: 'Group', kind: 'line', help: 'Rows sharing a group appear together.' },
		name: { label: 'Name', kind: 'line' },
		note: { label: 'Description', kind: 'para' }
	},
	faqs: {
		question: { label: 'Question', kind: 'line' },
		answer: { label: 'Answer', kind: 'para' }
	},
	teachers: {
		slug: { label: 'Web name', kind: 'line', help: 'Lowercase with hyphens, like nikita-coppens.' },
		name: { label: 'Name', kind: 'line' },
		role: { label: 'Role', kind: 'line' },
		intro: { label: 'Introduction', kind: 'para' },
		highlights: { label: 'Highlights', kind: 'lines', help: 'One per line.' },
		photo: { label: 'Photo file', kind: 'line', help: 'Ask your developer to add new photos.' },
		alt: { label: 'Photo description', kind: 'line', help: 'For people who cannot see the image.' },
		fx: { label: 'Photo focus across', kind: 'line', help: '0-100. Higher moves the crop right.' },
		fy: { label: 'Photo focus down', kind: 'line', help: '0-100. Higher shows more of the lower half.' },
		ctaLabel: { label: 'Button text', kind: 'line' },
		ctaOption: { label: 'Button books', kind: 'line', help: 'Must match a class, offering or event exactly.' }
	},
	partners: {
		name: { label: 'Name', kind: 'line' },
		logo: { label: 'Logo file', kind: 'line', help: 'Ask your developer to add new logos.' },
		href: { label: 'Website', kind: 'line', help: 'Optional. With it the logo links out.' },
		height: { label: 'Logo height', kind: 'line', help: 'Optional. Tune until the row looks even rather than measures even — every logo is drawn at a different scale. Blank means 72.' }
	},
	prices: {
		id: { label: 'Reference', kind: 'locked', help: 'Set in the code, because the payment link is keyed to it.' },
		label: { label: 'Name', kind: 'line' },
		amount: { label: 'Price', kind: 'line', help: 'Written like €15.' },
		note: { label: 'Note', kind: 'line' },
		feature: { label: 'Highlight this one', kind: 'flag' }
	},
	testimonials: {
		quote: { label: 'Quote', kind: 'para' },
		who: { label: 'Who said it', kind: 'line' }
	},
	providers: {
		key: { label: 'Reference', kind: 'line', help: 'Short, no spaces. Your classes use this to say where they meet.' },
		name: { label: 'Studio name', kind: 'line' },
		address: { label: 'Address', kind: 'line' }
	}
};

const titleCase = (s) => s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/** Presentation for one column, with a sensible fallback so a column added to
 *  REQUIRED without a label here still renders instead of disappearing. */
export function fieldFor(tab, column) {
	return FIELDS[tab]?.[column] ?? { label: titleCase(column), kind: 'line' };
}

/** A row with no content yet, so "Add" produces something the form can bind to
 *  rather than a set of undefineds. */
export function blankRow(columns) {
	return Object.fromEntries(columns.map((c) => [c, '']));
}
