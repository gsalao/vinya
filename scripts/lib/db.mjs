import { createClient } from '@supabase/supabase-js';
import { REQUIRED, OPTIONAL_EXTRAS } from './schema.mjs';

/** Postgres columns are snake_case; the pipeline's keys are camelCase. Both
 *  conversions are mechanical rather than a lookup table, so a new column cannot
 *  arrive with a mapping someone forgot to add. `past_events` <-> `pastEvents`
 *  and `cta_label` <-> `ctaLabel` go through the same two functions. */
export const toCamel = (s) => String(s).replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const toSnake = (s) => String(s).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

/** Every column a tab may carry. REQUIRED is the authority; OPTIONAL_EXTRAS
 *  names the ones the site treats as absent when blank. Selecting exactly these
 *  keeps `id`, `sort` and `updated_at` out of the pipeline, which matters
 *  because schema.mjs scans every field of a prices row looking for URLs. */
export const columnsFor = (tab) => [...REQUIRED[tab], ...(OPTIONAL_EXTRAS[tab] ?? [])];

function client() {
	const url = process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url) throw new Error('PUBLIC_SUPABASE_URL is not set. Add it under Settings -> Secrets and variables -> Actions -> Variables.');
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Add it under Settings -> Secrets and variables -> Actions -> Repository secrets.');
	return createClient(url, key, { auth: { persistSession: false } });
}

/** Turns a database row into the shape the pipeline expects: camelCase keys,
 *  every value a trimmed string, plus `__row` so a validation failure can name
 *  the row the owner is looking at. Position is 1-based to match what the admin
 *  numbers on screen. */
export function rowToObject(row, index) {
	const out = {};
	for (const [k, v] of Object.entries(row)) out[toCamel(k)] = String(v ?? '').trim();
	out.__row = index + 1;
	return out;
}

/** Reads every named tab, ordered by `sort`. Returns { tab: rows[] } — the same
 *  shape readTabs() returned from Google Sheets, so validate/shape/flatten and
 *  everything downstream are untouched by the move. */
export async function readTables(tabs) {
	const db = client();
	const out = {};
	for (const tab of tabs) {
		const { data, error } = await db
			.from(toSnake(tab))
			.select(columnsFor(tab).map(toSnake).join(','))
			.order('sort', { ascending: true });
		if (error) throw new Error(`Could not read "${tab}": ${error.message}`);
		out[tab] = (data ?? []).map(rowToObject);
	}
	return out;
}

/** Replaces a table's contents. Used by the seeder to fill an empty database
 *  from the committed content, once. */
export async function writeTable(tab, rows) {
	const db = client();
	const table = toSnake(tab);
	const { error: clearError } = await db.from(table).delete().not('id', 'is', null);
	if (clearError) throw new Error(`Could not clear "${tab}": ${clearError.message}`);
	if (rows.length === 0) return;
	const payload = rows.map((row, i) => {
		const record = { sort: i };
		for (const column of columnsFor(tab)) record[toSnake(column)] = row[column] ?? '';
		return record;
	});
	const { error } = await db.from(table).insert(payload);
	if (error) throw new Error(`Could not write "${tab}": ${error.message}`);
}

/** The admin's publish banner and the Action's result both land here. Never
 *  throws: a publish that succeeded but could not report itself still
 *  succeeded. */
export async function setPublishState(fields) {
	try {
		const db = client();
		const { error } = await db.from('publish_state').update(fields).eq('id', 1);
		if (error) throw new Error(error.message);
	} catch (error) {
		console.warn(`::warning::Could not write publish state: ${error.message}`);
	}
}
