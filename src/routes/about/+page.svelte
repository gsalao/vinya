<script>
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import { openBooking } from '$lib/booking.js';
	import { venue } from '$lib/data.js';
</script>

<svelte:head><title>About — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="eyebrow">About Vinya</div>
		<h1>A yoga space with room to breathe.</h1>
	</div>
</section>

<section class="sec" style="padding-top:clamp(56px,7vh,80px)">
	<div class="wrap split" style="align-items:start">
		<div class="reveal" use:reveal>
			<p class="lede" style="font-size:var(--text-lg);line-height:1.75;color:var(--brown-700)">Vinya is a yoga inspired initiative in the Netherlands. Most people who find us are somewhere in the middle of: a change, a tiredness, a hesitation they can't name or ready to step out of their comfort zone. Either you're ready to work on your physical and mental state.
</p>
			<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:28px">The practice sits in two places at once: The physical and the mental. Breathe is rarely just breathe. It's the beginning of changing the narrative. Using it as a tool to control our mind, so we are choosing who we become.
</p>
			<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:22px">Vinya is just creating a space for you to make space for yourself. </p>
			<div class="about-cards">
				<div class="spec"><h4>How we teach</h4><p>Personal attention is our non negotiable. There are hands-on adjustments and deepening, if consent has been given.
</p></div>
				<div class="spec"><h4>Who it's for</h4><p>Complete beginners, and regulars who want to deepen their practice.
</p></div>
				<div class="spec"><h4>Training</h4><p>Teaching hours and certifications, to be confirmed and listed here.</p></div>
				<div class="spec"><h4>Beyond class</h4><p>1:1 holistic sessions, private groups, and retreats a few times a year.</p></div>
			</div>
			<div style="display:flex;gap:14px;margin-top:48px;flex-wrap:wrap">
				<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 session</button>
				<a class="btn btn-secondary" href="/classes">See the timetable</a>
			</div>
		</div>
		<div class="reveal" use:reveal style="display:flex;flex-direction:column;gap:24px;position:sticky;top:104px">
			<div class="media" style="border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-card);aspect-ratio:4/5"><Ph cap="The studio" tone="sky" /></div>
			<div class="side-card">
				<div class="k">Find us</div>
				<div class="row">
					<span>{venue.name} · {venue.address}</span>
					<span>Instagram @vinya (to confirm)</span>
					<span>hello@vinya.yoga (placeholder)</span>
				</div>
			</div>
		</div>
	</div>
</section>
