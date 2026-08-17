import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL = 10 * 60 * 1000;

/** Six digits, from a CSPRNG. `Math.random` is predictable enough to be worth
 *  guessing when the prize is booking under someone else's address. */
export function generateCode() {
	return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

const b64 = (s) => Buffer.from(s).toString('base64url');

function sign(payload, code, secret) {
	return createHmac('sha256', secret).update(`${payload}.${code}`).digest('base64url');
}

/**
 * Bind an email and an expiry to a code without storing anything.
 *
 * The code is an *input to the signature*, never part of the token. Anyone
 * holding the token can decode the payload — that is fine, it is only the
 * address and a timestamp — but they cannot recover the code or forge a
 * signature for one, so the token alone proves nothing. The proof is knowing
 * the code, which only the inbox has.
 */
export function issueToken(email, code, secret, ttl = DEFAULT_TTL) {
	const exp = Date.now() + ttl;
	const payload = b64(JSON.stringify({ email: String(email).toLowerCase(), exp }));
	return { token: `${payload}.${sign(payload, code, secret)}`, expiresAt: exp };
}

/** Constant-time compare that tolerates unequal lengths, which timingSafeEqual
 *  throws on. */
function safeEqual(a, b) {
	const ba = Buffer.from(String(a));
	const bb = Buffer.from(String(b));
	if (ba.length !== bb.length) return false;
	return timingSafeEqual(ba, bb);
}

export function verifyToken(token, code, email, secret) {
	if (typeof token !== 'string' || typeof code !== 'string') return { ok: false, reason: 'malformed' };
	if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'malformed' };

	const parts = token.split('.');
	if (parts.length !== 2) return { ok: false, reason: 'malformed' };
	const [payload, signature] = parts;

	let claims;
	try {
		claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
	} catch {
		return { ok: false, reason: 'malformed' };
	}
	if (!claims || typeof claims.email !== 'string' || typeof claims.exp !== 'number') {
		return { ok: false, reason: 'malformed' };
	}

	// Signature first: everything below trusts the payload, and the payload is
	// only trustworthy once it is known not to have been edited.
	if (!safeEqual(signature, sign(payload, code, secret))) return { ok: false, reason: 'mismatch' };
	if (Date.now() > claims.exp) return { ok: false, reason: 'expired' };
	if (claims.email !== String(email ?? '').toLowerCase()) return { ok: false, reason: 'email' };

	return { ok: true };
}
