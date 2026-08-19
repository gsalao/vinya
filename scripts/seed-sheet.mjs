#!/usr/bin/env node
// Run ONCE, to fill an empty spreadsheet from the committed content, so the
// owner never retypes what already exists. After this the spreadsheet is
// upstream: content.generated.json is regenerated FROM it, not the other way
// round. Running this again would overwrite anything she has typed since —
// see the warning printed at the end, which is the whole point of this file.
import { readFileSync } from 'node:fs';
import { writeTab } from './lib/sheets.mjs';
import { flatten } from './lib/flatten.mjs';

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

// The column order for a tab is read straight off flatten()'s own rows
// (every row of a tab has the same keys, in the same order, since flatten()
// builds them all through the same map/flatMap callback) rather than typed
// out again here, so the header row can never name a column flatten() does
// not actually produce.
const columnsOf = (rows) => Object.keys(rows[0]).filter((key) => key !== '__row');

for (const [tab, rows] of Object.entries(tabs)) {
	const columns = tab === 'copy' ? [...columnsOf(rows), 'where'] : columnsOf(rows);
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
