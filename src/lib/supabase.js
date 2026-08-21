/** Newsletter signup.
 *
 *  This used to hold a browser Supabase client and insert into `subscribers`
 *  directly. The anon key that made that work is public — it ships in the
 *  bundle — so the insert was reachable by anyone with a loop, and because it
 *  went straight to PostgREST it bypassed the app entirely and could not be
 *  rate limited. The write now happens on the server; nothing here knows any
 *  key, and the site no longer ships a Supabase client to visitors at all. */
export async function subscribeEmail(email) {
	let res;
	try {
		res = await fetch('/api/subscribe', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, website: '' })
		});
	} catch {
		return { ok: false, error: 'network' };
	}

	const body = await res.json().catch(() => ({}));
	if (!res.ok) return { ok: false, error: body.error ?? 'Something went wrong. Please try again.' };
	return { ok: true, simulated: Boolean(body.simulated) };
}
