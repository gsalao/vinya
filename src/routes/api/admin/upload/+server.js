import { json } from '@sveltejs/kit';
import { admin } from '$lib/server/admin-db.js';

const BUCKET = 'site-images';
const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/webp', 'image/png', 'image/svg+xml']);

/** Receives the finished variants and stores them.
 *
 *  The browser has already resized and re-encoded, so what arrives here is small
 *  and already in the two widths the site serves. This route's job is to check
 *  what it was handed and put it somewhere — it does no image processing, which
 *  is why it needs no image library and cannot be made slow by a large upload.
 *
 *  Files are named to satisfy the convention shape.mjs already derives srcset
 *  from: <id>-2200.jpg implies <id>-1400.jpg and the .webp of each. That is why
 *  adding uploads needed no change to the shaping logic.
 */
export async function POST({ request, locals }) {
	const user = await locals.getUser();
	if (!user) return json({ error: 'not allowed' }, { status: 401 });

	const db = admin();
	if (!db) return json({ error: 'Storage is not configured.' }, { status: 503 });

	let form;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'That upload did not arrive intact. Please try again.' }, { status: 400 });
	}

	const id = String(form.get('id') ?? '').replace(/[^a-z0-9-]/gi, '');
	const single = form.get('single') === '1';
	if (!id) return json({ error: 'Missing an image name.' }, { status: 400 });

	// Named exactly as the site's convention expects, so no mapping is needed
	// anywhere downstream.
	const wanted = single
		? [['file', `${id}`]]
		: [
				['w2200', `${id}-2200.jpg`],
				['w1400', `${id}-1400.jpg`],
				['w2200webp', `${id}-2200.webp`],
				['w1400webp', `${id}-1400.webp`]
			];

	const uploaded = [];
	for (const [field, name] of wanted) {
		const file = form.get(field);
		if (!(file instanceof File)) {
			return json({ error: 'That upload was incomplete. Please try again.' }, { status: 400 });
		}
		if (file.size > MAX_BYTES) {
			return json({ error: 'That image is too large even after resizing. Try a smaller one.' }, { status: 400 });
		}
		if (!ALLOWED.has(file.type)) {
			return json({ error: 'That file type is not supported. Use a JPEG, PNG or WebP.' }, { status: 400 });
		}

		const { error } = await db.storage.from(BUCKET).upload(name, file, {
			contentType: file.type,
			upsert: true,
			cacheControl: '31536000'
		});
		if (error) return json({ error: `Could not store the image: ${error.message}` }, { status: 502 });
		uploaded.push(name);
	}

	const primary = single ? id : `${id}-2200.jpg`;
	const { data } = db.storage.from(BUCKET).getPublicUrl(primary);
	return json({ url: data.publicUrl, uploaded });
}

/** Removes an image and its variants. Replacing a photo should free the space,
 *  not quietly accumulate every version the studio has ever used. */
export async function DELETE({ request, locals }) {
	const user = await locals.getUser();
	if (!user) return json({ error: 'not allowed' }, { status: 401 });

	const db = admin();
	if (!db) return json({ error: 'Storage is not configured.' }, { status: 503 });

	const { url } = await request.json().catch(() => ({}));
	const name = String(url ?? '').split(`/${BUCKET}/`)[1];
	// Only ever deletes from our own bucket: a path that did not come from here
	// is left alone rather than guessed at.
	if (!name) return json({ removed: [] });

	const base = name.replace(/-2200\.(jpg|webp)$/, '');
	const targets = base === name ? [name] : [`${base}-2200.jpg`, `${base}-1400.jpg`, `${base}-2200.webp`, `${base}-1400.webp`];
	await db.storage.from(BUCKET).remove(targets);
	return json({ removed: targets });
}
