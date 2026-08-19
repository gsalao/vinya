#!/usr/bin/env node
// Fills an empty database from the committed content, once. After this the
// database is upstream and this script must not be run again — it replaces each
// table wholesale and would overwrite whatever has been edited since.
//
// flatten() is the inverse of shape(), and a test in scripts/lib/shape.test.js
// asserts byte-for-byte that shape(flatten(content)) reproduces the committed
// file. Seeding through it means the rows written here are provably rows the
// validator accepts and the shaper reproduces.
import { readFileSync } from 'node:fs';
import { flatten } from './lib/flatten.mjs';
import { writeTable } from './lib/db.mjs';
import { REQUIRED } from './lib/schema.mjs';

const content = JSON.parse(
	readFileSync(new URL('../src/lib/content.generated.json', import.meta.url), 'utf8')
);
const tabs = flatten(content);

for (const tab of Object.keys(REQUIRED)) {
	const rows = tabs[tab] ?? [];
	await writeTable(tab, rows);
	console.log(`${tab}: ${rows.length} rows`);
}

console.log('\nSeeded. Do not run this again — the database is upstream from here.');
