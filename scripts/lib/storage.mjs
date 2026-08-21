/** Listing the image bucket, correctly.
 *
 *  Supabase Storage's list() is paged and defaults to 100 rows. Calling it once
 *  and treating the result as the whole bucket is the kind of bug that never
 *  announces itself: the backup runs green, writes a hundred files, and is
 *  discovered to be partial only when someone needs it. */

export const PAGE = 100;

export async function listAll(db, bucket, path = '') {
	const out = [];
	for (let offset = 0; ; offset += PAGE) {
		const { data, error } = await db.storage.from(bucket).list(path, {
			limit: PAGE,
			offset,
			sortBy: { column: 'name', order: 'asc' }
		});
		if (error) throw new Error(`Could not list ${bucket}: ${error.message}`);
		if (!data || data.length === 0) break;

		// Supabase represents an empty folder with a zero-byte placeholder row
		// that has no metadata. It is not a file and must not be counted or
		// downloaded.
		out.push(...data.filter((f) => f?.metadata && typeof f.metadata.size === 'number'));
		if (data.length < PAGE) break;
	}
	return out;
}

export const totalBytes = (files) => files.reduce((sum, f) => sum + (f?.metadata?.size ?? 0), 0);

/** Every stored filename the site actually points at.
 *
 *  Content holds full public URLs, so the filename is the last segment. Walking
 *  the whole object rather than named fields is deliberate: images are reached
 *  through several shapes (`src`, `photo`, gallery entries, and the `srcset`
 *  variants shape.mjs derives), and a list of fields to check is a list someone
 *  will forget to extend.
 *
 *  Used to tell orphans — files nothing references — from the files a restore
 *  must reproduce. Orphans are what there is to delete when the bucket fills. */
export function referencedNames(content, bucket = 'site-images') {
	// A srcset holds several URLs in one string, each followed by a width
	// descriptor and separated by commas — "…/a-1400.jpg 1400w, …/a-2200.jpg 2200w".
	// Splitting on the marker and taking the rest of the string captures the
	// descriptor and drops every URL after the first, which would leave a
	// restore silently missing most of its variants.
	const marker = `/${bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`;
	const re = new RegExp(`${marker}([^\\s,"'?#)\\\\]+)`, 'g');
	const found = new Set();

	const walk = (node) => {
		if (typeof node === 'string') {
			for (const m of node.matchAll(re)) {
				const name = decodeURIComponent(m[1]);
				if (name) found.add(name);
			}
			return;
		}
		if (Array.isArray(node)) return node.forEach(walk);
		if (node && typeof node === 'object') return Object.values(node).forEach(walk);
	};

	walk(content);
	return found;
}

/** The four names the upload convention writes for one photo. shape.mjs derives
 *  srcset by swapping these exact substrings, so a restore that reproduces only
 *  the -2200.jpg leaves every other variant a broken image. */
export function variantsOf(name) {
	const base = name.replace(/-2200\.(jpg|webp)$/, '');
	if (base === name) return [name];
	return [`${base}-2200.jpg`, `${base}-1400.jpg`, `${base}-2200.webp`, `${base}-1400.webp`];
}
