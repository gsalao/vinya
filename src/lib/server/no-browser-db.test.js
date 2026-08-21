import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The anon key is public: it ships in the bundle by design. So any Supabase
 *  client constructed in browser-reachable code is a database endpoint the
 *  whole internet can call, outside every rate limit the app applies.
 *
 *  That is exactly how newsletter signups worked once — an unbounded insert
 *  straight to PostgREST that no server code could see. This asserts that only
 *  server-only modules ever hold a client, so the same hole cannot be reopened
 *  by a later convenience import. */

const SERVER_ONLY = (path) =>
	path.includes('/lib/server/') || path.endsWith('.server.js') || path.endsWith('/hooks.server.js');

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (/\.(js|svelte)$/.test(path) && !path.endsWith('.test.js')) out.push(path);
	}
	return out;
}

describe('database access', () => {
	const files = walk('src');

	it('finds source files to check', () => {
		expect(files.length).toBeGreaterThan(20);
	});

	it('is never constructed in browser-reachable code', () => {
		const leaks = files
			.filter((path) => !SERVER_ONLY(path))
			.filter((path) => /@supabase\/(supabase-js|ssr)/.test(readFileSync(path, 'utf8')));

		expect(leaks).toEqual([]);
	});

	it('keeps the service-role key out of anything the browser can reach', () => {
		const leaks = files
			.filter((path) => !SERVER_ONLY(path))
			.filter((path) => /SERVICE_ROLE/.test(readFileSync(path, 'utf8')));

		expect(leaks).toEqual([]);
	});
});
