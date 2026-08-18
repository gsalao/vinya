import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { KEYS } from './copy-manifest.js';
import content from './content.generated.json';

/** Every .svelte file under src/, recursively. */
function svelteFiles(dir, found = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) svelteFiles(path, found);
		else if (entry.name.endsWith('.svelte')) found.push(path);
	}
	return found;
}

/** txt('literal.key') is the only call form in this codebase. The {#each} loop
 *  form the plan originally imagined was abandoned in Task 2: Svelte 5 SSR wraps
 *  each-blocks in boundary comments, which changes the rendered bytes. */
function keysUsedIn(source) {
	const used = new Set();
	for (const [, key] of source.matchAll(/\btxt\('([^']+)'\)/g)) used.add(key);
	return used;
}

const used = new Set();
for (const file of svelteFiles('src')) {
	for (const key of keysUsedIn(readFileSync(file, 'utf8'))) used.add(key);
}

describe('copy manifest', () => {
	it('lists every key the markup asks for', () => {
		const missing = [...used].filter((k) => !KEYS.includes(k)).sort();
		expect(missing, 'used in markup but absent from the manifest').toEqual([]);
	});

	it('lists no key the markup never asks for', () => {
		const unused = KEYS.filter((k) => !used.has(k)).sort();
		expect(unused, 'in the manifest but never rendered').toEqual([]);
	});

	// This is the check the spreadsheet has to satisfy. Task 8 runs the same
	// comparison against sheet rows before any deploy.
	it('has content for every manifest key', () => {
		const absent = KEYS.filter((k) => content.copy[k] === undefined).sort();
		expect(absent, 'in the manifest but missing from content.generated.json').toEqual([]);
	});
});
