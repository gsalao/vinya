import { describe, it, expect } from 'vitest';
import { listAll, totalBytes, referencedNames, variantsOf, PAGE } from './storage.mjs';

/** A bucket that pages exactly the way Supabase Storage does. */
function fakeBucket(names) {
	const files = names.map((name, i) => ({ name, metadata: { size: (i + 1) * 1000 } }));
	const calls = [];
	return {
		calls,
		db: {
			storage: {
				from: () => ({
					list: async (_path, { limit, offset }) => {
						calls.push({ limit, offset });
						return { data: files.slice(offset, offset + limit), error: null };
					}
				})
			}
		}
	};
}

describe('listAll', () => {
	it('returns everything in a single short page', async () => {
		const { db } = fakeBucket(['a.jpg', 'b.jpg']);
		expect((await listAll(db, 'site-images')).map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
	});

	// The failure this exists to stop: one .list() call returns 100 rows, the
	// backup writes 100 files, and reports success while silently omitting the
	// rest. A backup that is quietly partial is worse than none, because it is
	// trusted.
	it('pages past the API limit instead of stopping at the first page', async () => {
		const names = Array.from({ length: PAGE * 2 + 7 }, (_, i) => `img-${i}.jpg`);
		const { db, calls } = fakeBucket(names);

		const all = await listAll(db, 'site-images');

		expect(all).toHaveLength(names.length);
		expect(all.at(-1).name).toBe(names.at(-1));
		expect(calls.length).toBe(3);
		expect(calls.map((c) => c.offset)).toEqual([0, PAGE, PAGE * 2]);
	});

	it('stops cleanly on an empty bucket', async () => {
		const { db } = fakeBucket([]);
		expect(await listAll(db, 'site-images')).toEqual([]);
	});

	it('raises rather than silently returning a partial list', async () => {
		const db = {
			storage: { from: () => ({ list: async () => ({ data: null, error: { message: 'denied' } }) }) }
		};
		await expect(listAll(db, 'site-images')).rejects.toThrow(/denied/);
	});

	it('ignores folder placeholders, which carry no size', async () => {
		const db = {
			storage: {
				from: () => ({
					list: async (_p, { offset }) =>
						offset === 0
							? { data: [{ name: 'a.jpg', metadata: { size: 10 } }, { name: '.emptyFolderPlaceholder' }], error: null }
							: { data: [], error: null }
				})
			}
		};
		expect((await listAll(db, 'b')).map((f) => f.name)).toEqual(['a.jpg']);
	});
});

describe('totalBytes', () => {
	it('sums sizes', () => {
		expect(totalBytes([{ metadata: { size: 10 } }, { metadata: { size: 5 } }])).toBe(15);
	});
	it('treats a missing size as zero rather than NaN', () => {
		expect(totalBytes([{ metadata: {} }, { metadata: { size: 5 } }, {}])).toBe(5);
	});
});

describe('referencedNames', () => {
	const url = (n) => `https://x.supabase.co/storage/v1/object/public/site-images/${n}`;

	it('finds names wherever they sit in the content tree', () => {
		const content = {
			images: { hero: { src: url('hero-2200.jpg'), srcset: `${url('hero-1400.jpg')} 1400w` } },
			teachers: [{ photo: url('nikita-2200.jpg') }],
			copy: { 'home.title': 'Not a URL' }
		};
		expect([...referencedNames(content)].sort()).toEqual(['hero-1400.jpg', 'hero-2200.jpg', 'nikita-2200.jpg']);
	});

	it('ignores local files, which live in the repo and are not backed up here', () => {
		expect([...referencedNames({ a: '/photos/studio-2200.jpg' })]).toEqual([]);
	});

	it('strips query strings and decodes escaped names', () => {
		expect([...referencedNames({ a: url('a%20b.jpg?width=10') })]).toEqual(['a b.jpg']);
	});

	it('survives nulls and numbers in the tree', () => {
		expect([...referencedNames({ a: null, b: 3, c: [null, url('x.jpg')] })]).toEqual(['x.jpg']);
	});
});

describe('variantsOf', () => {
	it('expands a primary into the four names the uploader writes', () => {
		expect(variantsOf('hero-2200.jpg')).toEqual([
			'hero-2200.jpg',
			'hero-1400.jpg',
			'hero-2200.webp',
			'hero-1400.webp'
		]);
	});
	it('leaves a single-variant name alone', () => {
		expect(variantsOf('logo.svg')).toEqual(['logo.svg']);
	});
});

describe('referencedNames, srcset', () => {
	const url = (n) => `https://x.supabase.co/storage/v1/object/public/site-images/${n}`;

	// The bug this pins: taking everything after the marker swallowed the width
	// descriptor and stopped at the first URL, so a restore built from these
	// names would have been missing most variants.
	it('reads every URL in a multi-entry srcset, without their descriptors', () => {
		const srcset = `${url('a-1400.jpg')} 1400w, ${url('a-2200.jpg')} 2200w`;
		expect([...referencedNames({ srcset })].sort()).toEqual(['a-1400.jpg', 'a-2200.jpg']);
	});
});
