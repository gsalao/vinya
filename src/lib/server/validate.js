/** Vercel caps a serverless request body at 4.5 MB. Staying under it with room
 *  for the other form fields keeps a large receipt from failing as a confusing
 *  platform error rather than a message the visitor can act on. */
export const ATTACHMENT_MAX = 4 * 1024 * 1024;

// Deliberately not RFC 5322. That grammar accepts addresses no mail client can
// send to, and the only thing this needs to do is reject junk before it reaches
// the SMTP layer. The real proof an address exists is the code it receives.
const EMAIL = /^[^\s@,;:<>"\\]+@[^\s@,;:<>"\\]+\.[a-z]{2,}$/i;

export function isEmail(v) {
	if (typeof v !== 'string') return false;
	if (v.length > 254) return false;
	if (/[\r\n]/.test(v)) return false;
	return EMAIL.test(v);
}

/** Anything interpolated into a header must not be able to start a new one. */
export function headerSafe(v) {
	if (v === null || v === undefined) return '';
	return String(v).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function clamp(v, max) {
	if (v === null || v === undefined) return '';
	const s = String(v);
	return s.length > max ? s.slice(0, max) + '…' : s;
}

const startsWith = (buf, sig) => sig.every((b, i) => buf[i] === b);

const SIGNATURES = [
	{ mime: 'image/jpeg', ext: 'jpg', test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
	{ mime: 'image/png', ext: 'png', test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
	{ mime: 'application/pdf', ext: 'pdf', test: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]) },
	{
		mime: 'image/webp',
		ext: 'webp',
		// RIFF container: "RIFF" then a size, then "WEBP" at offset 8.
		test: (b) => b.length >= 12 && startsWith(b, [0x52, 0x49, 0x46, 0x46]) &&
			b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
	}
];

/**
 * Decide what a receipt actually is from its leading bytes.
 *
 * The browser-declared content type is not consulted at all: it is set by
 * whoever sends the request, so treating it as evidence would mean a script
 * renamed to .jpg reaches the owner's mail client as a trusted image.
 */
export function sniffAttachment(buf, _declaredType) {
	if (!buf || buf.length === 0) return { ok: false, reason: 'empty' };
	if (buf.length > ATTACHMENT_MAX) return { ok: false, reason: 'size' };

	const hit = SIGNATURES.find((s) => s.test(buf));
	if (!hit) return { ok: false, reason: 'type' };
	return { ok: true, mime: hit.mime, ext: hit.ext };
}
