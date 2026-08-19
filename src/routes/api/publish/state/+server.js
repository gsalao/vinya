import { json } from '@sveltejs/kit';
import { readPublishState } from '$lib/server/content-store.js';

/** Read-only, and only for a signed-in editor: publish state names deploy URLs
 *  and failure detail that visitors have no business seeing. */
export async function GET({ locals }) {
	const user = await locals.getUser();
	if (!user) return json({ status: 'idle', message: '' }, { status: 401 });
	const state = await readPublishState();
	return json({
		status: state?.status ?? 'idle',
		message: state?.message ?? '',
		url: state?.url ?? '',
		publishAfter: state?.publish_after ?? null,
		updatedAt: state?.updated_at ?? null
	});
}
