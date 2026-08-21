#!/usr/bin/env node
// Copies the image bucket to disk.
//
// Content needs no backup: every publish is a commit, so git history already
// holds every word the site has ever shown. Uploaded photos are the gap. They
// deliberately never enter the repository — eleven images were already 7 MB and
// git never forgets — which means deleting one deletes it, permanently.
//
// Run monthly from .github/workflows/backup-images.yml, which keeps the result
// as a workflow artifact. Restore with scripts/restore-images.mjs.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { client } from './lib/db.mjs';
import { listAll, totalBytes, referencedNames } from './lib/storage.mjs';

const BUCKET = 'site-images';
const CONTENT = 'src/lib/content.generated.json';

/** Splits the bucket against what the site actually points at.
 *
 *  `orphans` are files nothing references — usually a photo replaced before the
 *  uploader learned to delete the old variants. They are the first thing to
 *  remove when the bucket fills, and the reason this is worth computing rather
 *  than just counting bytes.
 *
 *  `missing` are references with no file behind them: a broken image on the
 *  live site, which nobody would otherwise notice until a visitor did. */
export function reconcile(storedNames, referenced) {
	const stored = new Set(storedNames);
	return {
		orphans: [...stored].filter((n) => !referenced.has(n)).sort(),
		missing: [...referenced].filter((n) => !stored.has(n)).sort()
	};
}

export function buildManifest({ files, orphans, missing, takenAt = new Date().toISOString() }) {
	return {
		takenAt,
		bucket: BUCKET,
		count: files.length,
		bytes: totalBytes(files),
		// Sorted so two manifests taken a month apart diff cleanly.
		files: files.map((f) => ({ name: f.name, size: f.metadata.size })).sort((a, b) => a.name.localeCompare(b.name)),
		orphans,
		missing
	};
}

async function main() {
	const outDir = process.argv[2] || 'backup';
	const imageDir = join(outDir, 'images');
	mkdirSync(imageDir, { recursive: true });

	const db = client();
	const files = await listAll(db, BUCKET);

	if (files.length === 0) {
		console.log(`The ${BUCKET} bucket is empty. Nothing to back up.`);
	}

	let written = 0;
	for (const file of files) {
		const { data, error } = await db.storage.from(BUCKET).download(file.name);
		if (error) throw new Error(`Could not download ${file.name}: ${error.message}`);
		writeFileSync(join(imageDir, file.name), Buffer.from(await data.arrayBuffer()));
		written++;
	}

	const referenced = existsSync(CONTENT)
		? referencedNames(JSON.parse(readFileSync(CONTENT, 'utf8')), BUCKET)
		: new Set();
	const { orphans, missing } = reconcile(files.map((f) => f.name), referenced);
	const manifest = buildManifest({ files, orphans, missing });

	writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, '\t')}\n`);

	const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
	console.log(`Backed up ${written} file(s), ${mb(manifest.bytes)}, to ${outDir}/`);
	if (orphans.length) {
		console.log(`\n${orphans.length} file(s) nothing on the site references — delete these first if storage fills:`);
		orphans.forEach((n) => console.log(`  ${n}`));
	}
	if (missing.length) {
		// A live broken image. Worth shouting about: it is visible to visitors.
		console.log(`\n::warning::${missing.length} image(s) the site points at are not in storage:`);
		missing.forEach((n) => console.log(`  ${n}`));
	}

	if (process.env.GITHUB_STEP_SUMMARY) {
		const { appendFileSync } = await import('node:fs');
		appendFileSync(
			process.env.GITHUB_STEP_SUMMARY,
			`### Image backup\n\n- ${written} file(s), ${mb(manifest.bytes)}\n- ${orphans.length} unreferenced\n- ${missing.length} referenced but missing\n`
		);
	}
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();
