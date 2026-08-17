/**
 * A fixed-window counter held in the instance's memory.
 *
 * Serverless instances do not share memory, so a caller spread across several
 * warm instances gets more attempts than `max` suggests, and a cold start resets
 * the count. This is deliberately accepted: it stops the realistic threat here,
 * which is someone pointing a loop at the OTP endpoint, and a hard guarantee
 * would need the shared store this project chose not to run. Anything that later
 * moves real money or personal data should not rely on this alone.
 */
export function createLimiter({ max, windowMs }) {
	const hits = new Map();

	function sweep(now) {
		for (const [key, entry] of hits) {
			if (now - entry.start >= windowMs) hits.delete(key);
		}
	}

	return {
		check(key) {
			const now = Date.now();
			// Sweeping on write keeps this to one Map with no timer to leak; the
			// endpoint's traffic is low enough that the scan is not worth optimising.
			sweep(now);

			const entry = hits.get(key);
			if (!entry) {
				hits.set(key, { start: now, count: 1 });
				return { ok: true };
			}
			if (entry.count < max) {
				entry.count++;
				return { ok: true };
			}
			return { ok: false, retryAfterMs: windowMs - (now - entry.start) };
		},
		size() {
			return hits.size;
		}
	};
}
