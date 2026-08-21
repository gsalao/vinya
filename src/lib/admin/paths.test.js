import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_BASE, adminPath } from './paths.js';

/** SvelteKit takes the editor's URL from the route directory's name, while the
 *  guard in hooks.server.js takes it from ADMIN_BASE. Nothing makes them agree.
 *
 *  They fail asymmetrically, which is what makes this worth a test: a stale
 *  link merely 404s and someone notices, but a guard pointed at a path that no
 *  longer exists leaves the real editor unauthenticated and looks completely
 *  normal from the outside. */

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (/\.(js|svelte)$/.test(path) && !path.endsWith('.test.js')) out.push(path);
	}
	return out;
}

describe('ADMIN_BASE', () => {
	it('names a route directory that actually exists', () => {
		expect(existsSync(join('src/routes', ADMIN_BASE))).toBe(true);
	});

	it('is the prefix the request guard checks', () => {
		const hooks = readFileSync('src/hooks.server.js', 'utf8');
		expect(hooks).toMatch(/ADMIN_BASE/);
		// A bare literal here would keep working right up until the directory is
		// renamed, and then silently stop guarding anything.
		expect(hooks).not.toMatch(/startsWith\(['"`]\//);
	});

	it('leaves no route directory at the old, widely-scanned path', () => {
		expect(existsSync('src/routes/admin')).toBe(false);
	});

	it('builds child paths', () => {
		expect(adminPath('home')).toBe(`${ADMIN_BASE}/home`);
		expect(adminPath()).toBe(ADMIN_BASE);
	});

	it('is not hardcoded anywhere in the source', () => {
		const offenders = walk('src').filter((path) => {
			const src = readFileSync(path, 'utf8');
			// $lib/admin/... are import specifiers, and /api/admin is a separate
			// route that obscurity buys nothing for — it is already 401-gated.
			const stripped = src.replace(/\$lib\/admin/g, '').replace(/\/api\/admin/g, '');
			return /['"`]\/admin(\/|['"`])/.test(stripped);
		});
		expect(offenders).toEqual([]);
	});
});
