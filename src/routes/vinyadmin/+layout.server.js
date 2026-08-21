import { readSettings } from '$lib/server/admin-db.js';
import { ADMIN_BASE } from '$lib/admin/paths.js';

export async function load({ locals, url }) {
	if (url.pathname === `${ADMIN_BASE}/login`) return { user: null, publish: null };
	const settings = await readSettings();
	return { user: { email: locals.user?.email ?? '' }, settings };
}
