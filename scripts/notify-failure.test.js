import { describe, it, expect } from 'vitest';
// Importing this module is itself part of what this test proves: notify-failure.mjs
// reads sync.log off disk and, if it finds a problem, sends mail once main() runs —
// and this suite runs with no sync.log on disk and no MAIL_* env set. If either ran
// on import rather than only when the file is invoked directly, loading this test
// file would throw before a single "it" ran. That every test below executes at all
// is the proof.
import { extractProblems, buildMailBody } from './notify-failure.mjs';

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

	it('says the site is unchanged and names the same message the Status tab shows', () => {
		const body = buildMailBody(['x']);
		expect(body).toContain('The website has not changed');
		expect(body).toContain('The Status tab of the sheet shows the same message.');
	});
});
