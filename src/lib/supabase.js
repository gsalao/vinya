import { env } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_ANON_KEY;

/** Whether a real Supabase backend is configured. When false the site still
 *  works as a prototype: submissions are simulated so nothing is lost. */
export const supabaseEnabled = Boolean(url && key);
export const supabase = supabaseEnabled ? createClient(url, key) : null;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function subscribeEmail(email) {
	if (!supabase) {
		await wait(400);
		return { ok: true, simulated: true };
	}
	const { error } = await supabase.from('subscribers').insert({ email });
	if (error) return { ok: false, error: error.message };
	return { ok: true };
}
