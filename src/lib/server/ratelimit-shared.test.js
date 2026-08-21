import { describe, it, expect } from 'vitest';
import { createSharedLimiter } from './ratelimit-shared.js';

/** A stand-in for the Postgres function, so these tests need no database. */
function fakeDb({ allow = true, fail = false } = {}) {
	const calls = [];
	return {
		calls,
		client: () => ({
			rpc: async (fn, args) => {
				calls.push({ fn, args });
				if (fail) return { data: null, error: { message: 'boom' } };
				return { data: allow, error: null };
			}
		})
	};
}

describe('createSharedLimiter', () => {
	it('asks Postgres rather than counting locally', async () => {
		const db = fakeDb({ allow: true });
		const limiter = createSharedLimiter({
			max: 5,
			windowMs: 900_000,
			prefix: 'otp-ip',
			client: db.client
		});

		const res = await limiter.check('1.2.3.4');

		expect(res.ok).toBe(true);
		expect(res.shared).toBe(true);
		expect(db.calls).toHaveLength(1);
		expect(db.calls[0].fn).toBe('rate_limit_hit');
		expect(db.calls[0].args).toEqual({
			p_key: 'otp-ip:1.2.3.4',
			p_max: 5,
			p_window_seconds: 900
		});
	});

	it('refuses when Postgres says the window is spent', async () => {
		const db = fakeDb({ allow: false });
		const limiter = createSharedLimiter({ max: 5, windowMs: 900_000, prefix: 'otp-ip', client: db.client });
		expect((await limiter.check('1.2.3.4')).ok).toBe(false);
	});

	it('namespaces keys, so an IP limit cannot consume an email limit', async () => {
		const db = fakeDb();
		const ip = createSharedLimiter({ max: 5, windowMs: 1000, prefix: 'otp-ip', client: db.client });
		const email = createSharedLimiter({ max: 3, windowMs: 1000, prefix: 'otp-email', client: db.client });

		await ip.check('same');
		await email.check('same');

		expect(db.calls.map((c) => c.args.p_key)).toEqual(['otp-ip:same', 'otp-email:same']);
	});

	// The point of the fallback: a Supabase outage must not turn the OTP endpoint
	// into an open mail relay, nor take booking down entirely.
	it('falls back to in-memory counting when the database errors', async () => {
		const db = fakeDb({ fail: true });
		const limiter = createSharedLimiter({ max: 2, windowMs: 900_000, prefix: 'otp-ip', client: db.client });

		expect((await limiter.check('1.2.3.4')).ok).toBe(true);
		expect((await limiter.check('1.2.3.4')).ok).toBe(true);
		const third = await limiter.check('1.2.3.4');

		expect(third.ok).toBe(false);
		expect(third.shared).toBe(false);
	});

	it('falls back when Supabase is not configured at all', async () => {
		const limiter = createSharedLimiter({ max: 1, windowMs: 900_000, prefix: 'x', client: () => null });
		expect((await limiter.check('a')).ok).toBe(true);
		expect((await limiter.check('a')).ok).toBe(false);
	});
});
