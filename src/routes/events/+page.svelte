<script>
	import { reveal } from '$lib/reveal.js';
	import { openBooking } from '$lib/booking.js';
	import { events, eventLabel } from '$lib/data.js';
	import { txt } from '$lib/copy.js';

	let archiveOpen = $state(false);
</script>

<svelte:head><title>Events: Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="eyebrow">{txt('events.hero.eyebrow')}</div>
		<h1>{txt('events.hero.title')}</h1>
		<p>{txt('events.hero.body')}</p>
	</div>
</section>

<section class="sec" style="padding-top:clamp(40px,5vh,64px)">
	<div class="wrap">
		{#each events as g}
			<div class="ev-head"><h2>{g.month}</h2><div class="line"></div><span class="n">{g.n}</span></div>
			{#each g.items as e}
				<div class="ev reveal" use:reveal>
					<div class="cal"><div class="d">{e.d}</div><div class="w">{e.w}</div></div>
					<div class="info"><h3>{e.name}</h3><div class="det">{e.det}</div><p>{e.p}</p></div>
					<div class="act">
						<button class="btn btn-primary" onclick={() => openBooking(eventLabel(e, g))}>{txt('events.reserve')}</button>
						<span class="rem">{e.rem}</span>
					</div>
				</div>
			{/each}
		{/each}
	</div>

	<div class="wrap">
		<button class="archive-toggle" onclick={() => (archiveOpen = !archiveOpen)}>
			<span class="lbl">{txt('events.archive.label')}</span><span class="line"></span><span class="a">{archiveOpen ? 'Hide' : 'Show 3'}</span>
		</button>
		<div class="archive" class:open={archiveOpen}>
			<div class="arch-row"><span class="dt">26 Jul</span><span class="nm">Breathwork Circle</span><span class="st">Full</span></div>
			<div class="arch-row"><span class="dt">12 Jul</span><span class="nm">Solstice Slow Flow</span><span class="st">Full</span></div>
			<div class="arch-row"><span class="dt">14 Jun</span><span class="nm">Bloom Series I · three evenings</span><span class="st">Ran twice</span></div>
		</div>
	</div>
</section>
