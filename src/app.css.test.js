import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8');

/** Innermost rules only. The inner `[^{}]*` cannot span a nested block, so rules
 *  inside a media query match individually and the media block itself does not. */
function rules(source) {
	const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
	return [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
		selector: selector.trim().replace(/\s+/g, ' '),
		body
	}));
}

const declares = (body, property) => new RegExp(`(^|;|\\s)${property}\\s*:`).test(body);

describe('app.css layout invariants', () => {
	// `aspect-ratio` governs BOTH axes. When `max-height` clamps the height of an
	// element whose width is auto, the browser recomputes the width from the ratio
	// rather than filling the column — so the element pulls away from its container
	// and leaves a gap beside it. That is what put a cream stripe down the right of
	// the hero photo on phones. Declaring an explicit width pins the inline axis and
	// lets object-fit:cover crop instead.
	it('never combines aspect-ratio with max-height without pinning the width', () => {
		const offenders = rules(css)
			.filter((r) => declares(r.body, 'aspect-ratio') && declares(r.body, 'max-height'))
			.filter((r) => !declares(r.body, 'width'))
			.map((r) => r.selector);

		expect(offenders, 'these will narrow away from their container when max-height bites').toEqual(
			[]
		);
	});

	// A percentage inside min()/max() resolves against the containing block. When
	// that block's height comes from aspect-ratio, WebKit treats the percentage as
	// indefinite and drops the whole function — so the cap silently does nothing,
	// the image renders at natural size, and it forces its card wider than the
	// phone. Chromium applies it, which is why this only ever appeared on iPhone.
	it('never caps a height with a percentage inside min() or max()', () => {
		const offenders = rules(css)
			.filter((r) => /max-height:\s*(min|max)\([^;}]*%/.test(r.body))
			.map((r) => r.selector);

		expect(offenders, 'these caps are ignored by WebKit inside an aspect-ratio box').toEqual([]);
	});

	// The same recomputation happens from the other direction: a fixed height plus a
	// ratio derives the width, so a stretch container is not honoured.
	it('never combines aspect-ratio with a fixed height without pinning the width', () => {
		const offenders = rules(css)
			.filter((r) => declares(r.body, 'aspect-ratio'))
			.filter((r) => /(^|;|\s)height\s*:\s*(?!auto)[^;]/.test(r.body))
			.filter((r) => !declares(r.body, 'width'))
			.map((r) => r.selector);

		expect(offenders).toEqual([]);
	});
});

describe('bare element selectors', () => {
	// app.css is loaded by the admin too, so an element selector here reaches
	// markup it was never written for. `header{position:sticky;background:...}`
	// styled the public navbar and also every <header> in the admin's section
	// cards, putting a translucent cream band across each card title. The admin
	// bar had been given explicit overrides to cancel it, which cured the one
	// symptom anyone had noticed and left the cause in place.
	//
	// Only paint and positioning count. `section{position:relative}` is a bare
	// selector too, and harmless — it establishes a containing block and paints
	// nothing.
	it('does not paint or position header or footer as bare elements', () => {
		const offenders = rules(css)
			.filter(({ selector, body }) =>
				selector
					.split(',')
					.map((s) => s.trim())
					.some((s) => s === 'header' || s === 'footer') &&
				/(^|;|\s)(background|border|padding|z-index)\s*:|position\s*:\s*(sticky|fixed)/.test(body)
			)
			.map(({ selector }) => selector);

		expect(offenders).toEqual([]);
	});
});
