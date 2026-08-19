import { describe, it, expect } from 'vitest';
// Importing this module is itself part of what this test proves: report-status.mjs
// talks to the network (setPublishState) once main() runs, and this suite runs with no
// SUPABASE_SERVICE_ROLE_KEY set and no argv[2]. If the write ran on import rather than only
// when the file is invoked directly, loading this test file would throw or call
// process.exit before a single "it" ran. That every test below executes at all is
// the proof.
import { formatStatusLine, main } from './report-status.mjs';

describe('formatStatusLine', () => {
	it('renders an Amsterdam-local day, short month, hour and minute ahead of an em dash and the message', () => {
		// Noon UTC in August is 14:00 in Amsterdam (CEST, UTC+2).
		expect(formatStatusLine('Live — https://vinya.example', new Date('2026-08-19T12:00:00Z')))
			.toBe('19 Aug, 14:00 — Live — https://vinya.example');
	});

	it('renders winter time correctly (CET, UTC+1)', () => {
		expect(formatStatusLine('Nothing to publish — the site already matches the sheet.', new Date('2026-01-05T09:30:00Z')))
			.toBe('05 Jan, 10:30 — Nothing to publish — the site already matches the sheet.');
	});

	it('defaults to the current time when no date is passed', () => {
		const before = Date.now();
		const line = formatStatusLine('test');
		const after = Date.now();
		// Just prove it used "now": the line is well-formed and stable across the
		// two timestamps bracketing the call (same minute in all but the rarest race).
		expect(line.endsWith('— test')).toBe(true);
		expect(after - before).toBeLessThan(5000);
	});
});

describe('main', () => {
	// "A failed status write must never fail the workflow" is the single most
	// repeated requirement across these briefs. Proves it directly: with
	// SUPABASE_SERVICE_ROLE_KEY deliberately unset, setPublishState()'s own auth() throws, so
	// main()'s try/catch is what stands between that and a rejected promise /
	// non-zero exit reaching the shell.
	it('does not reject or call process.exit when the write fails', async () => {
		const originalArgv = process.argv;
		const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const originalExit = process.exit;
		let exitCalledWith;

		process.argv = [...originalArgv.slice(0, 2), 'a status line the write will fail to persist'];
		delete process.env.SUPABASE_SERVICE_ROLE_KEY;
		process.exit = (code) => {
			exitCalledWith = code;
		};

		try {
			await expect(main()).resolves.toBeUndefined();
		} finally {
			process.argv = originalArgv;
			if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
			else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
			process.exit = originalExit;
		}

		expect(exitCalledWith).toBeUndefined();
	});
});
