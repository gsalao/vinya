#!/usr/bin/env node
// Emails the owner whenever the job that publishes her sheet has failed —
// whether that is her content being rejected, the sync never managing to read
// the sheet at all, or something later in the pipeline breaking. Success is
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

/** The mail body for a failure that has nothing to do with what's in the
 *  sheet: she did nothing wrong and there is nothing in the sheet for her to
 *  fix. Shared by two different failure classes that read the same way to
 *  her — "the site is fine and unchanged, this isn't your doing" — and differ
 *  only in the one opening sentence `reason` picks:
 *
 *  - 'deploy' (the default): the sync itself succeeded — her change was read
 *    and accepted — but something later (the commit, the build, the deploy)
 *    failed. Unlike buildMailBody(), there is no cell to point at.
 *  - 'connection': the sync never got far enough to read the sheet at all —
 *    a bad or expired GOOGLE_SA_KEY, a wrong VINYA_SHEET_ID, lost sheet
 *    access, or a Google API outage inside readTabs(). Her change was never
 *    actually checked, so this wording does not claim it "was accepted".
 *
 *  Never GitHub, a build or a workflow. Pure and exported for the same
 *  reason as buildMailBody(). */
export function buildGenericFailureBody(reason = 'deploy') {
	const [opening, explain] =
		reason === 'connection'
			? [
					'Your latest change to the Vinya content sheet could not be checked.',
					'The website lost its connection to the sheet — a technical problem, not anything you typed. There is nothing for you to fix.'
				]
			: [
					'Your latest change to the Vinya content sheet was accepted.',
					'The website could not be updated because of a technical problem — not anything in the sheet. There is nothing for you to fix.'
				];

	return [
		opening,
		'',
		explain,
		'',
		'The website has not changed. It is still showing the last version that worked.',
		'',
		'Please contact your developer.',
		'',
		'The Status tab of the sheet shows the same message.'
	].join('\n');
}

/** Decides which mail to send and, for the default (non "--generic") mode,
 *  what to put in it — including the branch this fix adds: a default-mode run
 *  whose log has zero itemised bullets is not "nothing to report", it is
 *  `sync-content.mjs`'s `readTabs()` throwing before `validate()` ever runs
 *  (see buildGenericFailureBody's 'connection' case above). Pure and exported
 *  so that branch is proved without touching the filesystem or the network —
 *  main() is the only thing that reads sync.log or sends mail. */
export function planMail(mode, log) {
	if (mode === '--generic') return { reason: 'deploy', problems: [] };

	const problems = extractProblems(log);
	if (problems.length > 0) return { reason: 'problems', problems };

	return { reason: 'connection', problems: [] };
}

async function main() {
	// Two modes: the default reads sync.log and reports whatever the sync run
	// left there. "--generic" is used when the sync itself succeeded but a
	// later step in the job failed — there is no sync.log bullet to report,
	// only the fact that something went wrong on the publishing side. See the
	// "Report an unexpected failure to the sheet" workflow step.
	//
	// Either way this only ever runs after the job has already failed — both
	// "Email the owner..." steps in deploy.yml are gated on failure() — so
	// there is always something real to tell her about. planMail() picks which
	// of the three wordings fits; it is never "stay silent" any more.
	const mode = process.argv[2];
	const log = mode === '--generic' ? '' : readFileSync('sync.log', 'utf8');
	const { reason, problems } = planMail(mode, log);

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
		subject: reason === 'problems'
			? 'Vinya website: your change was not published'
			: 'Vinya website: a technical problem stopped your change from publishing',
		text: reason === 'problems' ? buildMailBody(problems) : buildGenericFailureBody(reason)
	});

	console.log(
		reason === 'problems'
			? `Emailed ${problems.length} problem(s) to the owner.`
			: `Emailed the owner about a non-sync failure (${reason}).`
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
