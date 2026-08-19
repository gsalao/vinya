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

async function main() {
	const log = readFileSync('sync.log', 'utf8');
	const problems = extractProblems(log);

	if (problems.length === 0) {
		console.log('No itemised problems in sync.log. Not sending mail.');
		return;
	}

	const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, MAIL_TO } = process.env;
	if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !MAIL_TO) {
		console.warn('::warning::Mail is not configured for this job, so the failure was not emailed.');
		return;
	}

	const transport = nodemailer.createTransport({
		host: MAIL_HOST,
		port: Number(MAIL_PORT ?? 465),
		secure: Number(MAIL_PORT ?? 465) === 465,
		auth: { user: MAIL_USER, pass: MAIL_PASS }
	});

	await transport.sendMail({
		from: MAIL_FROM || MAIL_USER,
		to: MAIL_TO,
		subject: 'Vinya website: your change was not published',
		text: buildMailBody(problems)
	});

	console.log(`Emailed ${problems.length} problem(s) to the owner.`);
}

// Runs the send when this file is executed directly (`node scripts/notify-failure.mjs`),
// but not when another module — this file's own test — imports it just to reach
// extractProblems() and buildMailBody(). Same guard, same reasoning, as
// sync-content.mjs and report-status.mjs.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	await main();
}
