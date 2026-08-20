import { describe, it, expect } from 'vitest';
import { parsePeople, canRemove, canAdd } from './access.js';

describe('parsePeople', () => {
	it('reads a comma-separated list', () => {
		expect(parsePeople('a@b.com,c@d.com')).toEqual(['a@b.com', 'c@d.com']);
	});

	it('tolerates spacing and stray newlines a human might leave', () => {
		expect(parsePeople(' a@b.com ,\n  c@d.com,,')).toEqual(['a@b.com', 'c@d.com']);
	});

	// Sign-in lowercases the address it checks, so the stored list must match or a
	// capitalised entry would silently never let anyone in.
	it('lowercases, so capitalisation cannot lock someone out', () => {
		expect(parsePeople('Nikita@Vinya.NL')).toEqual(['nikita@vinya.nl']);
	});

	it('treats an empty setting as nobody', () => {
		expect(parsePeople('')).toEqual([]);
		expect(parsePeople(null)).toEqual([]);
	});
});

describe('canRemove', () => {
	it('allows removing someone else', () => {
		expect(canRemove(['a@b.com', 'c@d.com'], 'c@d.com')).toEqual({ ok: true });
	});

	// Leaving is a legitimate thing to do; the session ends with it.
	it('allows removing yourself when someone else remains', () => {
		expect(canRemove(['a@b.com', 'c@d.com'], 'a@b.com')).toEqual({ ok: true });
	});

	// An empty allow-list makes sign-in refuse everyone, and nothing in the admin
	// can undo it — recovery needs a developer editing the database.
	it('refuses to remove the only account', () => {
		expect(canRemove(['a@b.com'], 'a@b.com')).toEqual({ ok: false, reason: 'last-account' });
	});

	it('refuses someone who is not on the list', () => {
		expect(canRemove(['a@b.com', 'c@d.com'], 'x@y.com').ok).toBe(false);
	});

	it('matches regardless of how the address was typed', () => {
		expect(canRemove(['a@b.com', 'c@d.com'], '  C@D.com ')).toEqual({ ok: true });
	});
});

describe('canAdd', () => {
	it('allows a new address', () => {
		expect(canAdd(['a@b.com'], 'c@d.com')).toEqual({ ok: true });
	});

	it('refuses one already on the list, whatever its casing', () => {
		expect(canAdd(['a@b.com'], 'A@B.com')).toEqual({ ok: false, reason: 'already-listed' });
	});

	it('refuses a blank address', () => {
		expect(canAdd(['a@b.com'], '  ').ok).toBe(false);
	});
});
