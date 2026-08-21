#!/usr/bin/env node
// Watches the things Vercel cannot see.
//
// Vercel reports traffic, function logs and speed — all real, none of it about
// this system. It cannot tell you that a publish was claimed and never
// released (which silently blocks every later one), that the sweep has stopped
// firing, or that the image bucket is filling up. Those failures leave the
// site looking perfectly healthy while it quietly refuses to change again.
//
// Runs daily from .github/workflows/health.yml. A non-zero exit turns the run
// red, and GitHub emails whoever watches the repository — so alerting works
// with no extra service and no extra credential. ALERT_TO adds a direct mail
// on top, for an address that is not the owner's: nothing found here is
// something she can act on.
import { pathToFileURL } from 'node:url';
import { appendFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { client } from './lib/db.mjs';
import { listAll, totalBytes } from './lib/storage.mjs';
import { assess, formatReport } from './lib/health.mjs';

const BUCKET = 'site-images';
const DEFAULT_LIMIT_MB = 1024; // Supabase free tier.

/** A HEAD would be cheaper but proves less: a CDN can answer one for a page
 *  whose render throws. Fetching the body and looking for something the layout
 *  always emits catches a site that is up and broken. */
export async function checkSite(url) {
	try {
		const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'vinya-health-check' } });
		const body = await res.text();
		if (!res.ok) return { ok: false, status: res.status };
		if (!/<\/html>/i.test(body)) {
			return { ok: false, status: res.status, error: 'responded 200 but the page was not complete HTML' };
		}
		return { ok: true, status: res.status };
	} catch (e) {
		return { ok: false, status: 0, error: e.message };
	}
}

async function readPublish(db) {
	try {
		const { data, error } = await db.from('publish_state').select('*').eq('id', 1).single();
		if (error) throw new Error(error.message);
		return data ?? null;
	} catch (e) {
		console.warn(`::warning::Could not read publish_state: ${e.message}`);
		return null;
	}
}

async function readStorage(db) {
	try {
		const files = await listAll(db, BUCKET);
		const limitMb = Number(process.env.STORAGE_LIMIT_MB || DEFAULT_LIMIT_MB);
		return { bytes: totalBytes(files), limitBytes: limitMb * 1024 * 1024, objects: files.length };
	} catch (e) {
		console.warn(`::warning::Could not read storage usage: ${e.message}`);
		return null;
	}
}

async function alert(subject, body) {
	const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM, ALERT_TO } = process.env;
	// Deliberately ALERT_TO and not MAIL_TO. MAIL_TO is where booking enquiries
	// go — the studio owner. None of these findings are hers to act on, and a
	// technical alert she cannot use teaches her to ignore mail from the site.
	if (!ALERT_TO) {
		console.log('ALERT_TO is not set, so no mail was sent. The failed run itself notifies whoever watches the repo.');
		return;
	}
	if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS) {
		console.warn('::warning::ALERT_TO is set but mail is not configured, so no mail was sent.');
		return;
	}
	const port = Number(MAIL_PORT || 465);
	const transport = nodemailer.createTransport({
		host: MAIL_HOST,
		port,
		secure: port === 465,
		auth: { user: MAIL_USER, pass: MAIL_PASS }
	});
	await transport.sendMail({ from: MAIL_FROM || MAIL_USER, to: ALERT_TO, subject, text: body });
	console.log(`Alerted ${ALERT_TO}.`);
}

async function main() {
	const site = process.env.SITE_URL;
	if (!site) {
		console.error('::error::SITE_URL is not set. Add it under Settings -> Secrets and variables -> Actions -> Variables.');
		process.exit(1);
	}

	const db = client();
	const [siteResult, publish, storage] = await Promise.all([checkSite(site), readPublish(db), readStorage(db)]);
	const result = assess({ site: siteResult, publish, storage });
	const report = formatReport(result, { site });

	console.log(report);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Health check\n\n\`\`\`\n${report}\n\`\`\`\n`);
	}

	if (result.ok) return;

	// continue-on-error is not set on the workflow step, so this failing is what
	// makes GitHub notify. The mail is an addition, never the only channel —
	// which is why a send that throws must not swallow the failure exit.
	await alert(`Vinya website: ${result.worst === 'critical' ? 'something is broken' : 'something needs attention'}`, report).catch(
		(e) => console.warn(`::warning::Alert mail failed: ${e.message}`)
	);
	process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();
