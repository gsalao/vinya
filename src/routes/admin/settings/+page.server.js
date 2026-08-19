import { fail, redirect } from '@sveltejs/kit';
import { readSettings, writeSetting, admin } from '$lib/server/admin-db.js';
import { isEmail } from '$lib/server/validate.js';
import { sendMail, mailReady } from '$lib/server/mail.js';

const list = (s) => String(s ?? '').split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);

export async function load() {
	return { settings: await readSettings() };
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

	signout: async ({ locals }) => {
		await locals.supabase?.auth.signOut();
		throw redirect(303, '/admin/login');
	}
};
