/** The inverse of shape.mjs: takes the site's nested content object and lays
 *  it back out as the flat, per-tab rows a spreadsheet holds — the same shape
 *  rowsToObjects() would hand to validate() and shape() after a real sync.
 *
 *  This exists so a fresh spreadsheet can be seeded from the committed
 *  content without retyping it (scripts/seed-sheet.mjs), and so the round
 *  trip shape(flatten(content)) === content can be proven in a test with no
 *  network and no credentials (shape.test.js). Keeping this logic in one
 *  place, rather than copied inline wherever rows are needed, is the whole
 *  point: shape.mjs, schema.mjs and this file must never describe the same
 *  columns three different ways.
 *
 *  Pure: no fs, no fetch, no process. Every __row is synthetic — rows start
 *  at 2 (after a header row) and increase across the whole call, tab by tab,
 *  purely so a row carries a plausible number if it ever reaches an error
 *  message; it has no relationship to where seed-sheet.mjs will actually
 *  place it in the sheet. */
export function flatten(content) {
	let row = 2; // sheet rows start after a header row
	const nextRow = () => row++;

	const copy = Object.entries(content.copy).map(([key, text]) => ({
		key, text, __row: nextRow()
	}));

	const providers = Object.entries(content.providers).map(([key, p]) => ({
		key, name: p.name, address: p.address, __row: nextRow()
	}));

	const classes = content.classes.map((c) => ({
		name: c.name, tone: c.tone, meta: c.meta, blurb: c.blurb, provider: c.provider, __row: nextRow()
	}));

	// timetable: shape() groups flat rows by day and collects each day's
	// [time, class, duration] triples in sheet order. Reversing means one row
	// per slot, carrying its group's day.
	const timetable = content.timetable.flatMap((group) =>
		group.slots.map(([time, cls, duration]) => ({ day: group.day, time, class: cls, duration, __row: nextRow() }))
	);

	// events: shape() groups by month and drops the hand-kept count. Reversing
	// means one row per item, carrying its group's month, with the short keys
	// (d/w/det/p/rem) expanded back to the sheet's column names. "remaining" is
	// not in schema.mjs's REQUIRED list for events (it's optional — a blank
	// cell is allowed), but shape() still reads it for every row, so it has to
	// be carried here for the round trip to reproduce the file exactly.
	const events = content.events.flatMap((group) =>
		group.items.map((item) => ({
			month: group.month, day: item.d, weekday: item.w, name: item.name,
			detail: item.det, blurb: item.p, remaining: item.rem, __row: nextRow()
		}))
	);

	// pastEvents: shape() neither groups nor sorts it, so the reverse is a
	// straight column rename back to the sheet's friendlier names — the same
	// relationship prices has between lbl/amt and label/amount.
	const pastEvents = content.pastEvents.map((e) => ({
		date: e.dt, name: e.nm, status: e.st, __row: nextRow()
	}));

	// offerings: shape() groups by category. Reversing means one row per item,
	// carrying its group's category.
	const offerings = content.offerings.flatMap((group) =>
		group.items.map((item) => ({ category: group.cat, name: item.name, note: item.note, __row: nextRow() }))
	);

	const faqs = content.faqs.map((f) => ({ question: f.q, answer: f.a, __row: nextRow() }));

	// teachers: shape() splits a newline-joined highlights cell and derives the
	// photo's narrow/webp variants from the wide file name by convention.
	// Reversing joins highlights back on '\n' and hands back only the wide
	// src, alt, fx and fy — the rest is re-derived by shape() itself, which is
	// exactly what proves the naming convention still holds for the real
	// files, not just a fixture's.
	const teachers = content.teachers.map((t) => ({
		slug: t.slug, name: t.name, role: t.role, intro: t.intro,
		highlights: t.highlights.join('\n'),
		photo: t.photo.src, alt: t.photo.alt, fx: String(t.photo.fx), fy: String(t.photo.fy),
		ctaLabel: t.cta.label, ctaOption: t.cta.option, __row: nextRow()
	}));

	// partners: `href` and `h` are omitted on disk when blank rather than
	// stored as '' or 0, so the reverse restores the empty-string shape a
	// blank sheet cell would produce. Neither is in REQUIRED (both optional),
	// but both are carried here — same reasoning as events.remaining above.
	const partners = content.partners.map((p) => ({
		name: p.name, logo: p.logo,
		href: p.href ?? '', height: p.h !== undefined ? String(p.h) : '',
		__row: nextRow()
	}));

	// prices: `feature: true` on disk came from a sheet cell reading "yes";
	// its absence came from a blank cell. `feature` is optional in REQUIRED
	// for the same reason as above.
	const prices = content.prices.map((p) => ({
		id: p.id, label: p.lbl, amount: p.amt, note: p.note,
		feature: p.feature ? 'yes' : '', __row: nextRow()
	}));

	const testimonials = content.testimonials.map((t) => ({ quote: t.quote, who: t.who, __row: nextRow() }));

	return { copy, providers, classes, timetable, events, pastEvents, offerings, faqs, teachers, partners, prices, testimonials };
}
