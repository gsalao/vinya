import { JWT } from 'google-auth-library';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/** Turns a tab's raw value grid into objects keyed by its header row.
 *
 *  `__row` carries the 1-based spreadsheet row number through to validation, so
 *  a failure can say "events tab, row 7" rather than "events tab, item 5" — the
 *  owner is looking at row numbers, not array indices. */
export function rowsToObjects(values) {
	if (!Array.isArray(values) || values.length === 0) return [];
	const headers = values[0].map((h) => String(h ?? '').trim());
	const out = [];
	for (let i = 1; i < values.length; i++) {
		const cells = values[i] ?? [];
		// Sheets omits trailing empty cells rather than padding, so index past the
		// end is normal and means "blank", not "malformed".
		const row = {};
		let empty = true;
		for (let c = 0; c < headers.length; c++) {
			const value = String(cells[c] ?? '').trim();
			if (value !== '') empty = false;
			row[headers[c]] = value;
		}
		if (empty) continue;
		row.__row = i + 1;
		out.push(row);
	}
	return out;
}

function auth() {
	const raw = process.env.GOOGLE_SA_KEY;
	if (!raw) throw new Error('GOOGLE_SA_KEY is not set. Add it under Settings -> Secrets and variables -> Actions.');
	let key;
	try {
		key = JSON.parse(raw);
	} catch {
		throw new Error('GOOGLE_SA_KEY is not valid JSON. Paste the whole service-account key file, not just the private key.');
	}
	return new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
}

function sheetId() {
	const id = process.env.VINYA_SHEET_ID;
	if (!id) throw new Error('VINYA_SHEET_ID is not set.');
	return id;
}

/** One batchGet for every tab, so a sync is a single API call rather than one
 *  per tab. Returns { tabName: rows[] }. */
export async function readTabs(tabs) {
	const client = auth();
	const ranges = tabs.map((t) => `ranges=${encodeURIComponent(t)}`).join('&');
	const { data } = await client.request({
		url: `${API}/${sheetId()}/values:batchGet?${ranges}&majorDimension=ROWS`
	});
	const out = {};
	data.valueRanges.forEach((vr, i) => {
		out[tabs[i]] = rowsToObjects(vr.values);
	});
	return out;
}

/** Used for the Status cell. RAW so a status line starting with '=' or '+' is
 *  stored as text rather than interpreted as a formula. */
export async function writeCell(range, value) {
	const client = auth();
	await client.request({
		url: `${API}/${sheetId()}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
		method: 'PUT',
		data: { values: [[value]] }
	});
}
