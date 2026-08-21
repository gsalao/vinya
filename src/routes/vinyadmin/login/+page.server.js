import { fail, redirect } from '@sveltejs/kit';
import { isAllowed, admin } from '$lib/server/admin-db.js';
import { createSharedLimiter } from '$lib/server/ratelimit-shared.js';
import { ADMIN_BASE } from '$lib/admin/paths.js';

/** Sign-in was the one unauthenticated door with no counting on it, so a loop
 *  could guess passwords indefinitely — and, because the allow-list is read
 *  from the database on every attempt, bill a query for each guess.
 *
 *  The ceilings are set where a person who has genuinely forgotten their
 *  password never meets them, and a guessing loop dies immediately: eight tries
 *  a quarter-hour is under a thousand a day, which is useless against any real
 *  password. Counting is per address as well as per network, so a botnet cannot
 *  spread guesses at one account across many IPs. */
const perIp = createSharedLimiter({ max: 15, windowMs: 15 * 60 * 1000, prefix: 'login-ip', client: admin });
const perEmail = createSharedLimiter({ max: 8, windowMs: 15 * 60 * 1000, prefix: 'login-email', client: admin });

const TOO_MANY = 'Too many sign-in attempts. Please wait a few minutes and try again.';

export async function load({ locals }) {
	if (await locals.getUser()) throw redirect(303, `${ADMIN_BASE}/home`);
	return {};
}

export const actions = {
	default: async ({ request, locals, getClientAddress }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!locals.supabase) return fail(503, { error: 'This site is not connected to its content store yet.' });

		// Counted before the allow-list is read, so a refused attempt costs one
		// query rather than two, and before the password is checked, so exhausting
		// the window cannot be used to tell a real address from an unknown one.
		if (!(await perIp.check(getClientAddress())).ok) return fail(429, { error: TOO_MANY, email });
		if (email && !(await perEmail.check(email)).ok) return fail(429, { error: TOO_MANY, email });

		// Checked before authenticating, so an account that exists in Supabase but
		// is not an allow-listed editor never gets a session at all.
		const allowed = await isAllowed(email);
		if (!allowed.ok) {
			const error =
				allowed.reason === 'unconfigured'
					? 'This editor is not set up yet. Please contact your developer.'
					: allowed.reason === 'blank'
						? 'Please enter your email address.'
						: 'That email cannot sign in here.';
			return fail(401, { error, email });
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		// One wording for both wrong-password and no-such-user: which of the two it
		// was is nobody's business but the account holder's.
		if (error) return fail(401, { error: 'That email and password do not match.', email });

		throw redirect(303, `${ADMIN_BASE}/home`);
	}
};
