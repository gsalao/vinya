<script>
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import { openBooking } from '$lib/booking.js';
</script>

<svelte:head><title>About — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="eyebrow">About the studio</div>
		<h1>A yoga space with room to breathe.</h1>
	</div>
</section>

<section class="sec" style="padding-top:clamp(56px,7vh,80px)">
	<div class="wrap split" style="align-items:start">
		<div class="reveal" use:reveal>
			<p class="lede" style="font-size:var(--text-lg);line-height:1.75;color:var(--brown-700)">Vinya is a small studio in the Netherlands, and we teach slowly. Most people who find us are somewhere in the middle of something: a change, a tiredness, a hesitation they can't name.</p>
			<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:28px">The practice sits in two places at once: movement, and the body's quieter systems. Breath is rarely just breath. It's where the story is held, and nobody gets hurried out of it. So a class here tends to have fewer poses and longer pauses than you might expect.</p>
			<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:22px">Vinya means what we believe: we become connected because we bloom, and blooming is endless. There is no finished version of you waiting at the end of a ten-class pass.</p>
			<div class="about-cards">
				<div class="spec"><h4>How we teach</h4><p>Invitations, not instructions. You'll always be offered a way out of a shape as clearly as a way in.</p></div>
				<div class="spec"><h4>Who it's for</h4><p>Complete beginners, returning bodies, and regulars who want to slow down rather than level up.</p></div>
				<div class="spec"><h4>Training</h4><p>Teaching hours and certifications, to be confirmed and listed here.</p></div>
				<div class="spec"><h4>Beyond class</h4><p>1:1 holistic sessions, private groups, and retreats a few times a year.</p></div>
			</div>
			<div style="display:flex;gap:14px;margin-top:48px;flex-wrap:wrap">
				<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 session</button>
				<a class="btn btn-secondary" href="/classes">See the timetable</a>
			</div>
		</div>
		<div class="reveal" use:reveal style="display:flex;flex-direction:column;gap:24px;position:sticky;top:104px">
			<div class="media" style="border-radius:var(--radius-lg);overflow:hidden;box-shadow:var(--shadow-card);aspect-ratio:4/5"><Ph cap="The studio" tone="sage" /></div>
			<div class="side-card">
				<div class="k">Find us</div>
				<div class="row">
					<span>Studio location, to confirm</span>
					<span>Instagram @vinya (to confirm)</span>
					<span>hello@vinya.yoga (placeholder)</span>
				</div>
			</div>
		</div>
	</div>
</section>
