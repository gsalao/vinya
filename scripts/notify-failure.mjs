#!/usr/bin/env node
// Emails the owner when the spreadsheet's content was rejected. Success is
// visible in the sheet and does not need mail: a success message she learns to
// ignore is how a failure message gets ignored too.
//
// Builds its own transport from process.env rather than importing
// src/lib/server/mail.js: that module reads `$env/dynamic/private`, a virtual
// module only SvelteKit's Vite plugin can resolve. A plain `node
// scripts/notify-failure.mjs` run outside that build has no way to load it.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';

/** Pulls every "  • " bullet sync-content.mjs wrote to stderr. Same prefix,
 *  same contract the workflow's own `grep -m1 '^  • '` relies on for the
 *  first one — see report-status.mjs's failure step. Pure and exported so
 *  the extraction is proved against a fixture log rather than only a live
 *  run. */
export function extractProblems(log) {
	return [...log.matchAll(/^ {2}• (.+)$/gm)].map((m) => m[1]);
}

/** The mail body: what happened, what it means for the site, and what to do.
 *  Never GitHub, a build or a workflow — the reader has no way to act on
 *  those. Pure and exported so the wording is proved without sending mail. */
export function buildMailBody(problems) {
	return [
		'Your latest change to the Vinya content sheet was not published.',
		'',
		problems.length === 1 ? 'Here is the problem:' : `Here are the ${problems.length} problems:`,
		'',
		...problems.map((p) => `  • ${p}`),
		'',
		'The website has not changed. It is still showing the last version that worked.',
		'Fix the cells above and it will publish itself about thirty seconds later.',
		'',
		'The Status tab of the sheet shows the same message.'
	].join('\n');
}

/** The mail body for a failure that has nothing to do with her sheet edit —
 *  the sync itself succeeded, but something later (the commit, the build, the
 *  deploy) failed. Unlike buildMailBody(), there is no cell to point at: she
 *  did nothing wrong and there is nothing in the sheet for her to fix. Never
 *  GitHub, a build or a workflow. Pure and exported for the same reason as
 *  buildMailBody(). */
export function buildGenericFailureBody() {
	return [
		'Your latest change to the Vinya content sheet was accepted.',
		'',
		'The website could not be updated because of a technical problem — not anything in the sheet. There is nothing for you to fix.',
		'',
		'The website has not changed. It is still showing the last version that worked.',
		'',
		'Please contact your developer.',
		'',
		'The Status tab of the sheet shows the same message.'
	].join('\n');
}

async function main() {
	// Two modes: the default reads sync.log and reports the sheet's own itemised
	// problems (a content-validation failure). "--generic" is used when the sync
	// itself succeeded but a later step in the job failed — there is no sync.log
	// bullet to report, only the fact that something went wrong on the publishing
	// side. See the "Report an unexpected failure to the sheet" workflow step.
	const generic = process.argv[2] === '--generic';

	let problems = [];
	if (!generic) {
		const log = readFileSync('sync.log', 'utf8');
		problems = extractProblems(log);

		if (problems.length === 0) {
			console.log('No itemised problems in sync.log. Not sending mail.');
			return;
		}
	}

	const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, MAIL_TO } = process.env;
	if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !MAIL_TO) {
		console.warn('::warning::Mail is not configured for this job, so the failure was not emailed.');
		return;
	}

	// Matches src/lib/server/mail.js's own `Number(env.MAIL_PORT || 465)`: `||`
	// falls back to 465 for an empty-string secret, same as here. `??` would not
	// — it only falls back for null/undefined — and would silently produce
	// port 0 / secure:false on what is supposed to be a 465 connection.
	const port = Number(MAIL_PORT || 465);

	const transport = nodemailer.createTransport({
		host: MAIL_HOST,
		port,
		secure: port === 465,
		auth: { user: MAIL_USER, pass: MAIL_PASS }
	});

	await transport.sendMail({
		from: MAIL_FROM || MAIL_USER,
		to: MAIL_TO,
		subject: generic
			? 'Vinya website: a technical problem stopped your change from publishing'
			: 'Vinya website: your change was not published',
		text: generic ? buildGenericFailureBody() : buildMailBody(problems)
	});

	console.log(
		generic
			? 'Emailed the owner about a non-sync failure.'
			: `Emailed ${problems.length} problem(s) to the owner.`
	);
}

// Runs the send when this file is executed directly (`node scripts/notify-failure.mjs`),
// but not when another module — this file's own test — imports it just to reach
// extractProblems() and buildMailBody(). Same guard, same reasoning, as
// sync-content.mjs and report-status.mjs.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	await main();
}
