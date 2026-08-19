#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readTabs } from './lib/sheets.mjs';
import { validate, REQUIRED } from './lib/schema.mjs';
import { shape } from './lib/shape.mjs';

// REQUIRED is schema.mjs's own authority on which tabs the spreadsheet has —
// reading the tab list off it, rather than hand-typing a second copy here,
// means the next new tab only has to be added in one place. It was added
// correctly here for pastEvents by hand once already; this removes the next
// chance to forget.
const TABS = Object.keys(REQUIRED);

const OUT = new URL('../src/lib/content.generated.json', import.meta.url);
const STATIC = new URL('../static', import.meta.url);

/** Every image path the content references must exist in static/. The schema
 *  cannot check this — it is pure and has no filesystem — but a broken image is
 *  exactly the kind of silent failure this pipeline exists to prevent.
 *
 *  Exported so it can be unit-tested directly against the real static/
 *  directory and the real committed content, rather than re-proved with a
 *  second, hand-copied implementation in a shell one-liner. See
 *  sync-content.test.js. */
export function missingFiles(content) {
	const paths = new Set();
	for (const t of content.teachers) {
		paths.add(t.photo.src);
		for (const set of [t.photo.srcset, t.photo.srcsetWebp]) {
			for (const entry of set.split(',')) paths.add(entry.trim().split(' ')[0]);
		}
	}
	for (const p of content.partners) paths.add(p.logo);
	return [...paths].filter((p) => !existsSync(new URL(`.${p}`, STATIC + '/')));
}

function report(errors) {
	console.error(`\nContent was not published. ${errors.length} problem${errors.length === 1 ? '' : 's'} to fix:\n`);
	for (const e of errors) {
		const where = e.row ? `${e.tab} tab, row ${e.row}` : `${e.tab} tab`;
		console.error(`  • ${where}: ${e.message}`);
		// Surfaces each one on the workflow's own summary page too.
		console.error(`::error title=${where}::${e.message}`);
	}
	console.error('\nNothing was deployed. The site is still showing the last version that passed.\n');
}

/** Reads, validates, shapes, checks images, writes, reports. Everything this
 *  function decides was decided in Tasks 8 and 9 (schema.mjs, shape.mjs) — it
 *  only sequences their results and turns a failure into text a non-technical
 *  owner can act on.
 *
 *  Deliberately not run at module load: it is called only from the
 *  invoked-directly guard at the bottom of this file, so importing this
 *  module — as its own test does, to reach missingFiles() — never touches
 *  the network or the filesystem beyond what that import itself needs. */
async function main() {
	let tabs;
	try {
		tabs = await readTabs(TABS);
	} catch (err) {
		// A setup problem — no credentials, an invalid key, a wrong sheet id —
		// not a content problem, so there is no tab or row to point report() at.
		// Still exactly one line to stderr and one workflow annotation, never a
		// stack trace: whoever reads this is fixing a repository secret, not
		// debugging Node.
		const message = err?.message ?? String(err);
		console.error(`\n${message}\n`);
		console.error(`::error::${message}`);
		process.exit(1);
	}

	const errors = validate(tabs);
	if (errors.length > 0) {
		report(errors);
		process.exit(1);
	}

	const content = shape(tabs);

	const missing = missingFiles(content);
	if (missing.length > 0) {
		report(missing.map((p) => ({
			tab: 'teachers or partners',
			row: null,
			message: `the image "${p}" is referenced but does not exist on the site. Check the spelling, or ask the developer to add the file.`
		})));
		process.exit(1);
	}

	// Trailing newline and two-space indent match what an editor would write, so the
	// committed diff stays readable rather than being one enormous line.
	const next = JSON.stringify(content, null, 2) + '\n';
	const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';

	if (next === current) {
		console.log('Content is already up to date. Nothing to deploy.');
		console.log('SYNC_RESULT=unchanged');
		process.exit(0);
	}

	writeFileSync(OUT, next);
	console.log('Content updated.');
	console.log('SYNC_RESULT=changed');
}

// Runs the sync when this file is executed directly (`node scripts/sync-content.mjs`,
// or via the `content:sync` package script), but not when another module — this
// file's own test — imports it just to reach missingFiles().
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	await main();
}
