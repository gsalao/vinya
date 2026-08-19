import { describe, it, expect } from 'vitest';
import { FIELDS, SECTIONS, fieldFor, blankRow } from './fields.js';
import { REQUIRED, OPTIONAL_EXTRAS } from '../../../scripts/lib/schema.mjs';

const columnsFor = (tab) => [...REQUIRED[tab], ...(OPTIONAL_EXTRAS[tab] ?? [])];

describe('field metadata', () => {
	// A label for a column that does not exist is dead weight; a column with no
	// label still renders, but with a machine name the owner has to decode.
	it('labels exactly the columns that exist, for every tab it covers', () => {
		for (const [tab, fields] of Object.entries(FIELDS)) {
			expect(Object.keys(fields).sort(), tab).toEqual(columnsFor(tab).sort());
		}
	});

	it('names only real tabs', () => {
		for (const tab of Object.keys(FIELDS)) expect(Object.keys(REQUIRED)).toContain(tab);
		for (const sections of Object.values(SECTIONS)) {
			for (const s of sections) expect(Object.keys(REQUIRED)).toContain(s.tab);
		}
	});

	// The payment boundary, made visible: the owner sees the price id but cannot
	// change it, because data.js keys its hardcoded Tikkie targets by that value.
	it('locks the price reference', () => {
		expect(fieldFor('prices', 'id').kind).toBe('locked');
	});

	it('falls back rather than vanishing for an unlabelled column', () => {
		expect(fieldFor('classes', 'somethingNew')).toEqual({ label: 'Something New', kind: 'line' });
	});

	it('builds a blank row the form can bind to', () => {
		expect(blankRow(['a', 'b'])).toEqual({ a: '', b: '' });
	});
});
