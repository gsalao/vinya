<script>
	import { subscribeEmail } from '$lib/supabase.js';
	let email = $state('');
	let note = $state('');
	let busy = $state(false);

	async function join() {
		if (!email || busy) return;
		busy = true;
		const res = await subscribeEmail(email);
		if (!res.ok) {
			note = 'Something went wrong. Please try again.';
		} else if (res.simulated) {
			// Same rule as the booking form: no backend means no signup, so say so.
			note = 'Prototype mode. No mailing list is connected yet, so nothing was saved.';
		} else {
			note = "You're on the list. Nothing else will land in your inbox.";
			email = '';
		}
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
			<a href="/classes#faq">First-timer FAQ</a><a href="/classes#prices">Passes &amp; prices</a><a href="/about#find-us">Find us</a>
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
	</div>
</footer>
