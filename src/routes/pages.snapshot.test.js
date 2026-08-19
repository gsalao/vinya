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
			expect(body).toMatchSnapshot();
		});
	}
});
