import { error, fail } from '@sveltejs/kit';
import { SECTIONS, COPY_PAGES, orderCopy } from '$lib/admin/fields.js';
import { readAll, checkChange, writeTab, armPublish, columnsFor } from '$lib/server/content-store.js';

export async function load({ params }) {
	const pageKey = params.page;
	if (!(pageKey in COPY_PAGES)) throw error(404, 'No such page');

	const all = await readAll();
	const sections = (SECTIONS[pageKey] ?? []).map((s) => ({
		...s,
		columns: columnsFor(s.tab),
		// `only` narrows a shared table to the page being edited — the images
		// table holds every page's fixed slots, and she should see hers.
		rows: s.only ? all[s.tab].filter((r) => String(r.key ?? '').startsWith(s.only)) : all[s.tab]
	}));

	// Prose for this page only, so the words land under the page the owner is
	// looking at rather than in one undifferentiated list of 110 keys.
	const prefix = COPY_PAGES[pageKey];
	const copy = orderCopy(all.copy.filter((r) => r.key.startsWith(prefix)), pageKey);

	return { pageKey, sections, copy };
}

export const actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const tab = String(form.get('__tab') ?? '');
		const count = Number(form.get('__count') ?? 0);
		// A section may show only part of a table — the images table holds every
		// page's fixed slots, and the About page submits only its own. Writing the
		// submitted rows alone would delete the other pages' pictures.
		const only = String(form.get('__only') ?? '');
		if (!tab) return fail(400, { error: 'Nothing to save.' });

		const columns = columnsFor(tab);
		const rows = [];
		for (let i = 0; i < count; i++) {
			if (form.get(`__deleted.${i}`) === '1') continue;
			const row = {};
			for (const c of columns) row[c] = String(form.get(`${i}.${c}`) ?? '').trim();
			rows.push(row);
		}

		const all = await readAll();
		const merged = only
			? [...all[tab].filter((r) => !String(r.key ?? '').startsWith(only)), ...rows]
			: rows;
		const problems = checkChange(all, tab, merged);
		if (problems.length > 0) {
			return fail(400, {
				tab,
				problems: problems.map((p) => ({ row: p.row, message: p.message, tab: p.tab }))
			});
		}

		await writeTab(tab, merged);
		await armPublish();
		return { saved: tab, count: rows.length };
	},

	saveCopy: async ({ request }) => {
		const form = await request.formData();
		const all = await readAll();
		const next = all.copy.map((r) => {
			const submitted = form.get(`copy.${r.key}`);
			return submitted === null ? r : { ...r, text: String(submitted) };
		});

		const problems = checkChange(all, 'copy', next);
		if (problems.length > 0) {
			return fail(400, {
				tab: 'copy',
				problems: problems.map((p) => ({ row: p.row, message: p.message, tab: p.tab }))
			});
		}

		await writeTab('copy', next);
		await armPublish();
		return { saved: 'copy', count: next.length };
	}
};
