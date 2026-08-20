import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as pub } from '$env/dynamic/public';

/** Server-only Supabase client holding the service-role key.
 *
 *  Content tables deny anon and authenticated outright, so the browser has no
 *  key that can reach them. Every read and write the admin performs goes through
 *  a server route using this client — which means a stolen session cookie gets
 *  whatever the routes allow, and nothing else. */
export function admin() {
	const url = pub.PUBLIC_SUPABASE_URL;
	const key = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key) return null;
	return createClient(url, key, { auth: { persistSession: false } });
}

export const adminReady = () => Boolean(pub.PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

/** Settings are key/value rows so the owner can change who receives booking
 *  enquiries without a deploy. Returns a plain object with sensible blanks. */
export async function readSettings() {
	const db = admin();
	if (!db) return {};
	const { data } = await db.from('settings').select('key,value');
	return Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? '']));
}

export async function writeSetting(key, value) {
	const db = admin();
	if (!db) throw new Error('Supabase is not configured.');
	const { error } = await db.from('settings').upsert({ key, value }, { onConflict: 'key' });
	if (error) throw new Error(error.message);
}

/** The people who may sign in, in the order they were added. */
export async function adminEmails() {
	const settings = await readSettings();
	return String(settings.admin_emails ?? '')
		.split(/[,\s]+/)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

/** Proves the person at the keyboard knows the password, not just that a session
 *  is open. Without this, anyone who finds an unattended signed-in laptop could
 *  mint themselves a permanent account.
 *
 *  Uses a throwaway client so checking the password cannot disturb the session
 *  of whoever is currently signed in. */
export async function passwordIsCorrect(email, password) {
	const url = pub.PUBLIC_SUPABASE_URL;
	const key = pub.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key || !email || !password) return false;
	const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	const { error } = await probe.auth.signInWithPassword({ email, password });
	return !error;
}

/** Only allow-listed addresses may sign in, so an account created elsewhere in
 *  the Supabase project cannot reach the admin. */
export async function isAllowed(email) {
	const settings = await readSettings();
	const list = String(settings.admin_emails ?? '')
		.split(/[,\s]+/)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

	// An empty list means the lookup failed or nobody has been configured —
	// not that this particular address was rejected. Saying "that email cannot
	// sign in" for a broken connection sends whoever is locked out to check the
	// one thing that is fine.
	if (list.length === 0) return { ok: false, reason: 'unconfigured' };
	if (!String(email ?? '').trim()) return { ok: false, reason: 'blank' };
	return { ok: list.includes(String(email).toLowerCase()), reason: 'not-listed' };
}
