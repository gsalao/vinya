/** Kept a little under the server's 4 MB gate so a file that passes here is not
 *  then rejected there over encoding overhead. */
export const MAX_BYTES = 4 * 1024 * 1024;
export const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf';
const MAX_EDGE = 1600;

export function describeSize(bytes) {
	return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Shrink a photo before it is uploaded.
 *
 * A receipt straight from a phone camera is routinely 3-8 MB, which exceeds the
 * 4.5 MB Vercel allows in a request body. Downscaling here turns a platform
 * error the visitor cannot act on into a file that simply works. PDFs are left
 * alone - re-encoding them is not something a canvas can do - and anything still
 * too large after this is reported rather than sent.
 */
export async function prepareReceipt(file) {
	if (!file) return { ok: false, reason: 'empty' };
	if (file.type === 'application/pdf') {
		return file.size > MAX_BYTES
			? { ok: false, reason: 'size', size: file.size }
			: { ok: true, file, resized: false };
	}
	if (!file.type.startsWith('image/')) return { ok: false, reason: 'type' };

	let bitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		// An unreadable image is not necessarily invalid - an unusual codec, say -
		// so fall back to the original and let the server have the final say.
		return file.size > MAX_BYTES ? { ok: false, reason: 'size', size: file.size } : { ok: true, file, resized: false };
	}

	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
	if (scale === 1 && file.size <= MAX_BYTES) return { ok: true, file, resized: false };

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close?.();

	const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
	if (!blob) return file.size > MAX_BYTES ? { ok: false, reason: 'size', size: file.size } : { ok: true, file, resized: false };
	if (blob.size > MAX_BYTES) return { ok: false, reason: 'size', size: blob.size };

	return {
		ok: true,
		file: new File([blob], 'receipt.jpg', { type: 'image/jpeg' }),
		resized: true,
		from: file.size,
		to: blob.size
	};
}
