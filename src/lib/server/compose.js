import { headerSafe, clamp } from './validate.js';

const SUBJECT_MAX = 160;
const NOTES_MAX = 2000;
const esc = (s) =>
	String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Describe the payment in one line the owner can act on without opening the site.
 *
 * Derived from the choices, never free text, so the wording is identical every
 * time and "did they pay?" is answerable at a glance.
 */
function modeOfPayment({ pass, method, hasReceipt }) {
	if (!pass) return 'Existing pass — nothing due';
	if (method === 'cash') return `Cash on arrival (${pass.amt} due)`;
	return `Tikkie ${pass.amt} — ${pass.lbl} (${hasReceipt ? 'receipt attached' : 'no receipt'})`;
}

export function composeBooking({ name, email, sessions = [], joining = [], pass, method, hasReceipt, notes }) {
	const what = joining.map(headerSafe).filter(Boolean).join(', ');
	const subject = clamp(`[VINYA] ${what || 'Booking request'}`, SUBJECT_MAX - 1);

	const note = clamp(String(notes ?? '').trim(), NOTES_MAX);
	const lines = [
		`Name: ${headerSafe(name)}`,
		`Email: ${headerSafe(email)}`,
		`Mode of Payment: ${modeOfPayment({ pass, method, hasReceipt })}`,
		'',
		'Sessions:',
		...sessions.map((s) => `  ${headerSafe(s)}`)
	];
	if (note) lines.push('', 'Anything I should know:', ...note.split('\n').map((l) => `  ${l}`));
	lines.push('', '—', 'Sent from the Vinya booking form. Reply to reach them directly.');
	const text = lines.join('\n');

	const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;color:#2c1a10">
<table style="border-collapse:collapse">
<tr><td style="padding:2px 14px 2px 0;color:#6b5040">Name</td><td><strong>${esc(headerSafe(name))}</strong></td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#6b5040">Email</td><td><a href="mailto:${esc(headerSafe(email))}">${esc(headerSafe(email))}</a></td></tr>
<tr><td style="padding:2px 14px 2px 0;color:#6b5040">Mode of Payment</td><td><strong>${esc(modeOfPayment({ pass, method, hasReceipt }))}</strong></td></tr>
</table>
<p style="margin:18px 0 6px;color:#6b5040">Sessions</p>
<ul style="margin:0;padding-left:20px">${sessions.map((s) => `<li>${esc(headerSafe(s))}</li>`).join('')}</ul>
${note ? `<p style="margin:18px 0 6px;color:#6b5040">Anything I should know</p><p style="margin:0;white-space:pre-wrap">${esc(note)}</p>` : ''}
<p style="margin-top:22px;font-size:13px;color:#9c8a7a">Sent from the Vinya booking form. Reply to reach them directly.</p>
</div>`;

	return { subject, text, html, replyTo: headerSafe(email) };
}

export function composeOtp(code) {
	return {
		subject: `${code} is your Vinya confirmation code`,
		text: [
			`Your Vinya confirmation code is ${code}`,
			'',
			'Enter it on the booking form to send your request. It lasts 10 minutes.',
			'',
			'If you did not ask to book a class, you can ignore this email — nothing has been sent to the studio.'
		].join('\n'),
		html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;color:#2c1a10">
<p>Your Vinya confirmation code is</p>
<p style="font-size:32px;letter-spacing:.18em;font-weight:700;margin:14px 0">${esc(code)}</p>
<p>Enter it on the booking form to send your request. It lasts 10 minutes.</p>
<p style="font-size:13px;color:#9c8a7a">If you did not ask to book a class, you can ignore this email — nothing has been sent to the studio.</p>
</div>`
	};
}
