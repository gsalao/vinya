import { describe, it, expect } from 'vitest';
import { rowsToObjects } from './sheets.mjs';

describe('rowsToObjects', () => {
	it('uses the first row as headers', () => {
		expect(rowsToObjects([['name', 'tone'], ['Kundalini Yoga', 'tan']]))
			.toEqual([{ name: 'Kundalini Yoga', tone: 'tan', __row: 2 }]);
	});

	// Sheets omits trailing empty cells entirely rather than padding the row, so a
	// row whose last column is blank comes back short.
	it('fills missing trailing cells with empty strings', () => {
		expect(rowsToObjects([['name', 'tone', 'blurb'], ['Kundalini Yoga', 'tan']]))
			.toEqual([{ name: 'Kundalini Yoga', tone: 'tan', blurb: '', __row: 2 }]);
	});

	// The owner will leave a gap between blocks of rows. That is formatting, not data.
	// __row must track the original row index, not the post-filter output position:
	// two blank rows (source rows 3 and 4) are skipped without shifting 'B' down to
	// __row 3 — it stays 5, the row the owner actually sees in the sheet.
	it('skips rows that are entirely empty', () => {
		expect(rowsToObjects([['name'], ['A'], ['   '], [''], ['B']]))
			.toEqual([{ name: 'A', __row: 2 }, { name: 'B', __row: 5 }]);
	});

	it('trims every cell', () => {
		expect(rowsToObjects([['  name  '], ['  Kundalini Yoga  ']]))
			.toEqual([{ name: 'Kundalini Yoga', __row: 2 }]);
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
