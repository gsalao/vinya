import { readSettings } from '$lib/server/admin-db.js';

export async function load({ locals, url }) {
	if (url.pathname === '/admin/login') return { user: null, publish: null };
	const settings = await readSettings();
	return { user: { email: locals.user?.email ?? '' }, settings };
}
