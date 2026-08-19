import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Events from './+page.svelte';
import { pastEvents } from '$lib/data.js';

// The "Show 3" label used to be a hand-typed number sitting next to three
// hand-typed rows — the exact class of defect Task 5 removed from
// events[].n. This pins the toggle's count to pastEvents.length so a fourth
// row added on the spreadsheet can never drift the button's own count out of
// sync with what it opens.
describe('events archive toggle', () => {
	it('shows a count derived from pastEvents.length, not a literal', () => {
		const { body } = render(Events);
		expect(pastEvents.length).toBeGreaterThan(0); // otherwise the toggle would not render at all
		expect(body).toContain(`Show ${pastEvents.length}`);
	});
});
