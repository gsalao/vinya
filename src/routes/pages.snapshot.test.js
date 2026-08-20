import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Home from './+page.svelte';
import About from './about/+page.svelte';
import Classes from './classes/+page.svelte';
import Teachers from './teachers/+page.svelte';
import Events from './events/+page.svelte';
import Footer from '$lib/components/Footer.svelte';

// The safety net for the copy extraction. `render` from svelte/server returns the
// markup as a string with no DOM involved, so the `use:reveal` action never runs
// and no jsdom is needed. Any word that changes during extraction shows up here as
// a diff instead of reaching the site.
/** Text is data now — the owner edits it and the Action commits the result, so a
 *  snapshot containing her words goes stale every time she publishes. What this
 *  test is actually for is catching an unintended change to the markup, which is
 *  exactly what survives when the text is stripped out.
 *
 *  Replaces every text node with a placeholder, keeping tags, attributes and
 *  order. A reworded heading no longer fails; a heading that changes tag,
 *  loses a class, or moves still does. */
const skeleton = (html) =>
	html
		.replace(/>[^<]+</g, (m) => (m.trim() === '><' ? m : '>·<'))
		// src, srcset and href are content too, now that she chooses the pictures
		// and the partner links. Leaving them in meant the snapshot went stale
		// every time she changed a photo — the same staleness stripping the text
		// was meant to remove.
		.replace(/(value|placeholder|alt|title|aria-label|src|srcset|href|sizes)="[^"]*"/g, '$1="·"');

const pages = [
	['home', Home],
	['about', About],
	['classes', Classes],
	['teachers', Teachers],
	['events', Events],
	['footer', Footer]
];

describe('rendered pages', () => {
	for (const [name, Component] of pages) {
		it(`${name} renders unchanged`, () => {
			const { body } = render(Component);
			expect(skeleton(body)).toMatchSnapshot();
		});
	}
});
