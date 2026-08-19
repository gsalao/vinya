<script>
	import { subscribeEmail } from '$lib/supabase.js';
	import { txt } from '$lib/copy.js';
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
			<p>{txt('footer.tagline')}</p>
		</div>
		<div class="foot-col">
			<div class="h">{txt('footer.site.heading')}</div>
			<a href="/">Home</a><a href="/classes">Classes</a><a href="/teachers">Teachers</a><a href="/events">Events</a><a href="/about">About</a>
		</div>
		<div class="foot-col">
			<div class="h">{txt('footer.practical.heading')}</div>
			<a href="/classes#faq">{txt('footer.practical.faq')}</a><a href="/classes#prices">{txt('footer.practical.prices')}</a><a href="/about#find-us">{txt('footer.practical.find')}</a>
		</div>
		<div class="foot-col">
			<div class="h">{txt('footer.subscribe.heading')}</div>
			<p style="max-width:32ch">{txt('footer.subscribe.body')}</p>
			<div class="sub">
				<input placeholder={txt('footer.subscribe.placeholder')} aria-label="Email" bind:value={email} onkeydown={(e) => e.key === 'Enter' && join()} />
				<button class="btn btn-primary sm" onclick={join} disabled={busy}>{txt('footer.subscribe.cta')}</button>
			</div>
			<p style="font-size:12px;color:var(--tan-400);margin-top:14px">{note}</p>
		</div>
	</div>
	<div class="wrap foot-bottom">
		<span>{txt('footer.copyright')}</span>
	</div>
</footer>
