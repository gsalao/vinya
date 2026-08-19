import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { verifyToken } from '$lib/server/otp.js';
import { isEmail, sniffAttachment, clamp, ATTACHMENT_MAX } from '$lib/server/validate.js';
import { composeBooking } from '$lib/server/compose.js';
import { sendMail, mailReady, ownerRecipients, ownerRecipientsLive, mailConfig } from '$lib/server/mail.js';
import { readSettings } from '$lib/server/admin-db.js';
import { createLimiter } from '$lib/server/ratelimit.js';
import { priceById } from '$lib/data.js';

const perIp = createLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

const FIELD_MAX = 200;

/** Visitors get one wording whatever is wrong, because which variable is unset
 *  is nobody's business. Locally the exact cause is returned instead, so the
 *  answer is where the developer is already looking rather than buried in a
 *  terminal behind the browser. */
function notConfigured(reason) {
	console.error(`[booking] refusing: ${reason}`);
	return json(
		{ error: dev ? `Not configured — ${reason}` : 'Booking is not configured on this site yet.' },
		{ status: 503 }
	);
}

export async function POST({ request, getClientAddress }) {
	if (!env.OTP_SECRET) return notConfigured('OTP_SECRET is not set');
	if (!mailReady()) return notConfigured('mail settings are incomplete (MAIL_HOST, MAIL_USER, MAIL_PASS)');
	const owners = await ownerRecipientsLive(readSettings);
	if (owners.length === 0) return notConfigured('MAIL_TO is empty, so nobody would receive this booking');
	if (!perIp.check(getClientAddress()).ok) {
		return json({ error: 'Too many attempts. Please try again shortly.' }, { status: 429 });
	}

	let form;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Bad request.' }, { status: 400 });
	}

	const email = String(form.get('email') ?? '').trim().toLowerCase();
	const code = String(form.get('code') ?? '').trim();
	const token = String(form.get('token') ?? '');

	if (!isEmail(email)) return json({ error: 'That email address does not look right.' }, { status: 400 });

	// Nothing below this line runs for a caller who has not proved they can read
	// mail at the address they are booking under.
	const check = verifyToken(token, code, email, env.OTP_SECRET);
	if (!check.ok) {
		const message =
			check.reason === 'expired'
				? 'That code has expired. Send a new one and try again.'
				: 'That code is not right. Please check and try again.';
		return json({ error: message, reason: check.reason }, { status: 401 });
	}

	const name = clamp(String(form.get('name') ?? '').trim(), FIELD_MAX);
	if (!name) return json({ error: 'Please add your name.' }, { status: 400 });

	let joining = [];
	let sessions = [];
	try {
		joining = JSON.parse(String(form.get('joining') ?? '[]'));
		sessions = JSON.parse(String(form.get('sessions') ?? '[]'));
	} catch {
		return json({ error: 'Bad request.' }, { status: 400 });
	}
	if (!Array.isArray(joining) || joining.length === 0) {
		return json({ error: 'Please choose what you would like to join.' }, { status: 400 });
	}
	joining = joining.slice(0, 20).map((s) => clamp(String(s), FIELD_MAX));
	sessions = Array.isArray(sessions) ? sessions.slice(0, 20).map((s) => clamp(String(s), 300)) : [];

	// Resolved from the price table rather than trusted from the form, so the
	// amount in the owner's mail is always the real listed price.
	const pass = priceById(String(form.get('pass') ?? '')) ?? null;
	const method = form.get('method') === 'cash' ? 'cash' : 'tikkie';
	const notes = String(form.get('notes') ?? '');

	const attachments = [];
	const receipt = form.get('receipt');
	if (receipt && typeof receipt === 'object' && typeof receipt.arrayBuffer === 'function' && receipt.size > 0) {
		if (receipt.size > ATTACHMENT_MAX) {
			return json({ error: 'That receipt is too large. Please keep it under 4 MB.' }, { status: 413 });
		}
		const buf = new Uint8Array(await receipt.arrayBuffer());
		const sniff = sniffAttachment(buf);
		if (!sniff.ok) {
			const message =
				sniff.reason === 'size'
					? 'That receipt is too large. Please keep it under 4 MB.'
					: 'That file type is not supported. Please attach a JPEG, PNG, WebP or PDF.';
			return json({ error: message }, { status: 400 });
		}
		// Filename is rebuilt, never taken from the upload: the client-supplied one
		// can carry path separators or a second extension.
		attachments.push({ filename: `receipt.${sniff.ext}`, content: Buffer.from(buf), contentType: sniff.mime });
	}

	const mail = composeBooking({
		name,
		email,
		joining,
		sessions,
		pass: pass ? { lbl: pass.lbl, amt: pass.amt } : null,
		method: pass ? method : null,
		hasReceipt: attachments.length > 0,
		notes
	});

	const sent = await sendMail({
		to: owners,
		cc: mailConfig().cc,
		subject: mail.subject,
		text: mail.text,
		html: mail.html,
		replyTo: mail.replyTo,
		attachments
	});
	if (!sent.ok) return json({ error: 'That did not go through. Please try again in a moment.' }, { status: 502 });

	return json({ ok: true });
}
