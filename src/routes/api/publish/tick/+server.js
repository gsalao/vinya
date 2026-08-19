import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { admin } from '$lib/server/admin-db.js';

/** Fires the deploy once editing has gone quiet.
 *
 *  Called on a timer rather than from the browser, so the owner can save and
 *  close her laptop and the publish still happens. Called by the database's own
 *  scheduler, so the GitHub token stays in this server's environment and never
 *  enters the database — a database compromise cannot deploy.
 *
 *  Idempotent: it claims the pending state before dispatching, so two overlapping
 *  ticks produce one deploy.
 */
export async function POST({ request }) {
	const secret = env.PUBLISH_TICK_SECRET;
	if (!secret || request.headers.get('x-publish-secret') !== secret) {
		return json({ error: 'not allowed' }, { status: 401 });
	}

	const db = admin();
	if (!db) return json({ error: 'not configured' }, { status: 503 });

	const { data: state } = await db.from('publish_state').select('*').eq('id', 1).single();
	if (!state || state.status !== 'pending') return json({ fired: false, reason: 'nothing pending' });
	if (state.publish_after && new Date(state.publish_after) > new Date()) {
		return json({ fired: false, reason: 'still settling' });
	}

	// Claim it first. If the dispatch throws after this, the state says
	// "publishing" rather than "pending", so the next tick does not fire a second
	// deploy for the same edit.
	const { data: claimed } = await db
		.from('publish_state')
		.update({ status: 'publishing', message: 'Publishing your changes…', publish_after: null })
		.eq('id', 1)
		.eq('status', 'pending')
		.select();
	if (!claimed || claimed.length === 0) return json({ fired: false, reason: 'claimed by another tick' });

	const token = env.GH_DISPATCH_TOKEN;
	if (!token) {
		await db.from('publish_state').update({
			status: 'failed',
			message: 'Your changes are saved, but the site could not be updated. This is a technical problem — please contact your developer.'
		}).eq('id', 1);
		return json({ fired: false, reason: 'no token' }, { status: 503 });
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
		return json({ fired: false, status: res.status }, { status: 502 });
	}

	return json({ fired: true });
}
