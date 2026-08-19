import { createServerClient } from '@supabase/ssr';
import { env as pub } from '$env/dynamic/public';
import { redirect } from '@sveltejs/kit';

/** Attaches a Supabase session to every request, and guards /admin.
 *
 *  The guard runs here rather than in a layout so that no admin route — page,
 *  form action or endpoint — can be added later that forgets to check. A route
 *  is protected by living under /admin, not by remembering to protect it. */
export async function handle({ event, resolve }) {
	const url = pub.PUBLIC_SUPABASE_URL;
	const key = pub.PUBLIC_SUPABASE_ANON_KEY;

	event.locals.supabase =
		url && key
			? createServerClient(url, key, {
					cookies: {
						getAll: () => event.cookies.getAll(),
						setAll: (all) =>
							all.forEach(({ name, value, options }) =>
								event.cookies.set(name, value, { ...options, path: '/' })
							)
					}
				})
			: null;

	event.locals.getUser = async () => {
		if (!event.locals.supabase) return null;
		const {
			data: { user }
		} = await event.locals.supabase.auth.getUser();
		return user ?? null;
	};

	const path = event.url.pathname;
	if (path.startsWith('/admin') && path !== '/admin/login') {
		const user = await event.locals.getUser();
		if (!user) throw redirect(303, '/admin/login');
		event.locals.user = user;
	}

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
}
