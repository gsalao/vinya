import { describe, it, expect } from 'vitest';
import { composeBooking, composeOtp } from './compose.js';

const base = {
	name: 'Test Person',
	email: 'test@email.com',
	sessions: ['Kundalini Yoga · Tuesday Aug 18, 2026 · 10:30–11:30 · Tru Colours'],
	joining: ['Kundalini Yoga'],
	pass: { lbl: '10-class pass', amt: '€90' },
	method: 'tikkie',
	hasReceipt: true,
	notes: ''
};

describe('composeBooking subject', () => {
	it('is prefixed and names what they chose to join', () => {
		expect(composeBooking(base).subject).toBe('[VINYA] Kundalini Yoga');
	});

	it('lists several choices', () => {
		const s = composeBooking({ ...base, joining: ['Kundalini Yoga', 'Slow Yoga Adjustment'] }).subject;
		expect(s).toBe('[VINYA] Kundalini Yoga, Slow Yoga Adjustment');
	});

	it('stays on one line even if a choice contains newlines', () => {
		const s = composeBooking({ ...base, joining: ['Yoga\nBcc: victim@evil.com'] }).subject;
		expect(s).not.toMatch(/[\r\n]/);
	});

	it('does not grow without bound', () => {
		const many = Array.from({ length: 40 }, (_, i) => `Class number ${i}`);
		expect(composeBooking({ ...base, joining: many }).subject.length).toBeLessThanOrEqual(160);
	});

	it('still says something useful when nothing was named', () => {
		expect(composeBooking({ ...base, joining: [] }).subject).toBe('[VINYA] Booking request');
	});
});

describe('composeBooking mode of payment', () => {
	const mode = (over) => {
		const m = composeBooking({ ...base, ...over }).text.match(/Mode of Payment: (.*)/);
		return m && m[1];
	};

	it('names the pass and flags an attached receipt', () => {
		expect(mode({ method: 'tikkie', hasReceipt: true })).toBe('Tikkie €90 — 10-class pass (receipt attached)');
	});

	// The owner has to know to go check Tikkie themselves in this case.
	it('is explicit when a Tikkie payer attached nothing', () => {
		expect(mode({ method: 'tikkie', hasReceipt: false })).toBe('Tikkie €90 — 10-class pass (no receipt)');
	});

	it('states what is owed for cash', () => {
		expect(mode({ method: 'cash', hasReceipt: false })).toBe('Cash on arrival (€90 due)');
	});

	it('says nothing is due for an existing pass', () => {
		expect(mode({ pass: null, method: null })).toBe('Existing pass — nothing due');
	});
});

describe('composeBooking body', () => {
	it('carries name, email and sessions', () => {
		const { text } = composeBooking(base);
		expect(text).toContain('Name: Test Person');
		expect(text).toContain('Email: test@email.com');
		expect(text).toContain('Kundalini Yoga · Tuesday Aug 18, 2026');
	});

	it('includes notes when given', () => {
		const { text } = composeBooking({ ...base, notes: 'First class, a bit nervous.' });
		expect(text).toContain('Anything I should know');
		expect(text).toContain('First class, a bit nervous.');
	});

	it('omits the notes heading entirely when there are none', () => {
		expect(composeBooking({ ...base, notes: '' }).text).not.toContain('Anything I should know');
	});

	it('escapes HTML so a note cannot inject markup into the owner\'s mail client', () => {
		const { html } = composeBooking({ ...base, notes: '<img src=x onerror=alert(1)>' });
		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
	});

	it('sets reply-to to the visitor, not the from address', () => {
		expect(composeBooking(base).replyTo).toBe('test@email.com');
	});

	it('caps a very long note rather than mailing an essay', () => {
		const { text } = composeBooking({ ...base, notes: 'x'.repeat(5000) });
		expect(text.length).toBeLessThan(3000);
	});
});

describe('composeOtp', () => {
	it('puts the code in the subject and the body', () => {
		const { subject, text } = composeOtp('482913');
		expect(subject).toContain('482913');
		expect(text).toContain('482913');
	});

	it('says how long it lasts and that it should not be shared', () => {
		const { text } = composeOtp('482913');
		expect(text.toLowerCase()).toMatch(/10 minutes/);
		expect(text.toLowerCase()).toMatch(/did not|didn't/);
	});
});
