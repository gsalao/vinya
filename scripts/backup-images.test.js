import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcile, buildManifest } from './backup-images.mjs';
import { planRestore, contentTypeFor, findBackupDir } from './restore-images.mjs';

const file = (name, size) => ({ name, metadata: { size } });

describe('reconcile', () => {
	it('names files nothing references, which are what to delete when storage fills', () => {
		const r = reconcile(['a-2200.jpg', 'old-2200.jpg'], new Set(['a-2200.jpg']));
		expect(r.orphans).toEqual(['old-2200.jpg']);
		expect(r.missing).toEqual([]);
	});

	// A referenced file with nothing behind it is a broken image on the live
	// site — visible to visitors, and invisible in every dashboard.
	it('names references with no file behind them', () => {
		const r = reconcile(['a-2200.jpg'], new Set(['a-2200.jpg', 'gone-2200.jpg']));
		expect(r.missing).toEqual(['gone-2200.jpg']);
	});

	it('reports nothing when storage and content agree', () => {
		expect(reconcile(['a.jpg'], new Set(['a.jpg']))).toEqual({ orphans: [], missing: [] });
	});
});

describe('buildManifest', () => {
	it('records what was taken, sorted so two months diff cleanly', () => {
		const m = buildManifest({
			files: [file('b.jpg', 20), file('a.jpg', 10)],
			orphans: [],
			missing: [],
			takenAt: '2026-09-01T00:00:00.000Z'
		});
		expect(m.count).toBe(2);
		expect(m.bytes).toBe(30);
		expect(m.files.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
		expect(m.takenAt).toBe('2026-09-01T00:00:00.000Z');
	});
});

describe('planRestore', () => {
	it('uploads what storage is missing', () => {
		const plan = planRestore([{ name: 'a.jpg', size: 10 }], []);
		expect(plan.missing).toEqual(['a.jpg']);
	});

	it('skips files already identical, so a restore is cheap to re-run', () => {
		const plan = planRestore([{ name: 'a.jpg', size: 10 }], [file('a.jpg', 10)]);
		expect(plan).toEqual({ missing: [], differing: [], identical: ['a.jpg'] });
	});

	// The dangerous case: storage holds a newer photo than the backup. Applying
	// would replace it with the older one, so it is separated out and warned
	// about rather than folded in with the rest.
	it('separates files that have changed since the backup', () => {
		const plan = planRestore([{ name: 'a.jpg', size: 10 }], [file('a.jpg', 99)]);
		expect(plan.differing).toEqual(['a.jpg']);
		expect(plan.missing).toEqual([]);
	});
});

describe('contentTypeFor', () => {
	it('maps the types the uploader writes', () => {
		expect(contentTypeFor('a-2200.jpg')).toBe('image/jpeg');
		expect(contentTypeFor('a-2200.webp')).toBe('image/webp');
		expect(contentTypeFor('a.PNG')).toBe('image/png');
		expect(contentTypeFor('logo.svg')).toBe('image/svg+xml');
	});

	// Guessing wrong here would make Supabase serve an image as something the
	// browser refuses to render.
	it('falls back rather than guessing for an unknown extension', () => {
		expect(contentTypeFor('notes.txt')).toBe('application/octet-stream');
	});
});

describe('findBackupDir', () => {
	// Two sibling directories on disk, so the ambiguity case has something real
	// to scan; which of them "has images" is decided by the injected predicate.
	const FIXTURE = mkdtempSync(join(tmpdir(), 'vinya-restore-'));
	mkdirSync(join(FIXTURE, 'nested'), { recursive: true });
	mkdirSync(join(FIXTURE, 'other'), { recursive: true });

	// unzip -d recovered  =>  recovered/images
	it('accepts a directory that holds images directly', () => {
		expect(findBackupDir(FIXTURE, (p) => p === `${FIXTURE}/images`)).toBe(FIXTURE);
	});

	// gh run download -D recovered  =>  recovered/<artifact-name>/images
	it('descends one level, which is where gh run download puts it', () => {
		const has = (p) => p === `${FIXTURE}/nested/images`;
		expect(findBackupDir(FIXTURE, has)).toBe(`${FIXTURE}/nested`);
	});

	// Picking one silently could restore the wrong month.
	it('refuses to guess between two candidates', () => {
		expect(findBackupDir(FIXTURE, (p) => p.endsWith('/images') && p !== `${FIXTURE}/images`)).toBe(null);
	});

	it('returns null when there is no backup anywhere', () => {
		expect(findBackupDir(FIXTURE, () => false)).toBe(null);
	});
});
