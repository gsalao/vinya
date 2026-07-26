// Pinned rather than adapter-auto: adapter-auto resolves the platform adapter by
// running an install *during* the build, which is exactly what a CI job with a
// frozen lockfile should not be doing.
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Pin the runtime. Left unset, adapter-vercel infers it from the Node version
		// of whatever machine ran the build, so a CI runner on a different Node would
		// ship a different serverless runtime than a local `vercel --prod`.
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};

export default config;
