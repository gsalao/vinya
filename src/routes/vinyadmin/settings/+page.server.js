import { fail, redirect } from '@sveltejs/kit';
import { readSettings, writeSetting, admin, adminEmails, passwordIsCorrect } from '$lib/server/admin-db.js';
import { isEmail } from '$lib/server/validate.js';
import { sendMail, mailReady } from '$lib/server/mail.js';
import { canAdd, canRemove } from '$lib/admin/access.js';
import { ADMIN_BASE } from '$lib/admin/paths.js';

const list = (s) => String(s ?? '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export async function load({ locals }) {
	return {
		settings: await readSettings(),
		people: await adminEmails(),
		me: locals.user?.email?.toLowerCase() ?? ''
	};
}

export const actions = {
	recipients: async ({ request }) => {
		const form = await request.formData();
		const to = list(form.get('mail_to'));
		const cc = list(form.get('mail_cc'));

		for (const address of [...to, ...cc]) {
			if (!isEmail(address)) return fail(400, { error: `"${address}" does not look like an email address.` });
		}
		if (to.length === 0) return fail(400, { error: 'Someone has to receive booking requests. Add at least one address.' });

		// The previous recipients are told before the change takes effect. Anyone
		// who reached this screen could otherwise redirect booking enquiries —
		// real people's names and addresses — with nothing to show it happened.
		const before = await readSettings();
		const previous = list(before.mail_to);
		if (previous.length > 0 && previous.join(',') !== to.join(',') && mailReady()) {
			try {
				await sendMail({
					to: previous.join(','),
					subject: 'Vinya: who receives booking requests has changed',
					text: [
						'The addresses that receive booking requests from the Vinya website have just been changed.',
						'',
						`Before: ${previous.join(', ')}`,
						`Now:    ${to.join(', ')}`,
						'',
						'If you made this change you can ignore this message.',
						'If you did not, contact your developer — someone else can sign in to the site editor.'
					].join('\n')
				});
			} catch {
				// A failed notice must not block a legitimate change; the change is
				// still recorded and visible in the editor.
			}
		}

		await writeSetting('mail_to', to.join(','));
		await writeSetting('mail_cc', cc.join(','));
		return { saved: 'recipients' };
	},

	password: async ({ request, locals }) => {
		const form = await request.formData();
		const next = String(form.get('password') ?? '');
		const again = String(form.get('confirm') ?? '');

		if (next.length < 12) return fail(400, { error: 'Use at least 12 characters. Longer is better than complicated.' });
		if (next !== again) return fail(400, { error: 'Those two do not match.' });

		const { error } = await locals.supabase.auth.updateUser({ password: next });
		if (error) return fail(400, { error: error.message });
		return { saved: 'password' };
	},

	addPerson: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const theirPassword = String(form.get('theirPassword') ?? '');
		const myPassword = String(form.get('myPassword') ?? '');
		const me = locals.user?.email?.toLowerCase() ?? '';

		if (!isEmail(email)) return fail(400, { error: 'That does not look like an email address.', form: 'people' });
		if (theirPassword.length < 12) return fail(400, { error: 'Give them at least 12 characters to start with.', form: 'people' });
		if (!(await passwordIsCorrect(me, myPassword))) {
			return fail(401, { error: 'That is not your password.', form: 'people' });
		}

		const people = await adminEmails();
		const allowed = canAdd(people, email);
		if (!allowed.ok) {
			return fail(400, {
				error: allowed.reason === 'already-listed' ? `${email} can already sign in.` : 'Enter an email address.',
				form: 'people'
			});
		}

		const db = admin();
		if (!db) return fail(503, { error: 'Not connected to the content store.', form: 'people' });

		// The account is created confirmed: this is an invitation from someone who
		// just proved they hold the password, not a public signup.
		const { error } = await db.auth.admin.createUser({
			email,
			password: theirPassword,
			email_confirm: true
		});
		// An account may already exist without being allowed in — adding to the
		// list is still the right outcome, so this is not an error.
		if (error && !/already/i.test(error.message)) {
			return fail(502, { error: `Could not create that account: ${error.message}`, form: 'people' });
		}

		await writeSetting('admin_emails', [...people, email].join(','));
		return { saved: 'people', added: email };
	},

	removePerson: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const myPassword = String(form.get('myPassword') ?? '');
		const me = locals.user?.email?.toLowerCase() ?? '';

		if (!(await passwordIsCorrect(me, myPassword))) {
			return fail(401, { error: 'That is not your password.', form: 'people' });
		}

		const people = await adminEmails();
		const allowed = canRemove(people, email);
		if (!allowed.ok) {
			return fail(400, {
				error:
					allowed.reason === 'last-account'
						? 'This is the only account that can sign in. Add someone else before removing it.'
						: 'That person is not on the list.',
				form: 'people'
			});
		}

		await writeSetting('admin_emails', people.filter((p) => p !== email).join(','));

		// Removing yourself is leaving: the session is no longer meaningful, so end
		// it rather than leaving a signed-in page nobody can act from.
		if (email === me) {
			await locals.supabase?.auth.signOut();
			throw redirect(303, `${ADMIN_BASE}/login`);
		}
		return { saved: 'people', removed: email };
	},

	signout: async ({ locals }) => {
		await locals.supabase?.auth.signOut();
		throw redirect(303, `${ADMIN_BASE}/login`);
	}
};
