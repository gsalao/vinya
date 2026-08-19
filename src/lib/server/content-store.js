import { admin } from './admin-db.js';
import { REQUIRED, OPTIONAL_EXTRAS, validate } from '../../../scripts/lib/schema.mjs';

const toSnake = (s) => String(s).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (s) => String(s).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const columnsFor = (tab) => [...REQUIRED[tab], ...(OPTIONAL_EXTRAS[tab] ?? [])];

/** Reads every tab, in `sort` order, in the shape validate() and shape() expect.
 *  Deliberately the same contract as scripts/lib/db.mjs's readTables so the
 *  admin and the publish pipeline see identical data. */
export async function readAll() {
	const db = admin();
	if (!db) throw new Error('Supabase is not configured.');
	const out = {};
	for (const tab of Object.keys(REQUIRED)) {
		const { data, error } = await db
			.from(toSnake(tab))
			.select(['id', ...columnsFor(tab).map(toSnake)].join(','))
			.order('sort', { ascending: true });
		if (error) throw new Error(`Could not read ${tab}: ${error.message}`);
		out[tab] = (data ?? []).map((row, i) => {
			const o = { __id: row.id, __row: i + 1 };
			for (const c of columnsFor(tab)) o[c] = String(row[toSnake(c)] ?? '').trim();
			return o;
		});
	}
	return out;
}

/** Validates a proposed change against the whole content set before writing.
 *
 *  Cross-tab rules exist — a class must name a studio that exists, a booking
 *  label must be unique across classes, offerings and events — so a single
 *  section cannot be judged alone. Returns the errors validate() would report at
 *  publish time, which is what makes the form and the pipeline agree by
 *  construction rather than by two lists someone keeps in step.
 */
export function checkChange(all, tab, rows) {
	const proposed = { ...all, [tab]: rows.map((r, i) => ({ ...r, __row: i + 1 })) };
	return validate(proposed);
}

/** Replaces one tab's rows. Only called after checkChange returned nothing. */
export async function writeTab(tab, rows) {
	const db = admin();
	if (!db) throw new Error('Supabase is not configured.');
	const table = toSnake(tab);
	const { error: clearError } = await db.from(table).delete().not('id', 'is', null);
	if (clearError) throw new Error(clearError.message);
	if (rows.length === 0) return;
	const payload = rows.map((row, i) => {
		const record = { sort: i };
		for (const c of columnsFor(tab)) record[toSnake(c)] = row[c] ?? '';
		return record;
	});
	const { error } = await db.from(table).insert(payload);
	if (error) throw new Error(error.message);
}

/** Arms the debounce. A save is immediate; publishing waits for quiet, so a run
 *  of edits produces one deploy rather than one per field. */
export async function armPublish(seconds = 30) {
	const db = admin();
	if (!db) return;
	await db
		.from('publish_state')
		.update({
			status: 'pending',
			message: 'Saved. Publishing shortly.',
			publish_after: new Date(Date.now() + seconds * 1000).toISOString()
		})
		.eq('id', 1);
}

export async function readPublishState() {
	const db = admin();
	if (!db) return null;
	const { data } = await db.from('publish_state').select('*').eq('id', 1).single();
	return data ?? null;
}
