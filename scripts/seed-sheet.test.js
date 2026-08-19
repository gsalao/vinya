import { describe, it, expect } from 'vitest';
// Importing this module is itself part of what this test proves: seed-sheet.mjs
// talks to the network (tabNames, writeTab) once main() runs, and this suite
// runs with no GOOGLE_SA_KEY set. If seeding ran on import rather than only
// when the file is invoked directly, loading this test file would throw
// before a single "it" ran. That every test below executes at all is the proof.
import { columnsOf, missingTabs } from './seed-sheet.mjs';
import { REQUIRED } from './lib/schema.mjs';

describe('missingTabs', () => {
	it('names nothing when every wanted tab already exists', () => {
		expect(missingTabs(['a', 'b', 'c'], ['a', 'b'])).toEqual([]);
	});

	it('names exactly the tabs that are wanted but do not exist yet', () => {
		expect(missingTabs(['a', 'c'], ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
	});

	// The real failure this guards against: Task 10a added pastEvents to
	// REQUIRED after the spreadsheet-creation checklist had already gone out to
	// the project owner, so a spreadsheet built from that checklist has every
	// tab except this one.
	it('reports the real gap: a spreadsheet built from the checklist before pastEvents existed', () => {
		const oldChecklist = Object.keys(REQUIRED).filter((t) => t !== 'pastEvents');
		expect(missingTabs(oldChecklist, Object.keys(REQUIRED))).toEqual(['pastEvents']);
	});

	it('is case-sensitive, since spreadsheet tab names are', () => {
		expect(missingTabs(['Events'], ['events'])).toEqual(['events']);
	});
});

describe('columnsOf', () => {
	it("reads a tab's columns off its first row, excluding __row", () => {
		const rows = [{ date: '26 Jul', name: 'Breathwork Circle', status: 'Full', __row: 2 }];
		expect(columnsOf('pastEvents', rows)).toEqual(['date', 'name', 'status']);
	});

	// The case this exists for: an empty optional tab (only pastEvents, per
	// schema.mjs's OPTIONAL_WHEN_EMPTY) has no row to read a shape off, so the
	// header still has to come from somewhere — REQUIRED names it without
	// needing a data row to exist.
	it('falls back to REQUIRED for a tab flatten() left empty', () => {
		expect(columnsOf('pastEvents', [])).toEqual(REQUIRED.pastEvents);
	});
});
