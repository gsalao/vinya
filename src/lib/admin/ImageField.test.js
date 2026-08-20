import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import ImageField from './ImageField.svelte';

/** The save action reads every column positionally — form.get(`${i}.${column}`).
 *  A picture field that names its input anything else submits nothing, and the
 *  server reports the column as empty rather than as missing, which is a
 *  confusing way to find out.
 *
 *  This exact bug shipped: `slot` was used for both the form field name and the
 *  uploaded file name, and they were the same value until the file name was made
 *  readable. Then every image save broke at once.
 */
describe('ImageField', () => {
	it('names its input by row position, not by slot', () => {
		const { body } = render(ImageField, {
			props: { row: { src: '/x.jpg', fx: '50', fy: '50' }, column: 'src', index: 2, slot: 'home.hero' }
		});
		expect(body).toContain('name="2.src"');
		expect(body).not.toContain('name="home.hero.src"');
	});

	it('carries the current value through, so saving without touching it is not a wipe', () => {
		const { body } = render(ImageField, {
			props: { row: { src: '/images/keep-me.jpg' }, column: 'src', index: 0, slot: 'x' }
		});
		expect(body).toContain('value="/images/keep-me.jpg"');
	});

	it('submits an empty string rather than nothing when there is no picture yet', () => {
		const { body } = render(ImageField, {
			props: { row: {}, column: 'src', index: 1, slot: 'x' }
		});
		expect(body).toContain('name="1.src"');
	});
});
