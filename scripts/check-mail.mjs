/**
 * Preflight for the booking email.
 *
 * Run before touching the booking form, so a failure points at one thing:
 * either the SMTP credentials are wrong, or they are not. Debugging both the
 * mail setup and the form at once is what makes this stage miserable.
 *
 *   pnpm mail:check                  # connect and authenticate only
 *   pnpm mail:check you@gmail.com    # also send a real test message
 */
import nodemailer from 'nodemailer';

const need = ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASS'];
const missing = need.filter((k) => !process.env[k]);

const ok = (s) => console.log(`  \x1b[32m✓\x1b[0m ${s}`);
const bad = (s) => console.log(`  \x1b[31m✗\x1b[0m ${s}`);

console.log('\nBooking email preflight\n');

if (missing.length) {
	missing.forEach((k) => bad(`${k} is not set`));
	console.log(`
Nothing to test yet. Create a .env file (copy .env.example) and fill in the
mail settings, then run this again. README → "Set up the booking email".
`);
	process.exit(1);
}

for (const k of need) ok(`${k} is set`);

const pass = process.env.MAIL_PASS;
if (/\s/.test(pass)) {
	bad('MAIL_PASS contains a space — Google shows the app password in four blocks for readability, but it must be entered as 16 unbroken characters');
	process.exit(1);
}
if (pass.length !== 16) {
	console.log(`  \x1b[33m!\x1b[0m MAIL_PASS is ${pass.length} characters. A Google app password is exactly 16 — if you pasted your normal account password, this will fail.`);
}

const to = process.argv[2];
const port = Number(process.env.MAIL_PORT);
const transport = nodemailer.createTransport({
	host: process.env.MAIL_HOST,
	port,
	secure: port === 465,
	auth: { user: process.env.MAIL_USER, pass }
});

console.log(`\nConnecting to ${process.env.MAIL_HOST}:${port} as ${process.env.MAIL_USER} …`);

try {
	await transport.verify();
	ok('connected and authenticated');
} catch (err) {
	bad(`could not authenticate: ${err.message}`);
	const m = String(err.message);
	console.log('\nWhat this usually means:');
	if (/Username and Password not accepted|BadCredentials|535/.test(m)) {
		console.log(`  • You used the normal account password. It must be an *app password*
    from https://myaccount.google.com/apppasswords
  • Or 2-Step Verification is off on that account, so no app password is valid.`);
	} else if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND/.test(m)) {
		console.log(`  • Wrong host or port, or a network/firewall block.
    Gmail is smtp.gmail.com with port 465.`);
	} else {
		console.log('  • Check MAIL_HOST and MAIL_PORT against your provider\'s settings.');
	}
	process.exit(1);
}

if (!to) {
	console.log(`
Credentials are good. To also send a real test message:

  pnpm mail:check your@email.com
`);
	process.exit(0);
}

console.log(`\nSending a test message to ${to} …`);
try {
	const info = await transport.sendMail({
		from: process.env.MAIL_FROM || process.env.MAIL_USER,
		to,
		subject: '[VINYA] Test message',
		text: 'If you can read this, the booking form can send email.\n\nNothing else is set up by this message.'
	});
	ok(`sent (${info.messageId})`);
	console.log(`
Check ${to}, including the spam folder — the first message from a new sender
often lands there. Once it arrives, the booking form will work too.
`);
} catch (err) {
	bad(`send failed: ${err.message}`);
	process.exit(1);
}
