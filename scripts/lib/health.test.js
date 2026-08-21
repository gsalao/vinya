import { describe, it, expect } from 'vitest';
import { assess, STUCK_PUBLISHING_MS, STALE_PENDING_MS, UNFIXED_FAILURE_MS } from './health.mjs';

const NOW = Date.parse('2026-09-01T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();

const healthy = {
	site: { ok: true, status: 200 },
	publish: { status: 'idle', updated_at: ago(60_000), dirty: false },
	storage: { bytes: 100 * 1024 * 1024, limitBytes: 1024 * 1024 * 1024, objects: 40 },
	now: NOW
};

const levels = (r) => r.findings.map((f) => f.level);
const titles = (r) => r.findings.map((f) => f.title);

describe('assess', () => {
	it('reports nothing when everything is fine', () => {
		const r = assess(healthy);
		expect(r.findings).toEqual([]);
		expect(r.ok).toBe(true);
	});

	it('treats an unreachable site as critical', () => {
		const r = assess({ ...healthy, site: { ok: false, status: 0, error: 'ETIMEDOUT' } });
		expect(levels(r)).toContain('critical');
		expect(r.findings[0].detail).toMatch(/ETIMEDOUT/);
		expect(r.ok).toBe(false);
	});

	it('treats a non-200 response as critical and names the code', () => {
		const r = assess({ ...healthy, site: { ok: false, status: 503 } });
		expect(r.findings[0].detail).toMatch(/503/);
	});

	// The one that silently stops all future publishing: triggerPublish() only
	// claims pending -> publishing, so a claim nobody released blocks every save.
	it('flags a publish stuck in publishing as critical', () => {
		const r = assess({
			...healthy,
			publish: { status: 'publishing', updated_at: ago(STUCK_PUBLISHING_MS + 60_000) }
		});
		expect(levels(r)).toContain('critical');
		expect(titles(r).join()).toMatch(/stuck/i);
	});

	it('leaves a publish that is merely still running alone', () => {
		const r = assess({
			...healthy,
			publish: { status: 'publishing', updated_at: ago(60_000) }
		});
		expect(r.findings).toEqual([]);
	});

	it('flags a pending publish the sweep never picked up', () => {
		const r = assess({
			...healthy,
			publish: { status: 'pending', updated_at: ago(STALE_PENDING_MS + 60_000) }
		});
		expect(levels(r)).toContain('warning');
		expect(titles(r).join()).toMatch(/never went out|pending/i);
	});

	// She is told at the time, in the editor and by mail. Repeating it to the
	// developer the same day is noise he learns to ignore.
	it('stays quiet about a fresh failure, which is hers to fix', () => {
		const r = assess({
			...healthy,
			publish: { status: 'failed', updated_at: ago(60_000), message: 'events, row 2 is wrong' }
		});
		expect(r.findings).toEqual([]);
	});

	it('speaks up once a failure has gone unfixed for a day', () => {
		const r = assess({
			...healthy,
			publish: {
				status: 'failed',
				updated_at: ago(UNFIXED_FAILURE_MS + 60_000),
				message: 'events, row 2: month reads "2026-09-05"'
			}
		});
		expect(levels(r)).toContain('warning');
		expect(r.findings[0].detail).toMatch(/2026-09-05/);
	});

	it('warns before storage fills, and escalates when it is nearly full', () => {
		const gb = 1024 * 1024 * 1024;
		const warn = assess({ ...healthy, storage: { bytes: 0.85 * gb, limitBytes: gb, objects: 900 } });
		expect(levels(warn)).toEqual(['warning']);

		const crit = assess({ ...healthy, storage: { bytes: 0.97 * gb, limitBytes: gb, objects: 990 } });
		expect(levels(crit)).toEqual(['critical']);
	});

	it('says how much room is left in plain units', () => {
		const gb = 1024 * 1024 * 1024;
		const r = assess({ ...healthy, storage: { bytes: 0.9 * gb, limitBytes: gb, objects: 5 } });
		expect(r.findings[0].detail).toMatch(/921\.6 MB of 1\.00 GB used across 5 files \(90%\)/);
	});

	it('collects every problem rather than stopping at the first', () => {
		const r = assess({
			...healthy,
			site: { ok: false, status: 500 },
			publish: { status: 'failed', updated_at: ago(UNFIXED_FAILURE_MS + 60_000), message: 'x' }
		});
		expect(r.findings).toHaveLength(2);
	});

	// Missing readings are not good news, and reporting them as healthy is how a
	// broken monitor looks identical to a healthy site.
	it('does not treat an unreadable check as passing', () => {
		const r = assess({ ...healthy, publish: null, storage: null });
		expect(levels(r)).toEqual(['warning', 'warning']);
		expect(titles(r).join()).toMatch(/could not be read/i);
	});
});
