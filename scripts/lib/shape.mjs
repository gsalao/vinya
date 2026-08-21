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
function photoOf(row, field = 'photo') {
	const wide = row[field];
	// Only a file that follows the -2200 convention has the other three
	// variants. An older single-file image does not, and claiming a srcset for
	// it would send the browser after .webp files that were never generated —
	// which is a broken image, not a slower one.
	const hasVariants = wide.includes('-2200.');
	const narrow = wide.replace('-2200.', '-1400.');
	const webp = (p) => p.replace(/\.(jpe?g|png)$/i, '.webp');
	return {
		src: wide,
		...(hasVariants
			? {
					srcset: `${narrow} 1400w, ${wide} 2200w`,
					srcsetWebp: `${webp(narrow)} 1400w, ${webp(wide)} 2200w`
				}
			: {}),
		alt: row.alt,
		fx: Number(row.fx),
		fy: Number(row.fy),
		...(row.fyMobile ? { fyMobile: Number(row.fyMobile) } : {})
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

	// pastEvents has no grouping and no per-row identity column — flat rows in,
	// flat objects out, in sheet order, same as events.remaining being carried
	// straight through.
	const pastEvents = tabs.pastEvents.map((e) => ({ dt: e.date, nm: e.name, st: e.status }));

	const offerings = [...groupBy(tabs.offerings, 'category')].map(([cat, rows]) => ({
		cat,
		items: rows.map((r) => ({ name: r.name, note: r.note }))
	}));

	const images = {};
	for (const row of tabs.images ?? []) images[row.key] = photoOf(row, 'src');

	return {
		copy,
		images,
		gallery: (tabs.gallery ?? []).map((row) => photoOf(row, 'src')),
		providers,
		classes: tabs.classes.map((c) => ({ name: c.name, tone: c.tone, meta: c.meta, blurb: c.blurb, provider: c.provider })),
		timetable,
		events,
		pastEvents,
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
		testimonials: tabs.testimonials.map((t) => ({ quote: t.quote, who: t.who })),
		// The footer's social links. Kept a plain list so the footer renders
		// however many there are, and none at all when the studio has none.
		socials: (tabs.socials ?? []).map((s) => ({ name: s.name, url: s.url }))
	};
}
