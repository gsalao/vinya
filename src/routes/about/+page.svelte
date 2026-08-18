<script>
	import { reveal } from '$lib/reveal.js';
	import Photo from '$lib/components/Photo.svelte';
	import { openBooking } from '$lib/booking.js';
	import { providers } from '$lib/data.js';
	import { txt, paras } from '$lib/copy.js';

	const venues = Object.values(providers);
	const query = (v) => encodeURIComponent(`${v.name} ${v.address}`);
	const mapsUrl = (v) => `https://www.google.com/maps/search/?api=1&query=${query(v)}`;
	// `output=embed` is the keyless embed: it pans and zooms like the real map, so
	// no Maps JavaScript API key (and no billing account) is needed for a preview.
	const embedUrl = (v) => `https://www.google.com/maps?q=${query(v)}&output=embed`;
</script>

<svelte:head><title>About: Vinya Yoga</title></svelte:head>

<!-- 1. About Vinya. The heading sits inside the left column rather than above the
     split, which buys the photo the vertical room to fill its own column: both
     sides then land at roughly the same height, centred against each other, and
     the whole thing still stops at the fold. -->
<section class="sec about-hero">
	<div class="wrap split about-split">
		<div class="reveal" use:reveal>
			<div class="eyebrow">{txt('about.hero.eyebrow')}</div>
			<h1>{txt('about.hero.title')}</h1>
			<p class="lede" style="font-size:var(--text-lg);line-height:1.75;color:var(--brown-700);margin-top:34px">{txt('about.hero.lede')}</p>
			{#each paras(txt('about.hero.body')) as p, i (i)}
				<p style="font-size:var(--text-base);line-height:1.9;color:var(--text-secondary);margin-top:{i === 0 ? 26 : 22}px">{p}</p>
			{/each}
		</div>
		<div class="media reveal" use:reveal>
			<Photo
				src="/images/vinya-studio-b.jpeg"
				alt="An evening kirtan in the hall, musicians on the low stage under warm lights"
				fx={50}
				fy={52}
				fyMobile={60}
			/>
		</div>
	</div>
</section>

<!-- 2. The four specifics, as a row in the shape of the home page triptych -->
<section class="sec sunken">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal style="text-align:center;margin-left:auto;margin-right:auto">
			<div class="eyebrow">{txt('about.expect.eyebrow')}</div>
			<h2 style="margin-top:18px">{txt('about.expect.title')}</h2>
		</div>
		<div class="triptych quad">
			<div class="t reveal" use:reveal><div class="h">{txt('about.expect.1.title')}</div><p>{txt('about.expect.1.body')}</p></div>
			<div class="t reveal" use:reveal><div class="h">{txt('about.expect.2.title')}</div><p>{txt('about.expect.2.body')}</p></div>
			<div class="t reveal" use:reveal><div class="h">{txt('about.expect.3.title')}</div><p>{txt('about.expect.3.body')}</p></div>
			<div class="t reveal" use:reveal><div class="h">{txt('about.expect.4.title')}</div><p>{txt('about.expect.4.body')}</p></div>
		</div>
		<div class="reveal" use:reveal style="margin-top:56px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
			<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>{txt('about.expect.cta.book')}</button>
			<a class="btn btn-secondary" href="/classes">{txt('about.expect.cta.timetable')}</a>
		</div>
	</div>
</section>

<!-- 3. The founder. Mirror of section 1: photo on the left, story on the right. -->
<section class="sec">
	<div class="wrap split founder" style="align-items:start">
		<div class="media reveal" use:reveal>
			<Photo
				src="/images/nikita-standing-2200.jpg"
				srcset="/images/nikita-standing-1400.jpg 1400w, /images/nikita-standing-2200.jpg 2200w"
				srcsetWebp="/images/nikita-standing-1400.webp 1400w, /images/nikita-standing-2200.webp 2200w"
				sizes="(max-width:820px) 100vw, 46vw"
				alt="Nikita Coppens standing in natural light"
				fx={50}
				fy={20}
			/>
		</div>
		<div class="reveal" use:reveal>
			<div class="eyebrow">{txt('about.founder.eyebrow')}</div>
			<h2 style="margin-top:22px">{txt('about.founder.name')}</h2>
			<div class="role">{txt('about.founder.role')}</div>
			<p class="lede" style="margin-top:28px">Before starting Vinya, Nikita has been studying different forms of yoga in India, exploring the body, movement, breath and the connection between physical and mental wellbeing. After her studies, she travelled to Sri Lanka, where she taught yoga and continued to deepen her experience of working with the body.
</p>
			<p style="margin-top:22px">Before starting Vinya, Nikita has been studying different forms of yoga in India, exploring the body, movement, breath and the connection between physical and mental wellbeing. After her studies, she travelled to Sri Lanka, where she taught yoga and continued to deepen her experience of working with the body.
</p>
			<p style="margin-top:22px">Originally from Amsterdam, Nikita now lives and works there, bringing these different experiences together through Vinya. Through yoga, movement, breath and sound, she creates spaces where people can reconnect with their bodies and create more space for healing, awareness and connection.</p>
			<div style="margin-top:36px"><a class="tlink" href="/teachers">{txt('about.founder.link')} <span>→</span></a></div>
		</div>
	</div>
</section>

<!-- 4. Find us. `providers` in data.js was exported and never rendered, so the
     footer's "Find us" link had nowhere to land and the address appeared only
     inside a class detail overlay. -->
<section class="sec sunken" id="find-us">
	<div class="wrap wrap-narrow" style="text-align:center">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">{txt('about.find.divider')}</span><div class="line"></div></div>
		<h2 class="reveal" use:reveal style="font-size:var(--text-3xl);color:var(--brown-700);margin-top:48px">{txt('about.find.title')}</h2>
		<p class="reveal" use:reveal style="font-size:var(--text-base);line-height:1.85;color:var(--text-secondary);margin:22px auto 0;max-width:52ch">{txt('about.find.body')}</p>
		<div class="venues">
			{#each venues as v (v.name)}
				<div class="venue reveal" use:reveal>
					<div class="venue-copy">
						<div class="k">{v.name}</div>
						<p>{v.address}</p>
						<a class="tlink" href={mapsUrl(v)} target="_blank" rel="noopener noreferrer">{txt('about.find.maps')} <span>→</span></a>
					</div>
					<div class="venue-map">
						<iframe
							src={embedUrl(v)}
							title="Map showing {v.name}, {v.address}"
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
						></iframe>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<style>
	/* section 1 breathes to the fold, not past it */
	.about-hero {
		padding-top: clamp(36px, 5vh, 64px);
		padding-bottom: clamp(48px, 7vh, 88px);
	}
	.about-split {
		align-items: center;
	}
	.about-split h1 {
		font-size: clamp(28px, 3.9vw, 50px);
		line-height: 1.07;
		color: var(--brown-700);
		margin: 20px 0 0;
		max-width: 20ch;
	}
	/* fill the column, then take the height from that width. Capping the height
	   instead would hand the 4/5 ratio the width, which is what left the photo
	   sitting narrow and off to one side of its column. */
	.about-split .media {
		width: 100%;
	}

	/* triptych, four across */
	.quad {
		grid-template-columns: repeat(4, 1fr);
		gap: clamp(28px, 3.4vw, 56px);
	}

	.founder .media {
		aspect-ratio: 4 / 5;
		position: sticky;
		top: 104px;
	}
	.role {
		font-size: var(--text-sm);
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin-top: 12px;
	}

	/* auto-fit so a second venue sits beside the first instead of needing a new rule */
	.venues {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 20px;
		margin-top: clamp(40px, 5vw, 56px);
	}
	/* wrap, not a media query: the card's own width is what decides whether the
	   map fits beside the address, and that width depends on how many venues
	   share the row as much as it does on the viewport. Below ~600px of card the
	   two flex-basis floors can no longer both fit, so the map drops underneath. */
	.venue {
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		padding: clamp(22px, 2.4vw, 30px);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: clamp(20px, 2.4vw, 30px);
	}
	.venue-copy {
		flex: 1 1 240px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	/* aspect-ratio keeps it landscape at every width; max-height stops the ratio
	   from turning a wide card into a tall one on a big screen. */
	.venue-map {
		flex: 1 1 320px;
		aspect-ratio: 16 / 10;
		max-height: 260px;
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--border-subtle);
	}
	.venue-map iframe {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.venue .k {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		color: var(--brown-700);
	}
	.venue p {
		font-size: var(--text-sm);
		line-height: 1.7;
		color: var(--text-secondary);
		max-width: 30ch;
	}

	@media (max-width: 1000px) {
		.quad {
			grid-template-columns: 1fr 1fr;
			gap: 0 clamp(28px, 4vw, 48px);
		}
	}
	@media (max-width: 820px) {
		/* the h1 lives in the copy column now, so the stacked order has to keep the
		   title first: the global .split rule would float the photo above it */
		.about-split .media {
			order: 0;
			margin-top: 8px;
		}
		/* relative, never static: Photo is absolutely positioned with inset:0, so
		   taking the containing block away lets it stretch over the whole story */
		.founder .media {
			position: relative;
			top: auto;
			width: 100%;
			max-width: 420px;
			margin-inline: auto;
		}
	}
	@media (max-width: 560px) {
		.quad {
			grid-template-columns: 1fr;
			gap: 0;
		}
	}
</style>
