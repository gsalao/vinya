import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Importing this module is itself part of what this test proves: sync-content.mjs
// reads the network and writes to disk (readTabs, writeFileSync), and this suite
// runs with no GOOGLE_SA_KEY set. If the sync ran on import rather than only when
// the file is invoked directly, loading this test file would throw or hang before
// a single "it" ran. That every test below executes at all is the proof.
import { missingFiles } from './sync-content.mjs';

// The fixture is the real, committed content.generated.json — the same file
// shape.test.js round-trips against — so this is checked against the actual
// static/ directory rather than a hand-picked stand-in that could drift from it.
const CONTENT_PATH = fileURLToPath(new URL('../src/lib/content.generated.json', import.meta.url));
const content = JSON.parse(readFileSync(CONTENT_PATH, 'utf8'));

describe('missingFiles', () => {
	it('reports nothing for the real content: every teacher photo and partner logo it references exists under static/', () => {
		expect(missingFiles(content)).toEqual([]);
	});

	it('reports a teacher photo path that does not exist on disk', () => {
		const fake = {
			...content,
			teachers: [{
				photo: {
					src: '/images/does-not-exist-2200.jpg',
					srcset: '/images/does-not-exist-1400.jpg 1400w, /images/does-not-exist-2200.jpg 2200w',
					srcsetWebp: '/images/does-not-exist-1400.webp 1400w, /images/does-not-exist-2200.webp 2200w'
				}
			}],
			partners: []
		};
		expect(missingFiles(fake).sort()).toEqual([
			'/images/does-not-exist-1400.jpg',
			'/images/does-not-exist-1400.webp',
			'/images/does-not-exist-2200.jpg',
			'/images/does-not-exist-2200.webp'
		]);
	});

	it('reports a partner logo path that does not exist on disk', () => {
		const fake = { ...content, teachers: [], partners: [{ name: 'Ghost', logo: '/partner-logos/does-not-exist.svg' }] };
		expect(missingFiles(fake)).toEqual(['/partner-logos/does-not-exist.svg']);
	});

	it('reports only the missing path, not the real ones sitting alongside it', () => {
		const fake = {
			...content,
			teachers: [content.teachers[0]],
			partners: [...content.partners, { name: 'Ghost', logo: '/partner-logos/does-not-exist.svg' }]
		};
		expect(missingFiles(fake)).toEqual(['/partner-logos/does-not-exist.svg']);
	});
});
