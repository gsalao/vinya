import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { issueToken, verifyToken, generateCode } from './otp.js';

const SECRET = 'test-secret-at-least-32-bytes-long-xxxxx';

describe('generateCode', () => {
	it('is always six digits', () => {
		for (let i = 0; i < 500; i++) expect(generateCode()).toMatch(/^\d{6}$/);
	});

	it('does not collapse to a small set of values', () => {
		const seen = new Set();
		for (let i = 0; i < 500; i++) seen.add(generateCode());
		expect(seen.size).toBeGreaterThan(400);
	});
});

describe('issueToken', () => {
	it('never embeds the code, in any encoding', () => {
		const code = '482913';
		const { token } = issueToken('a@b.com', code, SECRET);
		expect(token).not.toContain(code);
		// The payload is base64url and readable by anyone holding the token, so
		// the code must not survive a decode either.
		const decoded = Buffer.from(token.split('.')[0], 'base64url').toString();
		expect(decoded).not.toContain(code);
	});

	it('exposes the email and an expiry, which are not secret', () => {
		const { token } = issueToken('a@b.com', '111111', SECRET);
		const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
		expect(payload.email).toBe('a@b.com');
		expect(payload.exp).toBeGreaterThan(Date.now());
	});

	it('produces a different signature for a different code', () => {
		const a = issueToken('a@b.com', '111111', SECRET).token;
		const b = issueToken('a@b.com', '222222', SECRET).token;
		expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
	});
});

describe('verifyToken', () => {
	it('accepts the code it was issued for', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		expect(verifyToken(token, '482913', 'a@b.com', SECRET)).toEqual({ ok: true });
	});

	it('rejects a wrong code', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		expect(verifyToken(token, '482914', 'a@b.com', SECRET).ok).toBe(false);
	});

	it('rejects a different secret, so a leaked token is useless elsewhere', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		expect(verifyToken(token, '482913', 'a@b.com', 'other-secret-32-bytes-mininmum-xx').ok).toBe(false);
	});

	// The whole point of binding the email: without this check, a token issued to
	// an address the attacker owns would verify a booking under someone else's.
	it('rejects when the submitted email differs from the one in the token', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		expect(verifyToken(token, '482913', 'attacker@evil.com', SECRET).ok).toBe(false);
	});

	it('compares the email case-insensitively, as mailboxes are', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		expect(verifyToken(token, '482913', 'A@B.CoM', SECRET).ok).toBe(true);
	});

	it('rejects a payload edited to extend the expiry', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		const [payload, sig] = token.split('.');
		const edited = JSON.parse(Buffer.from(payload, 'base64url').toString());
		edited.exp = Date.now() + 10 ** 9;
		const forged = Buffer.from(JSON.stringify(edited)).toString('base64url') + '.' + sig;
		expect(verifyToken(forged, '482913', 'a@b.com', SECRET).ok).toBe(false);
	});

	it('rejects a payload edited to swap the email', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		const [payload, sig] = token.split('.');
		const edited = JSON.parse(Buffer.from(payload, 'base64url').toString());
		edited.email = 'attacker@evil.com';
		const forged = Buffer.from(JSON.stringify(edited)).toString('base64url') + '.' + sig;
		expect(verifyToken(forged, '482913', 'attacker@evil.com', SECRET).ok).toBe(false);
	});

	it('rejects malformed tokens instead of throwing', () => {
		for (const bad of ['', '.', 'a.b.c', 'nodot', '!!!.???', null, undefined]) {
			expect(() => verifyToken(bad, '482913', 'a@b.com', SECRET)).not.toThrow();
			expect(verifyToken(bad, '482913', 'a@b.com', SECRET).ok).toBe(false);
		}
	});

	it('rejects a missing or malformed code without throwing', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET);
		for (const bad of ['', null, undefined, '48291', 'abcdef', '4829134']) {
			expect(verifyToken(token, bad, 'a@b.com', SECRET).ok).toBe(false);
		}
	});
});

describe('verifyToken expiry', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('accepts just inside the window', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET, 600_000);
		vi.advanceTimersByTime(599_000);
		expect(verifyToken(token, '482913', 'a@b.com', SECRET).ok).toBe(true);
	});

	it('rejects once expired, and says so', () => {
		const { token } = issueToken('a@b.com', '482913', SECRET, 600_000);
		vi.advanceTimersByTime(600_001);
		const res = verifyToken(token, '482913', 'a@b.com', SECRET);
		expect(res.ok).toBe(false);
		expect(res.reason).toBe('expired');
	});
});
