import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { admin } from '$lib/server/admin-db.js';
import { triggerPublish } from '$lib/server/publish.js';

/** The safety net, not the normal path.
 *
 *  Saving fires its own dispatch in the same request, so this exists only for a
 *  publish that was owed and never went out — a save that lost its connection
 *  mid-request, or one that arrived while a deploy was running and was queued
 *  behind it.
 */
export async function POST({ request }) {
	const secret = env.PUBLISH_TICK_SECRET;
	if (!secret || request.headers.get('x-publish-secret') !== secret) {
		return json({ error: 'not allowed' }, { status: 401 });
	}

	const db = admin();
	if (!db) return json({ error: 'not configured' }, { status: 503 });

	const { data: state } = await db.from('publish_state').select('*').eq('id', 1).single();
	if (!state) return json({ fired: false, reason: 'no state' });

	const owed = state.status === 'pending' || (state.dirty && state.status !== 'publishing');
	if (!owed) return json({ fired: false, reason: 'nothing owed' });

	return json(await triggerPublish());
}
