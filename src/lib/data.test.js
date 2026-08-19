import { describe, it, expect } from 'vitest';
import { events, eventLabel, testimonials } from './data.js';
import content from './content.generated.json';
import { classes, prices, providers, locationOf } from './data.js';

describe('events', () => {
	// `n` was typed by hand ("2 gatherings") next to the items it counts. Adding an
	// event should not also mean remembering to update a counter.
	it('derives the gathering count from the items', () => {
		for (const group of events) {
			expect(group.n).toBe(`${group.items.length} gathering${group.items.length === 1 ? '' : 's'}`);
		}
	});

	it('builds a booking label the picker can match', () => {
		expect(eventLabel(events[0].items[0], events[0])).toBe('Full Moon Flow & Sound Bath · 8 Aug');
	});
});

describe('testimonials', () => {
	it('is content, not markup', () => {
		expect(testimonials).toHaveLength(3);
		expect(testimonials[0].who).toBe('Marieke · Slow Yoga Adjustment');
	});
});

describe('content boundary', () => {
	it('sources structured content from the generated file', () => {
		expect(classes).toEqual(content.classes);
		expect(providers).toEqual(content.providers);
	});

	// The payment boundary. A spreadsheet can set what a pass is called and what
	// it costs; it can never set where the money goes. See the spec, "The payment
	// boundary": a QR cannot be checked by eye.
	it('keeps every payment URL out of the generated file', () => {
		expect(JSON.stringify(content)).not.toContain('tikkie.me');
		// Scoped to prices rather than the whole file: the copy tab is the owner's,
		// and a URL she types into a paragraph is content, not a payment target.
		// This is the same rule the sheet validator enforces on that tab.
		expect(JSON.stringify(content.prices)).not.toMatch(/https?:\/\//);
		for (const p of content.prices) expect(Object.keys(p), p.id).not.toContain('pay');
	});

	it('still attaches a pay target to every price', () => {
		for (const p of prices) {
			expect(p.pay.url, p.id).toMatch(/^https:\/\/tikkie\.me\/pay\//);
			expect(p.pay.qr, p.id).toMatch(/^\/qr\//);
		}
	});

	it('resolves a venue for every class', () => {
		for (const c of classes) expect(locationOf(c.name), c.name).not.toBe('');
	});
});
