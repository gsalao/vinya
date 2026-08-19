#!/usr/bin/env node
// Run ONCE, to fill an empty spreadsheet from the committed content, so the
// owner never retypes what already exists. After this the spreadsheet is
// upstream: content.generated.json is regenerated FROM it, not the other way
// round. Running this again would overwrite anything she has typed since —
// see the warning printed at the end, which is the whole point of this file.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { writeTab, tabNames } from './lib/sheets.mjs';
import { flatten } from './lib/flatten.mjs';
import { REQUIRED } from './lib/schema.mjs';

const content = JSON.parse(
	readFileSync(new URL('../src/lib/content.generated.json', import.meta.url), 'utf8')
);

// flatten() is shape.mjs's inverse (scripts/lib/flatten.mjs) — the same
// transform proved, byte-for-byte, against this exact file by
// scripts/lib/shape.test.js and scripts/lib/flatten.test.js. Building rows
// from it rather than re-deriving them here means this script cannot drift
// from what the sync pipeline actually expects to read back.
const tabs = flatten(content);

// A short human hint per copy key's prefix, so the copy tab can be navigated
// by someone who has never seen the site's source. This is the one column
// flatten() deliberately does not produce: shape() never reads it back, so it
// only belongs here, at write time.
const WHERE = {
	'home.': 'Home page',
	'about.': 'About page',
	'classes.': 'Classes page',
	'teachers.': 'Teachers page',
	'events.': 'Events page',
	'footer.': 'Footer, every page'
};
const whereFor = (key) => Object.entries(WHERE).find(([prefix]) => key.startsWith(prefix))?.[1] ?? '';

// The column order for a tab is read straight off flatten()'s own first row
// (every row of a tab has the same keys, in the same order, since flatten()
// builds them all through the same map/flatMap callback) rather than typed
// out again here, so the header row can never name a column flatten() does
// not actually produce. A tab flatten() left empty has no row to read a shape
// off — only pastEvents can be empty, per schema.mjs's OPTIONAL_WHEN_EMPTY —
// so its columns fall back to REQUIRED[tab], the same names schema.mjs itself
// would demand of a row on that tab if one existed. That still writes a
// correct header row for an empty optional tab; it just writes no data rows
// under it.
export const columnsOf = (tab, rows) =>
	rows.length > 0 ? Object.keys(rows[0]).filter((key) => key !== '__row') : REQUIRED[tab];

// Task 10a added pastEvents to REQUIRED after the spreadsheet-creation
// checklist had already been handed to the project owner. If she followed
// that checklist as given, her spreadsheet has five tabs, not six, and
// writing tab by tab without checking first would seed five successfully and
// then fail on the sixth — a partially seeded spreadsheet, against a script
// whose own closing banner tells her never to run it again. This is a pure
// set difference precisely so that failure mode can be proven against
// without a live spreadsheet: seed-sheet.test.js calls it directly.
export function missingTabs(existing, wanted) {
	const have = new Set(existing);
	return wanted.filter((tab) => !have.has(tab));
}

async function main() {
	const wanted = Object.keys(tabs);
	const existing = await tabNames();
	const missing = missingTabs(existing, wanted);
	if (missing.length > 0) {
		console.error(`
${'!'.repeat(72)}
!!  NOTHING WAS WRITTEN.
!!
!!  The spreadsheet is missing ${missing.length === 1 ? 'a tab' : `${missing.length} tabs`} this script needs before it
!!  can seed anything:
!!
${missing.map((t) => `!!    - ${t}`).join('\n')}
!!
!!  Add ${missing.length === 1 ? 'that tab' : 'those tabs'} to the spreadsheet, spelled exactly as above —
!!  tab names are case-sensitive. Nothing was changed. Run this again once
!!  ${missing.length === 1 ? "it's" : "they're"} added.
${'!'.repeat(72)}
`);
		process.exit(1);
	}

	for (const [tab, rows] of Object.entries(tabs)) {
		const columns = tab === 'copy' ? [...columnsOf(tab, rows), 'where'] : columnsOf(tab, rows);
		const body = rows.map((row) => columns.map((c) => (c === 'where' ? whereFor(row.key) : String(row[c] ?? ''))));
		await writeTab(tab, [columns, ...body]);
		console.log(`${tab}: ${body.length} rows`);
	}

	console.log(`
${'!'.repeat(72)}
!!  SEEDED. DO NOT RUN THIS SCRIPT AGAIN.
!!
!!  The spreadsheet is now upstream of the site: content.generated.json is
!!  regenerated FROM it, never the other way round. Running seed-sheet.mjs a
!!  second time would overwrite every edit the owner has made since today
!!  with this stale snapshot, silently and without warning.
${'!'.repeat(72)}
`);
}

// Runs the seed when this file is executed directly (`node scripts/seed-sheet.mjs`,
// or via the `content:seed` package script), but not when another module — this
// file's own test — imports it just to reach columnsOf() and missingTabs().
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	await main();
}
