#!/usr/bin/env node
// Puts a backup back.
//
// The important thing to understand before using it: the site does not need to
// be told. Content stores each photo as a full URL ending in its filename, so
// re-uploading under the same names makes every existing reference resolve
// again — no edit, no publish, no deploy. That is a consequence of the naming
// convention shape.mjs already relies on, and it is why the restore is this
// short.
//
// Dry run by default. Restoring writes over live files, and a backup restored
// on top of newer photos is itself data loss, so the destructive form has to be
// asked for: `--apply`.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './lib/db.mjs';
import { listAll } from './lib/storage.mjs';

const BUCKET = 'site-images';

const TYPES = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml'
};

export const contentTypeFor = (name) => TYPES[name.slice(name.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';

/** What a restore would change, decided before anything is written.
 *
 *  Split three ways because the three mean different things: `missing` is what
 *  the restore exists to fix, `differing` is a file that changed since the
 *  backup and so is the one that could destroy newer work, and `identical` is
 *  work not worth doing. */
export function planRestore(backupFiles, storedFiles) {
	const stored = new Map(storedFiles.map((f) => [f.name, f.metadata?.size]));
	const plan = { missing: [], differing: [], identical: [] };
	for (const f of backupFiles) {
		if (!stored.has(f.name)) plan.missing.push(f.name);
		else if (stored.get(f.name) !== f.size) plan.differing.push(f.name);
		else plan.identical.push(f.name);
	}
	return plan;
}

async function main() {
	const args = process.argv.slice(2);
	const apply = args.includes('--apply');
	const dir = args.find((a) => !a.startsWith('--')) || 'backup';
	const imageDir = join(dir, 'images');

	if (!existsSync(imageDir)) {
		console.error(`No images directory at ${imageDir}. Point this at an unpacked backup.`);
		process.exit(1);
	}

	const manifestPath = join(dir, 'manifest.json');
	if (existsSync(manifestPath)) {
		const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
		console.log(`Backup taken ${m.takenAt}, ${m.count} file(s).\n`);
	}

	const backupFiles = readdirSync(imageDir)
		.filter((n) => !n.startsWith('.'))
		.map((name) => ({ name, size: statSync(join(imageDir, name)).size }));

	const db = client();
	const plan = planRestore(backupFiles, await listAll(db, BUCKET));

	console.log(`${plan.missing.length} to upload, ${plan.differing.length} that differ, ${plan.identical.length} already identical.`);
	plan.missing.forEach((n) => console.log(`  + ${n}`));
	plan.differing.forEach((n) => console.log(`  ~ ${n} (storage has a different version)`));

	if (!apply) {
		console.log('\nDry run. Nothing was written. Re-run with --apply to upload.');
		if (plan.differing.length) {
			console.log('Note: the files marked ~ have changed since this backup. Applying replaces them with the older copy.');
		}
		return;
	}

	const targets = [...plan.missing, ...plan.differing];
	for (const name of targets) {
		const body = readFileSync(join(imageDir, name));
		const { error } = await db.storage.from(BUCKET).upload(name, body, {
			contentType: contentTypeFor(name),
			upsert: true,
			cacheControl: '31536000'
		});
		if (error) throw new Error(`Could not upload ${name}: ${error.message}`);
		console.log(`  restored ${name}`);
	}

	console.log(`\nRestored ${targets.length} file(s).`);
	console.log('The site needs no change: its URLs contain these filenames, so they resolve again as they are.');
	console.log('Supabase serves images with a long cache header, so a replaced file can take time to appear for someone who saw the broken one.');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) await main();
