/** Turns a photo straight off a phone into the four files the site serves.
 *
 *  This runs in the owner's browser, before anything is uploaded. A 6MB photo
 *  becomes roughly 400KB of finished variants, so the upload is fast on studio
 *  wifi and the server never has to hold or process a large file. It also means
 *  no image library in the deployment — the one that would normally do this adds
 *  about 30MB to a serverless bundle.
 *
 *  The four names match what shape.mjs already derives srcset from, so nothing
 *  downstream had to learn about uploads.
 */

export const WIDTHS = [2200, 1400];
const QUALITY = 0.82;

/** Draws the source at a target width, preserving aspect ratio. Never upscales:
 *  enlarging a small photo produces a bigger file that looks worse. */
async function drawTo(bitmap, width) {
	const w = Math.min(width, bitmap.width);
	const h = Math.round((bitmap.height / bitmap.width) * w);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(bitmap, 0, 0, w, h);
	return canvas;
}

const toBlob = (canvas, type) =>
	new Promise((resolve, reject) =>
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Could not encode ${type}`))), type, QUALITY)
	);

/** Reads a file the owner picked and returns the four variants, plus the natural
 *  dimensions so the cropper can show the right shape. */
export async function makeVariants(file, id) {
	if (!file.type.startsWith('image/')) {
		throw new Error('That file is not an image.');
	}
	// SVG has no pixels to resample and logos are already small, so it passes
	// through untouched rather than being rasterised into something worse.
	if (file.type === 'image/svg+xml') {
		return { single: true, files: { file }, name: `${id}.svg`, width: 0, height: 0 };
	}

	const bitmap = await createImageBitmap(file);
	const [wide, narrow] = await Promise.all(WIDTHS.map((w) => drawTo(bitmap, w)));

	const [jpg2200, jpg1400, webp2200, webp1400] = await Promise.all([
		toBlob(wide, 'image/jpeg'),
		toBlob(narrow, 'image/jpeg'),
		toBlob(wide, 'image/webp'),
		toBlob(narrow, 'image/webp')
	]);

	const named = (blob, suffix, type) => new File([blob], `${id}${suffix}`, { type });

	const result = {
		single: false,
		width: bitmap.width,
		height: bitmap.height,
		files: {
			w2200: named(jpg2200, '-2200.jpg', 'image/jpeg'),
			w1400: named(jpg1400, '-1400.jpg', 'image/jpeg'),
			w2200webp: named(webp2200, '-2200.webp', 'image/webp'),
			w1400webp: named(webp1400, '-1400.webp', 'image/webp')
		}
	};
	bitmap.close?.();
	return result;
}

/** Sends the variants and returns the public URL of the one stored in content.
 *  The other three are found by convention. */
export async function upload(file, id, { raw = false } = {}) {
	if (raw) {
		const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
		const form = new FormData();
		form.set('id', `${id}.${ext}`);
		form.set('single', '1');
		form.set('file', file);
		const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.error ?? 'The upload did not work. Please try again.');
		return { url: body.url, width: 0, height: 0 };
	}
	const variants = await makeVariants(file, id);
	const form = new FormData();
	form.set('id', variants.single ? `${id}.svg` : id);
	if (variants.single) form.set('single', '1');
	for (const [field, f] of Object.entries(variants.files)) form.set(field, f);

	const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
	const body = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(body.error ?? 'The upload did not work. Please try again.');
	return { url: body.url, width: variants.width, height: variants.height };
}

/** Frees the storage a replaced photo was using. Failure is not worth telling
 *  her about: the new photo is already saved, and a leftover file costs nothing
 *  she can see. */
export async function removeUploaded(url) {
	if (!url || !url.includes('/site-images/')) return;
	try {
		await fetch('/api/admin/upload', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url })
		});
	} catch {
		/* ignore */
	}
}

/** A stable, readable file name. Includes the slot so a file in the bucket can
 *  be recognised later, and a short random suffix so replacing a photo never
 *  serves a stale copy from a CDN cache. */
export function imageId(slot) {
	const clean = String(slot).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	return `${clean}-${Math.random().toString(36).slice(2, 8)}`;
}
