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
	if (!id)
		throw new Error(
			'VINYA_SHEET_ID is not set. Add it under Settings -> Secrets and variables -> Actions -> Variables (it is a repository variable, not a secret).'
		);
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

/** Writes rows into a tab starting at its first cell. This writes into the
 *  range the payload covers and leaves anything beyond it untouched — it does
 *  not clear the tab first. Fine for seeding a tab that starts completely
 *  empty, which is the only thing this is used for; misleading for a
 *  "replace this tab" utility, which this is not.
 *
 *  RAW, not USER_ENTERED. RAW stores every cell as exactly the text it is
 *  given: never coerced, never evaluated. USER_ENTERED parses each cell as if
 *  a person had typed it into the sheet UI, and the content this seeds is
 *  full of values that would be silently coerced into something else on the
 *  way in: a timetable time like "10:30" becomes a time value and reads back
 *  "10:30:00"; an event day like "08" becomes the number 8; a past-event
 *  date like "26 Jul" and an event month like "August 2026" both become an
 *  actual date, reformatted on read-back; a price like "€15" becomes a
 *  locale-dependent currency value. readTabs() reads FORMATTED_VALUE, not the
 *  underlying value, so every one of those comes back as the coerced display
 *  string, not the original text — silently wrong for the columns schema.mjs
 *  has no format rule for, or a failing first sync for the two it does
 *  (events.month, events.day). RAW avoids all of it: it never creates a
 *  formula either, the one thing it does differently from USER_ENTERED — the
 *  whole of content.generated.json has been checked for a value starting
 *  with '=', '+', '-' or '@', and none do. */
export async function writeTab(tab, rows) {
	const client = auth();
	await client.request({
		url: `${API}/${sheetId()}/values/${encodeURIComponent(tab)}?valueInputOption=RAW`,
		method: 'PUT',
		data: { values: rows }
	});
}

/** Names of every tab (sheet) the spreadsheet actually has, read straight from
 *  the Sheets API. Google-only, like the rest of this file — it has no idea
 *  what tabs Vinya's content needs, only how to ask what exists. Used by
 *  seed-sheet.mjs to check its own assumptions before writing anything. */
export async function tabNames() {
	const client = auth();
	const { data } = await client.request({
		url: `${API}/${sheetId()}?fields=sheets.properties.title`
	});
	return (data.sheets ?? []).map((s) => s.properties.title);
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
