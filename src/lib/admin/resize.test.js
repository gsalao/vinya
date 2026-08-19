import { describe, it, expect } from 'vitest';
import { imageId, WIDTHS } from './resize.js';

describe('imageId', () => {
	// The name is what makes the srcset convention work: shape.mjs turns
	// "<id>-2200.jpg" into the 1400 and .webp variants by string replacement, so
	// an id containing a dot or a space would break the derivation silently.
	it('produces a name safe for the srcset convention', () => {
		for (const slot of ['home.hero', 'Teacher Photo', 'about/founder', 'a  b']) {
			const id = imageId(slot);
			expect(id, slot).toMatch(/^[a-z0-9-]+$/);
			expect(id, slot).not.toContain('.');
		}
	});

	it('is unique per call, so a replacement never serves a cached old photo', () => {
		const ids = new Set(Array.from({ length: 50 }, () => imageId('home.hero')));
		expect(ids.size).toBe(50);
	});

	it('keeps the slot readable in the file name', () => {
		expect(imageId('home.hero')).toMatch(/^home-hero-/);
	});
});

describe('the widths the site serves', () => {
	// shape.mjs builds "…-1400.jpg 1400w, …-2200.jpg 2200w". If these two ever
	// disagree with that, the browser would request a file that does not exist.
	it('are exactly the two the srcset names', () => {
		expect(WIDTHS).toEqual([2200, 1400]);
	});
});
