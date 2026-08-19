import { describe, it, expect } from 'vitest';
import { toCamel, toSnake, columnsFor, rowToObject } from './db.mjs';
import { REQUIRED, OPTIONAL_EXTRAS } from './schema.mjs';

describe('name conversion', () => {
	// The two directions have to compose back to the original, or a column the
	// pipeline asks for by camelCase name would be selected under the wrong
	// snake_case name and come back undefined.
	it('round-trips every column name the pipeline uses', () => {
		for (const tab of Object.keys(REQUIRED)) {
			for (const column of columnsFor(tab)) {
				expect(toCamel(toSnake(column)), column).toBe(column);
			}
			expect(toCamel(toSnake(tab)), tab).toBe(tab);
		}
	});

	it('converts the multi-word cases', () => {
		expect(toSnake('ctaLabel')).toBe('cta_label');
		expect(toCamel('cta_label')).toBe('ctaLabel');
		expect(toSnake('pastEvents')).toBe('past_events');
		expect(toCamel('past_events')).toBe('pastEvents');
	});

	it('leaves single-word names alone', () => {
		for (const word of ['copy', 'classes', 'name', 'blurb', 'fx']) {
			expect(toSnake(word)).toBe(word);
			expect(toCamel(word)).toBe(word);
		}
	});
});

describe('columnsFor', () => {
	it('is REQUIRED plus the optional extras, and nothing else', () => {
		expect(columnsFor('partners')).toEqual([...REQUIRED.partners, ...OPTIONAL_EXTRAS.partners]);
		expect(columnsFor('faqs')).toEqual(REQUIRED.faqs);
	});

	// schema.mjs scans every field of a prices row for a URL. If `id`, `sort` or
	// `updated_at` reached it, an unrelated column change could trip the payment
	// boundary check — or worse, mask it.
	it('excludes the database bookkeeping columns', () => {
		for (const tab of Object.keys(REQUIRED)) {
			for (const bookkeeping of ['sort', 'updated_at']) {
				expect(columnsFor(tab), tab).not.toContain(bookkeeping);
			}
		}
	});
});

describe('rowToObject', () => {
	it('camelCases the keys and trims the values', () => {
		expect(rowToObject({ cta_label: '  Book a 1:1  ', name: 'Nikita' }, 0)).toEqual({
			ctaLabel: 'Book a 1:1',
			name: 'Nikita',
			__row: 1
		});
	});

	it('numbers rows from 1, matching what the admin shows', () => {
		expect(rowToObject({ name: 'A' }, 0).__row).toBe(1);
		expect(rowToObject({ name: 'B' }, 4).__row).toBe(5);
	});

	// A null column would otherwise reach validate() as the string "null" and
	// pass a non-empty check while rendering as nonsense.
	it('turns null into an empty string rather than "null"', () => {
		expect(rowToObject({ href: null }, 0).href).toBe('');
	});
});
