import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';

/** Split a comma-separated recipient list from the environment. */
const list = (v) =>
	String(v ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

export function mailConfig() {
	return {
		host: env.MAIL_HOST,
		port: Number(env.MAIL_PORT || 465),
		user: env.MAIL_USER,
		pass: env.MAIL_PASS,
		from: env.MAIL_FROM || env.MAIL_USER,
		to: list(env.MAIL_TO),
		cc: list(env.MAIL_CC)
	};
}

/** Echoing to the console is a local convenience only. Gating it on `dev` means
 *  a stray MAIL_DEV_ECHO in Vercel cannot silently swallow real bookings. */
export const devEcho = dev && env.MAIL_DEV_ECHO === '1';

export function mailReady() {
	if (devEcho) return true;
	const c = mailConfig();
	return Boolean(c.host && c.user && c.pass && c.from);
}

/** Owner recipients are required for a booking to go anywhere at all. */
export function ownerRecipients() {
	return mailConfig().to;
}

let transport;
function getTransport() {
	if (!transport) {
		const c = mailConfig();
		transport = nodemailer.createTransport({
			host: c.host,
			port: c.port,
			// 465 is implicit TLS; 587 upgrades with STARTTLS. Either way the
			// connection is encrypted before the password crosses it.
			secure: c.port === 465,
			auth: { user: c.user, pass: c.pass }
		});
	}
	return transport;
}

export async function sendMail({ to, cc, subject, text, html, replyTo, attachments }) {
	if (devEcho) {
		console.log('\n--- MAIL (dev echo, nothing sent) ---');
		console.log('to:', to, 'cc:', cc ?? '-', 'replyTo:', replyTo ?? '-');
		console.log('subject:', subject);
		console.log(text);
		if (attachments?.length) console.log('attachments:', attachments.map((a) => `${a.filename} (${a.content.length}b)`));
		console.log('--- END MAIL ---\n');
		return { ok: true, echoed: true };
	}

	const c = mailConfig();
	try {
		await getTransport().sendMail({
			from: c.from,
			to: Array.isArray(to) ? to.join(', ') : to,
			cc: cc?.length ? cc.join(', ') : undefined,
			replyTo,
			subject,
			text,
			html,
			attachments
		});
		return { ok: true };
	} catch (err) {
		// Logged server-side for the operator; the caller gets a generic message so
		// a bad address or a broken relay is not described back to the internet.
		console.error('[mail] send failed:', err?.message);
		return { ok: false };
	}
}
