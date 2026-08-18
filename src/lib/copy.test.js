import { describe, it, expect } from 'vitest';
import { paras, txt } from './copy.js';

describe('paras', () => {
	// The owner writes long passages in one cell using Alt+Enter. She should not
	// have to know whether one line break or two makes a new paragraph.
	it('splits on a single newline', () => {
		expect(paras('One.\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('splits on a blank line', () => {
		expect(paras('One.\n\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('handles Windows line endings', () => {
		expect(paras('One.\r\nTwo.')).toEqual(['One.', 'Two.']);
	});

	it('trims each paragraph and drops empties', () => {
		expect(paras('  One.  \n\n\n   \n  Two.  ')).toEqual(['One.', 'Two.']);
	});

	it('returns a single paragraph unchanged', () => {
		expect(paras('Just the one.')).toEqual(['Just the one.']);
	});

	it('returns an empty array rather than throwing on nullish input', () => {
		expect(paras(undefined)).toEqual([]);
		expect(paras(null)).toEqual([]);
		expect(paras('')).toEqual([]);
	});
});

describe('txt', () => {
	it('returns the string for a known key', () => {
		expect(txt('home.hero.title')).toBe(
			'Breathe through the hesitation. Bloom into who you already are.'
		);
	});

	// A deleted sheet row must not blank a headline on a live page. Throwing here
	// is what turns that into a build failure in Task 4.
	it('throws on an unknown key, naming it', () => {
		expect(() => txt('home.hero.nonexistent')).toThrow('home.hero.nonexistent');
	});
});
