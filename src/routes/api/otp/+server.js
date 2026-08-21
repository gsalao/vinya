import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { generateCode, issueToken } from '$lib/server/otp.js';
import { isEmail } from '$lib/server/validate.js';
import { composeOtp } from '$lib/server/compose.js';
import { sendMail, mailReady } from '$lib/server/mail.js';
import { createSharedLimiter } from '$lib/server/ratelimit-shared.js';
import { admin } from '$lib/server/admin-db.js';

// Counted in Postgres, not in this instance's memory. This endpoint spends the
// studio's own mail quota, and enough abuse gets the sending account suspended
// — which takes bookings down with it. A per-instance counter gave a caller a
// multiple of these numbers depending on how many instances happened to be warm.
const perIp = createSharedLimiter({ max: 5, windowMs: 15 * 60 * 1000, prefix: 'otp-ip', client: admin });
const perEmail = createSharedLimiter({ max: 3, windowMs: 15 * 60 * 1000, prefix: 'otp-email', client: admin });

/** One shape for every rejection. Telling a caller which check failed hands them
 *  a way to probe the endpoint, and none of it helps a real visitor. */
const refuse = () => json({ error: 'Could not send a code just now. Please try again shortly.' }, { status: 429 });

export async function POST({ request, getClientAddress }) {
	const reason = !env.OTP_SECRET
		? 'OTP_SECRET is not set'
		: !mailReady()
			? 'mail settings are incomplete (MAIL_HOST, MAIL_USER, MAIL_PASS)'
			: null;
	if (reason) {
		console.error(`[otp] refusing: ${reason}`);
		// Same split as /api/booking: precise locally, generic in production.
		return json(
			{ error: dev ? `Not configured — ${reason}` : 'Booking is not configured on this site yet.' },
			{ status: 503 }
		);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Bad request.' }, { status: 400 });
	}

	// Honeypot: a real form leaves this empty because it is hidden. Answer as if
	// it worked, so a bot cannot tell it was caught, and send nothing.
	if (typeof body.website === 'string' && body.website.trim() !== '') {
		return json({ token: 'x', expiresAt: Date.now() + 600_000 });
	}

	const email = String(body.email ?? '').trim().toLowerCase();
	if (!isEmail(email)) return json({ error: 'That email address does not look right.' }, { status: 400 });

	if (!(await perIp.check(getClientAddress())).ok) return refuse();
	if (!(await perEmail.check(email)).ok) return refuse();

	const code = generateCode();
	const { token, expiresAt } = issueToken(email, code, env.OTP_SECRET);

	const { subject, text, html } = composeOtp(code);
	const sent = await sendMail({ to: email, subject, text, html });
	if (!sent.ok) return json({ error: 'We could not send the code. Please check the address and try again.' }, { status: 502 });

	return json({ token, expiresAt });
}
