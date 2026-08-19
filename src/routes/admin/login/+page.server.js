import { fail, redirect } from '@sveltejs/kit';
import { isAllowed } from '$lib/server/admin-db.js';

export async function load({ locals }) {
	if (await locals.getUser()) throw redirect(303, '/admin/home');
	return {};
}

export const actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!locals.supabase) return fail(503, { error: 'This site is not connected to its content store yet.' });

		// Checked before authenticating, so an account that exists in Supabase but
		// is not an allow-listed editor never gets a session at all.
		if (!(await isAllowed(email))) {
			return fail(401, { error: 'That email cannot sign in here.', email });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		// One wording for both wrong-password and no-such-user: which of the two it
		// was is nobody's business but the account holder's.
		if (error) return fail(401, { error: 'That email and password do not match.', email });

		throw redirect(303, '/admin/home');
	}
};
