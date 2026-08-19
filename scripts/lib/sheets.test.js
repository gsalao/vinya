import { describe, it, expect } from 'vitest';
import { rowsToObjects } from './sheets.mjs';

describe('rowsToObjects', () => {
	it('uses the first row as headers', () => {
		expect(rowsToObjects([['name', 'tone'], ['Kundalini Yoga', 'tan']]))
			.toMatchObject([{ name: 'Kundalini Yoga', tone: 'tan' }]);
	});

	// Sheets omits trailing empty cells entirely rather than padding the row, so a
	// row whose last column is blank comes back short.
	it('fills missing trailing cells with empty strings', () => {
		expect(rowsToObjects([['name', 'tone', 'blurb'], ['Kundalini Yoga', 'tan']]))
			.toMatchObject([{ name: 'Kundalini Yoga', tone: 'tan', blurb: '' }]);
	});

	// The owner will leave a gap between blocks of rows. That is formatting, not data.
	it('skips rows that are entirely empty', () => {
		expect(rowsToObjects([['name'], ['A'], ['   '], [''], ['B']]))
			.toMatchObject([{ name: 'A' }, { name: 'B' }]);
	});

	it('trims every cell', () => {
		expect(rowsToObjects([['  name  '], ['  Kundalini Yoga  ']]))
			.toMatchObject([{ name: 'Kundalini Yoga' }]);
	});

	it('returns an empty array for a tab with only headers', () => {
		expect(rowsToObjects([['name', 'tone']])).toEqual([]);
	});

	it('returns an empty array for a completely empty tab', () => {
		expect(rowsToObjects([])).toEqual([]);
		expect(rowsToObjects(undefined)).toEqual([]);
	});

	it('keeps the row number so errors can name it', () => {
		const [first] = rowsToObjects([['name'], ['A']]);
		expect(first.__row).toBe(2);
	});
});
