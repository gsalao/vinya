/** The rules about who may sign in, kept apart from the request handling so they
 *  can be tested directly rather than through a form post. */

/** Parses the stored allow-list. Stored as one string because settings are
 *  key/value; tolerant of commas, spaces and stray newlines because a human may
 *  eventually edit it by hand. */
export function parsePeople(value) {
	return String(value ?? '')
		.split(/[,\s]+/)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

/** Whether an address may be removed, and why not when it may not.
 *
 *  Removing yourself is allowed — that is leaving, and the session ends with it.
 *  Removing the last account is not: sign-in refuses when nobody is configured,
 *  so an empty list locks everyone out with no way back except editing the
 *  database by hand.
 */
export function canRemove(people, email) {
	const list = parsePeople(people.join(','));
	const target = String(email ?? '').trim().toLowerCase();
	if (!list.includes(target)) return { ok: false, reason: 'not-listed' };
	if (list.length === 1) return { ok: false, reason: 'last-account' };
	return { ok: true };
}

/** Whether an address may be added. */
export function canAdd(people, email) {
	const list = parsePeople(people.join(','));
	const target = String(email ?? '').trim().toLowerCase();
	if (!target) return { ok: false, reason: 'blank' };
	if (list.includes(target)) return { ok: false, reason: 'already-listed' };
	return { ok: true };
}
