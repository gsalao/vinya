import content from './content.generated.json';

export const providers = content.providers;
export const teachers = content.teachers;
export const classes = content.classes;
export const timetable = content.timetable;
export const offerings = content.offerings;
export const faqs = content.faqs;
export const testimonials = content.testimonials;
export const pastEvents = content.pastEvents;

export const partners = content.partners;

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

// Exported so scripts/lib/schema.mjs's PRICE_IDS can be pinned against this
// list in a test, the same way its STANDALONE_BOOK_OPTIONS is already pinned
// against standaloneBookOptions below. PAY itself stays private: an id
// dropped from it while still listed in PRICE_IDS would let validate() accept
// a sheet row that then throws below at module load, failing the build on
// main — exporting just the keys is enough to catch that without also
// exposing the payment URLs any wider than they already are.
export const payIds = Object.keys(PAY);

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

// Picker entries that aren't a class, an offering or an event. Exported so
// scripts/lib/schema.mjs can pin its own copy of this list against it in a
// test — schema.mjs cannot import this module directly, since data.js reads
// content.generated.json, the very file the spreadsheet sync is validating
// before that file exists.
export const standaloneBookOptions = ['1:1 Holistic session', 'Beginners course (4 evenings)'];

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
