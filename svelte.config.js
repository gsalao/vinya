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
		adapter: adapter({ runtime: 'nodejs22.x' }),

		// The passes section renders Tikkie payment links and their QR codes. A QR
		// is unreadable by eye, so anything that can inject markup into this page
		// can swap in a code that sends money elsewhere and nobody would see it.
		// This is the control that makes that injection hard in the first place;
		// the visible tikkie.me URL next to each code is the backstop for when a
		// visitor wants to check for themselves.
		csp: {
			// 'auto' hashes SvelteKit's own inline hydration script. Vercel Analytics
			// and Speed Insights load from va.vercel-scripts.com, so that host has to
			// be named or the site ships without either.
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self', 'https://va.vercel-scripts.com'],
				'connect-src': ['self', 'https://va.vercel-scripts.com', 'https://*.supabase.co'],
				// Inline styles are used throughout the markup; removing them is a
				// separate job from shipping payments, so this stays permissive and
				// honest rather than silently broken.
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self'],
				// The About page embeds the venue map (google.com/maps?output=embed).
				// Without this, frame-src falls back to default-src 'self' and the
				// map renders as an empty box. Scoped to that one host: nothing else
				// on the site is allowed to frame a third party.
				'frame-src': ['https://www.google.com'],
				// Payment happens on tikkie.me, so form posts and framing stay off
				// this origin entirely.
				'form-action': ['self'],
				'frame-ancestors': ['none'],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		}
	}
};

export default config;
