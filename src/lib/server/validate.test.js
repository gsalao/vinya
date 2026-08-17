import { describe, it, expect } from 'vitest';
import { isEmail, sniffAttachment, headerSafe, clamp, ATTACHMENT_MAX } from './validate.js';

describe('isEmail', () => {
	it('accepts ordinary addresses', () => {
		for (const e of ['a@b.co', 'first.last@example.com', 'x+tag@sub.domain.nl', "o'brien@mail.ie"]) {
			expect(isEmail(e), e).toBe(true);
		}
	});

	it('rejects junk', () => {
		for (const e of ['', 'a', 'a@', '@b.com', 'a b@c.com', 'a@b', 'a@@b.com', null, undefined, 123]) {
			expect(isEmail(e), String(e)).toBe(false);
		}
	});

	// A newline in an address is the classic way to inject extra SMTP headers.
	it('rejects addresses containing newlines', () => {
		expect(isEmail('a@b.com\nBcc: victim@evil.com')).toBe(false);
		expect(isEmail('a@b.com\r\nBcc: victim@evil.com')).toBe(false);
	});

	it('rejects absurdly long input rather than passing it to the mailer', () => {
		expect(isEmail('a'.repeat(300) + '@b.com')).toBe(false);
	});
});

describe('headerSafe', () => {
	// The subject line is built from what the visitor chose to join. Without this,
	// a crafted class name could append headers to the outgoing message.
	it('strips CR and LF so a subject cannot grow new headers', () => {
		expect(headerSafe('Yoga\nBcc: victim@evil.com')).toBe('Yoga Bcc: victim@evil.com');
		expect(headerSafe('Yoga\r\nBcc: x')).toBe('Yoga Bcc: x');
	});

	it('collapses runs of whitespace and trims', () => {
		expect(headerSafe('  Kundalini   Yoga  ')).toBe('Kundalini Yoga');
	});

	it('handles non-strings without throwing', () => {
		expect(headerSafe(null)).toBe('');
		expect(headerSafe(undefined)).toBe('');
		expect(headerSafe(42)).toBe('42');
	});
});

describe('clamp', () => {
	it('caps length and marks that it truncated', () => {
		expect(clamp('abcdef', 3)).toBe('abc…');
	});
	it('leaves short values alone', () => {
		expect(clamp('ab', 5)).toBe('ab');
	});
	it('handles non-strings', () => {
		expect(clamp(null, 5)).toBe('');
	});
});

// Helpers that build byte streams with a real file's leading bytes.
const bytes = (...b) => new Uint8Array([...b, ...new Array(64).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);
const WEBP = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, ...new Array(64).fill(0)
]);

describe('sniffAttachment', () => {
	it('identifies the four accepted formats from their bytes', () => {
		expect(sniffAttachment(JPEG).ok && sniffAttachment(JPEG).mime).toBe('image/jpeg');
		expect(sniffAttachment(PNG).mime).toBe('image/png');
		expect(sniffAttachment(PDF).mime).toBe('application/pdf');
		expect(sniffAttachment(WEBP).mime).toBe('image/webp');
	});

	// The declared content type is attacker-controlled, so it is never consulted.
	it('rejects a file whose bytes are not an accepted format, whatever it claims', () => {
		const script = new TextEncoder().encode('<?php system($_GET["c"]); ?>');
		const res = sniffAttachment(script, 'image/jpeg');
		expect(res.ok).toBe(false);
		expect(res.reason).toBe('type');
	});

	it('rejects an HTML file dressed as a PNG', () => {
		const html = new TextEncoder().encode('<html><script>alert(1)</script>');
		expect(sniffAttachment(html, 'image/png').ok).toBe(false);
	});

	it('rejects anything over the size cap', () => {
		const big = new Uint8Array(ATTACHMENT_MAX + 1);
		big.set(JPEG.slice(0, 4));
		const res = sniffAttachment(big);
		expect(res.ok).toBe(false);
		expect(res.reason).toBe('size');
	});

	it('accepts a file exactly at the cap', () => {
		const edge = new Uint8Array(ATTACHMENT_MAX);
		edge.set(JPEG.slice(0, 4));
		expect(sniffAttachment(edge).ok).toBe(true);
	});

	it('rejects empty input without throwing', () => {
		expect(sniffAttachment(new Uint8Array(0)).ok).toBe(false);
		expect(sniffAttachment(null).ok).toBe(false);
	});

	it('rejects a truncated header that only starts like a PNG', () => {
		expect(sniffAttachment(new Uint8Array([0x89, 0x50])).ok).toBe(false);
	});
});
