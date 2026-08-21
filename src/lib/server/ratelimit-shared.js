import { createLimiter } from './ratelimit.js';

/**
 * A fixed-window counter held in Postgres, so every serverless instance counts
 * against the same total.
 *
 * The in-memory limiter in ratelimit.js is per-instance by nature: a caller
 * spread across several warm instances gets a multiple of `max`, and a cold
 * start forgets everything. That was an acceptable trade while a developer was
 * watching. It is a poor one for an unattended site, because the endpoint this
 * guards spends the studio's own mail quota — enough abuse there gets the
 * sending account suspended, which takes bookings down with it.
 *
 * The counting itself happens inside `rate_limit_hit` (see supabase/security.sql)
 * as a single upsert, so two simultaneous requests cannot both read a stale
 * count and both decide they are under the limit.
 *
 * `client` is injected rather than imported so this module stays free of
 * SvelteKit's environment bindings and can be tested without a database.
 */
export function createSharedLimiter({ max, windowMs, prefix, client }) {
	// Not merely a fallback: it is what keeps a Supabase outage from turning this
	// endpoint into an open relay. Degrading to best-effort is worse than exact
	// counting and far better than counting nothing.
	const fallback = createLimiter({ max, windowMs });
	const windowSeconds = Math.ceil(windowMs / 1000);

	return {
		async check(key) {
			const db = client();
			if (!db) return { ...fallback.check(key), shared: false };

			let data, error;
			try {
				({ data, error } = await db.rpc('rate_limit_hit', {
					p_key: `${prefix}:${key}`,
					p_max: max,
					p_window_seconds: windowSeconds
				}));
			} catch (e) {
				error = e;
			}

			// A missing function, a network blip, or a reply in an unexpected shape
			// all mean the same thing here: this request was not counted centrally.
			if (error || typeof data !== 'boolean') {
				console.error(`[ratelimit] shared counter unavailable, falling back: ${error?.message ?? 'bad reply'}`);
				return { ...fallback.check(key), shared: false };
			}

			return { ok: data, shared: true };
		}
	};
}
