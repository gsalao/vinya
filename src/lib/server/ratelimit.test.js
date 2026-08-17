import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLimiter } from './ratelimit.js';

describe('createLimiter', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('allows up to the limit, then refuses', () => {
		const limit = createLimiter({ max: 3, windowMs: 60_000 });
		expect(limit.check('ip:1').ok).toBe(true);
		expect(limit.check('ip:1').ok).toBe(true);
		expect(limit.check('ip:1').ok).toBe(true);
		expect(limit.check('ip:1').ok).toBe(false);
	});

	it('keeps separate counts per key', () => {
		const limit = createLimiter({ max: 1, windowMs: 60_000 });
		expect(limit.check('ip:1').ok).toBe(true);
		expect(limit.check('ip:2').ok).toBe(true);
		expect(limit.check('ip:1').ok).toBe(false);
	});

	it('lets the caller through again once the window passes', () => {
		const limit = createLimiter({ max: 1, windowMs: 60_000 });
		expect(limit.check('ip:1').ok).toBe(true);
		vi.advanceTimersByTime(59_000);
		expect(limit.check('ip:1').ok).toBe(false);
		vi.advanceTimersByTime(2_000);
		expect(limit.check('ip:1').ok).toBe(true);
	});

	it('reports how long to wait, so the UI can show a countdown', () => {
		const limit = createLimiter({ max: 1, windowMs: 60_000 });
		limit.check('ip:1');
		const res = limit.check('ip:1');
		expect(res.ok).toBe(false);
		expect(res.retryAfterMs).toBeGreaterThan(0);
		expect(res.retryAfterMs).toBeLessThanOrEqual(60_000);
	});

	// A long-lived serverless instance would otherwise accumulate one entry per
	// address it has ever seen.
	it('drops entries that have aged out instead of growing forever', () => {
		const limit = createLimiter({ max: 1, windowMs: 1_000 });
		for (let i = 0; i < 500; i++) limit.check(`ip:${i}`);
		expect(limit.size()).toBe(500);
		vi.advanceTimersByTime(2_000);
		limit.check('ip:fresh');
		expect(limit.size()).toBeLessThan(10);
	});
});
