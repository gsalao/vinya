<script>
	import { subscribeEmail } from '$lib/supabase.js';
	let email = $state('');
	let note = $state('No more than once a month.');
	let busy = $state(false);

	async function join() {
		if (!email || busy) return;
		busy = true;
		const res = await subscribeEmail(email);
		note = res.ok
			? "You're on the list. Nothing else will land in your inbox."
			: 'Something went wrong. Please try again.';
		if (res.ok) email = '';
		busy = false;
	}
</script>

<footer>
	<div class="wrap foot-grid">
		<div>
			<div class="foot-brand"><img src="/logos/vinya-logo-cream.png" alt="Vinya" /></div>
			<p>Breathe. Connect. Bloom.</p>
		</div>
		<div class="foot-col">
			<div class="h">Site</div>
			<a href="/">Home</a><a href="/classes">Classes</a><a href="/teachers">Teachers</a><a href="/events">Events</a><a href="/about">About</a>
		</div>
		<div class="foot-col">
			<div class="h">Practical</div>
			<a href="/classes">First-timer FAQ</a><a href="/classes">Passes &amp; prices</a><a href="/about">Find us</a>
		</div>
		<div class="foot-col">
			<div class="h">Stay close</div>
			<p style="max-width:32ch">A quiet note when a new month of events opens. Nothing else.</p>
			<div class="sub">
				<input placeholder="you@email.com" aria-label="Email" bind:value={email} onkeydown={(e) => e.key === 'Enter' && join()} />
				<button class="btn btn-primary sm" onclick={join} disabled={busy}>Join</button>
			</div>
			<p style="font-size:12px;color:var(--tan-400);margin-top:14px">{note}</p>
		</div>
	</div>
	<div class="wrap foot-bottom">
		<span>© 2026 Vinya Yoga</span>
		<span>Prototype · content placeholders throughout</span>
	</div>
</footer>
