import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { flatten } from './flatten.mjs';
import { validate, REQUIRED, OPTIONAL_WHEN_EMPTY } from './schema.mjs';

// The real, committed content — the same file the whole site reads, and the
// same file seed-sheet.mjs will read. Using it rather than a hand-picked
// fixture means these tests exercise exactly what seeding a real spreadsheet
// would produce.
const CONTENT_PATH = fileURLToPath(new URL('../../src/lib/content.generated.json', import.meta.url));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8'));

// Three tabs carry one or two columns beyond what REQUIRED demands, because
// shape.mjs reads them even though schema.mjs allows them to be blank:
// events.remaining, partners.href/height, prices.feature. flatten() has to
// emit these too, or the round trip in shape.test.js could not reproduce
// content.generated.json byte-for-byte. Recorded here, once, so "exactly the
// required columns" can be asserted precisely instead of loosely.
const OPTIONAL_EXTRAS = { events: ['remaining'], partners: ['href', 'height'], prices: ['feature'] };

describe('flatten', () => {
	// pastEvents is the one tab schema.mjs allows to be empty (OPTIONAL_WHEN_EMPTY)
	// — a studio with no past events yet is a normal state, not a broken build.
	// Asserting length > 0 for it here would fail the day the owner deletes her
	// last past event and syncs, on a rule schema.mjs explicitly says isn't one.
	it('produces a non-empty array for every tab REQUIRED names, except the ones schema.mjs allows to be empty', () => {
		const tabs = flatten(content);
		for (const tab of Object.keys(REQUIRED)) {
			expect(Array.isArray(tabs[tab])).toBe(true);
			if (!OPTIONAL_WHEN_EMPTY.has(tab)) {
				expect(tabs[tab].length).toBeGreaterThan(0);
			}
		}
	});

	// The property that matters most: for tabs with no optional column, every
	// row's columns match REQUIRED exactly; for the three tabs above, they
	// match REQUIRED plus the documented extra(s) — never less (a seeded
	// spreadsheet would fail its first validation) and never an undocumented
	// more (a silent, untested extra column).
	it('emits exactly the columns schema.mjs requires for each tab, plus only the documented optional ones', () => {
		const tabs = flatten(content);
		for (const [tab, columns] of Object.entries(REQUIRED)) {
			const expected = new Set([...columns, ...(OPTIONAL_EXTRAS[tab] ?? [])]);
			for (const row of tabs[tab]) {
				const actual = new Set(Object.keys(row).filter((k) => k !== '__row'));
				expect(actual).toEqual(expected);
			}
		}
	});

	// This is the check Task 11's Step 8 would otherwise need a live
	// spreadsheet and a real sync run to make: that the rows flatten() writes
	// are rows the validator accepts. Proving it here, against the real
	// committed content, means a freshly seeded spreadsheet is provably valid
	// before it exists — no network, no credentials, runs on every commit.
	it('produces rows the validator accepts, with zero errors, from the real committed content', () => {
		expect(validate(flatten(content))).toEqual([]);
	});

	// __row starts at 2 (as if row 1 were a header) and increases monotonically
	// across the whole call — it has no relationship to where seed-sheet.mjs
	// will actually place a row, it only has to be a plausible, strictly
	// increasing number in case it ever reaches an error message.
	it('numbers rows starting at 2 and increasing, never repeating', () => {
		const tabs = flatten(content);
		const rows = Object.values(tabs).flat().map((r) => r.__row);
		expect(rows[0]).toBe(2);
		expect(rows).toEqual([...rows].sort((a, b) => a - b));
		expect(new Set(rows).size).toBe(rows.length);
	});
});
