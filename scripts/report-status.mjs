#!/usr/bin/env node
// Writes one line into the spreadsheet's Status tab. Called from the workflow on
// both success and failure, so the owner sees the outcome where she is already
// looking rather than in an inbox or a GitHub log she has never opened.
import { pathToFileURL } from 'node:url';
import { setPublishState } from './lib/db.mjs';

/** Formats the publish banner's one line: an Amsterdam-local timestamp — that is
 *  where the person reading it is — followed by an em dash and the message.
 *  Pure and exported so the formatting is proved directly rather than only
 *  through a live write to a real spreadsheet. */
export function formatStatusLine(text, date = new Date()) {
	const stamp = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Amsterdam',
		day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
	}).format(date);
	return `${stamp} — ${text}`;
}

// Exported (rather than left private) so the try/catch below — "a failed
// status write must never fail the workflow", the single most-repeated
// requirement across these briefs — has a direct regression test instead of
// only being correct by inspection.
export async function main() {
	const text = process.argv[2];
	if (!text) {
		console.error('usage: report-status.mjs "<text>"');
		process.exit(2);
	}

	const line = formatStatusLine(text);

	// Never fail the workflow over a status write. A deploy that succeeded but
	// could not report itself is still a deploy that succeeded.
	try {
		await setPublishState({ status: process.argv[3] ?? 'idle', message: line });
		console.log(`Status: ${line}`);
	} catch (error) {
		console.error(`::warning::Could not write the publish banner: ${error.message}`);
	}
}

// Runs the write when this file is executed directly (`node scripts/report-status.mjs
// "<text>"`), but not when another module — this file's own test — imports it just
// to reach formatStatusLine(). Same guard, same reasoning, as sync-content.mjs.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
	await main();
}
