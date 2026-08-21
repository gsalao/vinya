/**
 * Decides whether the system is healthy, from readings taken elsewhere.
 *
 * Pure and I/O-free for the same reason schema.mjs is: every branch here
 * describes a failure that is invisible from the outside, so each one needs to
 * be provable against a fixture rather than by waiting for it to happen.
 *
 * Vercel already shows traffic, function logs and speed. What it cannot see is
 * anything about *this* system: whether a publish was claimed and never
 * released, whether the sweep is running, whether the image bucket is filling
 * up. Those are the failures that leave a site looking perfectly fine while
 * quietly refusing every future edit.
 */

/** triggerPublish() claims `pending -> publishing` conditionally, so a claim
 *  that is never released blocks every later publish. Nothing times it out. A
 *  real deploy is a few minutes; half an hour means the run died holding it. */
export const STUCK_PUBLISHING_MS = 30 * 60 * 1000;

/** The pg_cron sweep runs every five minutes, so anything still pending after
 *  twenty has been passed over four times. */
export const STALE_PENDING_MS = 20 * 60 * 1000;

/** A failed publish is usually the owner's own typo, and she already sees it in
 *  the editor and gets a mail about it. Telling the developer the same day adds
 *  nothing he can act on. Telling him a day later does: it means she did not
 *  fix it, and the site has been stale ever since. */
export const UNFIXED_FAILURE_MS = 24 * 60 * 60 * 1000;

export const STORAGE_WARN_AT = 0.8;
export const STORAGE_CRITICAL_AT = 0.95;

/** Switches unit at a gigabyte, so a 1 GB plan limit reads as "1 GB" rather
 *  than "1024.0 MB" — the number someone compares against their plan page. */
const size = (bytes) => {
	const mb = bytes / 1024 / 1024;
	return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
};
const minutes = (ms) => `${Math.round(ms / 60000)} minutes`;

export function assess({ site, publish, storage, now = Date.now() }) {
	const findings = [];
	const add = (level, title, detail, action) => findings.push({ level, title, detail, action });

	// ---------------------------------------------------------------- site ---
	if (!site?.ok) {
		add(
			'critical',
			'The site is not responding',
			site?.error ? `Request failed: ${site.error}` : `Responded with HTTP ${site?.status}.`,
			'Check Vercel for a failed deployment, then the domain and its certificate.'
		);
	}

	// ------------------------------------------------------------- publish ---
	if (!publish) {
		add(
			'warning',
			'Publish state could not be read',
			'The publish_state row was unreadable, so whether publishing works is unknown.',
			'Check SUPABASE_SERVICE_ROLE_KEY and that the project is not paused.'
		);
	} else {
		const age = now - Date.parse(publish.updated_at ?? 0);

		if (publish.status === 'publishing' && age > STUCK_PUBLISHING_MS) {
			add(
				'critical',
				'A publish is stuck, and is blocking every later one',
				`publish_state has read "publishing" for ${minutes(age)}. A publish is only ever claimed conditionally, so a claim that is never released means no save can publish again.`,
				'Find the failed run in GitHub Actions, then set publish_state.status to \'pending\' so the sweep retries.'
			);
		}

		if (publish.status === 'pending' && age > STALE_PENDING_MS) {
			add(
				'warning',
				'A publish is pending and never went out',
				`Owed for ${minutes(age)}, which is several sweeps missed.`,
				'Check `select * from cron.job`, and that PUBLISH_TICK_SECRET matches between Vercel and the scheduled job.'
			);
		}

		if (publish.status === 'failed' && age > UNFIXED_FAILURE_MS) {
			add(
				'warning',
				'A publish has been failed for over a day',
				`${publish.message || 'No message was recorded.'} (failed ${minutes(age)} ago)`,
				'She was told at the time and has not fixed it, so the site has been stale since. If the message names a row it is hers — ask. If not, it is yours.'
			);
		}
	}

	// ------------------------------------------------------------- storage ---
	if (!storage) {
		add(
			'warning',
			'Storage usage could not be read',
			'The image bucket could not be listed, so how full it is is unknown.',
			'Check the service-role key and that the site-images bucket still exists.'
		);
	} else {
		const used = storage.bytes / storage.limitBytes;
		const detail = `${size(storage.bytes)} of ${size(storage.limitBytes)} used across ${storage.objects} files (${Math.round(used * 100)}%).`;
		const action =
			'Delete images no longer referenced by the site, or raise the plan. A backup does not help here — a full bucket needs space, not a copy.';

		if (used >= STORAGE_CRITICAL_AT) {
			add('critical', 'Image storage is nearly full', detail, action);
		} else if (used >= STORAGE_WARN_AT) {
			add('warning', 'Image storage is filling up', detail, action);
		}
	}

	return { findings, ok: findings.length === 0, worst: worstLevel(findings) };
}

export function worstLevel(findings) {
	if (findings.some((f) => f.level === 'critical')) return 'critical';
	if (findings.length > 0) return 'warning';
	return 'ok';
}

/** The report, for a developer. Written to be readable in a GitHub job summary
 *  and in a plain-text mail without reformatting either. */
export function formatReport(result, { site } = {}) {
	if (result.ok) return `All checks passed${site ? ` for ${site}` : ''}.`;

	return [
		`${result.findings.length} problem(s) found${site ? ` for ${site}` : ''}:`,
		'',
		...result.findings.flatMap((f) => [
			`[${f.level.toUpperCase()}] ${f.title}`,
			`  ${f.detail}`,
			`  -> ${f.action}`,
			''
		]),
		'Full diagnosis: docs/runbook.md'
	].join('\n');
}
