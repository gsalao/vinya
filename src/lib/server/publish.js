import { env } from '$env/dynamic/private';
import { admin } from './admin-db.js';

/** Starts a publish, or records that one is owed.
 *
 *  Saving is an explicit button press, so there is nothing to wait for: the
 *  dispatch goes out in the same request. The scheduled sweep still exists, but
 *  only as a safety net for a publish that was owed and never fired.
 *
 *  Two saves can overlap — a page has a Save button per section, and she may
 *  save one while the previous deploy is still running. That run may already
 *  have read the tables, so the second edit could be missed. Rather than fire a
 *  second deploy that would race the first, it marks the state dirty and the
 *  finishing run re-arms.
 *
 *  Never throws: a save that succeeded must not fail because the deploy trigger
 *  did. The sweep will pick it up.
 */
export async function triggerPublish() {
	const db = admin();
	if (!db) return { fired: false, reason: 'not configured' };

	try {
		const { data: state } = await db.from('publish_state').select('status').eq('id', 1).single();

		if (state?.status === 'publishing') {
			await db.from('publish_state').update({ dirty: true }).eq('id', 1);
			return { fired: false, reason: 'already publishing, queued' };
		}

		// Claim conditionally, so two saves arriving together produce one dispatch.
		const { data: claimed } = await db
			.from('publish_state')
			.update({
				status: 'publishing',
				message: 'Updating your site…',
				publish_after: null,
				dirty: false
			})
			.eq('id', 1)
			.neq('status', 'publishing')
			.select();
		if (!claimed || claimed.length === 0) {
			await db.from('publish_state').update({ dirty: true }).eq('id', 1);
			return { fired: false, reason: 'claimed by another save' };
		}

		const token = env.GH_DISPATCH_TOKEN;
		if (!token) {
			await db.from('publish_state').update({
				status: 'failed',
				message: 'Your changes are saved, but the site could not be updated. This is a technical problem — please contact your developer.'
			}).eq('id', 1);
			return { fired: false, reason: 'no token' };
		}

		const res = await fetch(`https://api.github.com/repos/${env.GH_REPO ?? 'gsalao/vinya'}/dispatches`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ event_type: 'content-update' })
		});

		if (res.status !== 204) {
			await db.from('publish_state').update({
				status: 'failed',
				message: `Your changes are saved, but the site could not be updated (error ${res.status}). This is a technical problem — please contact your developer.`
			}).eq('id', 1);
			return { fired: false, reason: `github ${res.status}` };
		}
		return { fired: true };
	} catch (error) {
		// Leave it pending so the sweep retries rather than losing the publish.
		try {
			await db.from('publish_state').update({ status: 'pending', dirty: true }).eq('id', 1);
		} catch { /* nothing more to try */ }
		return { fired: false, reason: error.message };
	}
}
