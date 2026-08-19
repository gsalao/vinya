import { describe, it, expect } from 'vitest';
// Importing this module is itself part of what this test proves: notify-failure.mjs
// reads sync.log off disk and, if it finds a problem, sends mail once main() runs —
// and this suite runs with no sync.log on disk and no MAIL_* env set. If either ran
// on import rather than only when the file is invoked directly, loading this test
// file would throw before a single "it" ran. That every test below executes at all
// is the proof.
import { extractProblems, buildMailBody, buildGenericFailureBody, planMail, readSyncLog } from './notify-failure.mjs';

describe('extractProblems', () => {
	// This is the exact shape report() in sync-content.mjs writes: a header line,
	// one "  • " bullet per error interleaved with a "::error title=...::" workflow
	// annotation on the following line, and a trailing summary line. The regex must
	// pick out only the bullets, in order, and ignore everything else.
	const log = [
		'',
		'Content was not published. 2 problems to fix:',
		'',
		'  • events tab, row 2: month reads "2026-09-05" but must read like "September 2026"',
		'::error title=events tab, row 2::month reads "2026-09-05" but must read like "September 2026"',
		'  • teachers tab, row 3: name is blank',
		'::error title=teachers tab, row 3::name is blank',
		'',
		'Nothing was deployed. The site is still showing the last version that passed.',
		''
	].join('\n');

	it('pulls every bullet, in order, stripping the leading "  • "', () => {
		expect(extractProblems(log)).toEqual([
			'events tab, row 2: month reads "2026-09-05" but must read like "September 2026"',
			'teachers tab, row 3: name is blank'
		]);
	});

	it('ignores the ::error:: annotation lines and any other stderr noise', () => {
		for (const problem of extractProblems(log)) {
			expect(problem).not.toMatch(/^::error/);
		}
	});

	it('returns an empty array for a setup failure, which has no bullets at all', () => {
		// What sync-content.mjs prints when readTabs() itself throws (bad
		// GOOGLE_SA_KEY, wrong sheet id): one plain message, no "  • " bullet.
		const setupFailureLog = '\nGOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.\n::error::GOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.\n';
		expect(extractProblems(setupFailureLog)).toEqual([]);
	});

	it('returns an empty array for a clean log', () => {
		expect(extractProblems('Content is already up to date. Nothing to deploy.\nSYNC_RESULT=unchanged\n')).toEqual([]);
	});

	it('does not match a bullet indented by only one space or three', () => {
		const log = '  • two spaces: kept\n • one space: dropped\n   • three spaces: dropped\n';
		expect(extractProblems(log)).toEqual(['two spaces: kept']);
	});
});

describe('buildMailBody', () => {
	it('never mentions GitHub, a build or a workflow', () => {
		const body = buildMailBody(['events tab, row 2: month reads "2026-09-05" but must read like "September 2026"']);
		expect(body).not.toMatch(/GitHub|workflow|build/i);
	});

	it('singularises "problem" for exactly one item', () => {
		const body = buildMailBody(['events tab, row 2: bad month']);
		expect(body).toContain('Here is the problem:');
		expect(body).toContain('  • events tab, row 2: bad month');
	});

	it('pluralises and counts for more than one item', () => {
		const body = buildMailBody(['first problem', 'second problem']);
		expect(body).toContain('Here are the 2 problems:');
		expect(body).toContain('  • first problem');
		expect(body).toContain('  • second problem');
	});

	it('says the site is unchanged and names the same message the banner shows', () => {
		const body = buildMailBody(['x']);
		expect(body).toContain('The website has not changed');
		expect(body).toContain('The banner at the top of the editor shows the same message.');
	});
});

describe('buildGenericFailureBody', () => {
	// Used when the sync itself succeeded but something later in the job failed
	// (a commit conflict, a Vercel outage, a build break) — the catch-all reporter
	// added at the end of deploy.yml for that gap. There is no cell to point at
	// here, unlike buildMailBody(), so the wording must say so rather than imply
	// a sheet problem exists.
	it('never mentions GitHub, a build or a workflow', () => {
		expect(buildGenericFailureBody()).not.toMatch(/GitHub|workflow|build/i);
	});

	it('says her change was accepted and there is nothing in the sheet to fix', () => {
		const body = buildGenericFailureBody();
		expect(body).toContain('was accepted');
		expect(body).toContain('nothing for you to fix');
	});

	it('says the site is unchanged and names the same message the banner shows, like buildMailBody', () => {
		const body = buildGenericFailureBody();
		expect(body).toContain('The website has not changed');
		expect(body).toContain('The banner at the top of the editor shows the same message.');
	});

	it('routes her to the developer instead of a cell to edit', () => {
		expect(buildGenericFailureBody()).toContain('contact your developer');
	});
});

describe('buildGenericFailureBody("connection")', () => {
	// Used when sync-content.mjs's readTabs() throws before validate() ever runs
	// (bad/expired GOOGLE_SA_KEY, wrong VINYA_SHEET_ID, lost sheet access, a
	// Google API outage) — the class of failure that used to get no email at
	// all, because it produces no "  • " bullet for buildMailBody(). This is
	// the fix: planMail() routes it here instead of into silence.
	it('never mentions GitHub, a build or a workflow', () => {
		expect(buildGenericFailureBody('connection')).not.toMatch(/GitHub|workflow|build/i);
	});

	it('does not claim her change "was accepted" — it was never actually read', () => {
		expect(buildGenericFailureBody('connection')).not.toContain('was accepted');
	});

	it('says the problem is not anything she typed, and there is nothing for her to fix', () => {
		const body = buildGenericFailureBody('connection');
		expect(body).toContain('not anything you typed');
		expect(body).toContain('nothing for you to fix');
	});

	it('says the site is unchanged and names the same message the banner shows, like the other bodies', () => {
		const body = buildGenericFailureBody('connection');
		expect(body).toContain('The website has not changed');
		expect(body).toContain('The banner at the top of the editor shows the same message.');
	});

	it('routes her to the developer instead of a cell to edit', () => {
		expect(buildGenericFailureBody('connection')).toContain('contact your developer');
	});
});

describe('readSyncLog', () => {
	// A failure at or before "Install dependencies" in deploy.yml means the
	// "Sync content from the spreadsheet" step that writes sync.log never ran,
	// so the file does not exist. Before this fix, main() called readFileSync()
	// directly and threw ENOENT here, taking this reporter down with the same
	// failure it exists to report. This suite runs with no sync.log on disk
	// (see the file-level comment above), so this proves the fallback directly.
	it('returns an empty string rather than throwing when sync.log does not exist', () => {
		expect(readSyncLog()).toBe('');
	});
});

describe('planMail', () => {
	const logWithBullets = [
		'',
		'Content was not published. 1 problem to fix:',
		'',
		'  • events tab, row 2: month reads "2026-09-05" but must read like "September 2026"',
		'::error title=events tab, row 2::month reads "2026-09-05" but must read like "September 2026"',
		''
	].join('\n');

	// What sync-content.mjs prints when readTabs() itself throws: one plain
	// message, no "  • " bullet — see extractProblems's own "setup failure"
	// test above for the same fixture shape.
	const logWithNoBullets = '\nGOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.\n::error::GOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.\n';

	it('"--generic" always plans a deploy-reason mail with no problems, regardless of the log', () => {
		expect(planMail('--generic', logWithBullets)).toEqual({ reason: 'deploy', problems: [] });
		expect(planMail('--generic', '')).toEqual({ reason: 'deploy', problems: [] });
	});

	it('default mode with itemised bullets plans a "problems" mail carrying them', () => {
		expect(planMail(undefined, logWithBullets)).toEqual({
			reason: 'problems',
			problems: ['events tab, row 2: month reads "2026-09-05" but must read like "September 2026"']
		});
	});

	it('default mode with zero bullets plans a "connection" mail instead of silence', () => {
		// This is the bug this fix closes: previously nothing was planned or sent
		// for this case at all.
		expect(planMail(undefined, logWithNoBullets)).toEqual({ reason: 'connection', problems: [] });
	});
});
