import { describe, it, expect } from 'vitest';
import { events, eventLabel, testimonials } from './data.js';

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
