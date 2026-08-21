import { json } from '@sveltejs/kit';
import { isEmail } from '$lib/server/validate.js';
import { admin, adminReady } from '$lib/server/admin-db.js';
import { createSharedLimiter } from '$lib/server/ratelimit-shared.js';

/** Newsletter signups used to be written straight from the browser with the
 *  anon key. That key is public by design — it ships in the site's JavaScript —
 *  so anyone could POST to PostgREST in a loop and fill the table. Because that
 *  path never reached the app, no rate limit could see it.
 *
 *  Routing it through here puts every unauthenticated write behind the same
 *  counting as the rest of the site, and lets the anon insert policy be revoked
 *  (see supabase/security.sql). */
const perIp = createSharedLimiter({ max: 5, windowMs: 60 * 60 * 1000, prefix: 'sub-ip', client: admin });
const perEmail = createSharedLimiter({ max: 3, windowMs: 60 * 60 * 1000, prefix: 'sub-email', client: admin });

export async function POST({ request, getClientAddress }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Bad request.' }, { status: 400 });
	}

	// Honeypot, same as /api/otp: a real form leaves this empty because it is
	// hidden. Answer as if it worked so a bot cannot tell it was caught.
	if (typeof body.website === 'string' && body.website.trim() !== '') {
		return json({ ok: true });
	}

	const email = String(body.email ?? '').trim().toLowerCase();
	if (!isEmail(email)) return json({ ok: false, error: 'That email address does not look right.' }, { status: 400 });

	// Kept so the site still demonstrates itself without a backend, matching how
	// the booking form behaves.
	if (!adminReady()) return json({ ok: true, simulated: true });

	if (!(await perIp.check(getClientAddress())).ok || !(await perEmail.check(email)).ok) {
		return json({ ok: false, error: 'Too many attempts. Please try again later.' }, { status: 429 });
	}

	const db = admin();
	const { error } = await db.from('subscribers').insert({ email });

	// 23505 is a duplicate key: this address is already on the list. Saying so
	// would confirm membership to anyone who asks, so it reads as success — which
	// is also what it is, from the subscriber's point of view.
	if (error && error.code !== '23505') {
		console.error(`[subscribe] insert failed: ${error.message}`);
		return json({ ok: false, error: 'Something went wrong. Please try again.' }, { status: 502 });
	}

	return json({ ok: true });
}
