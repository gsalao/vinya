<script>
	import { reveal } from '$lib/reveal.js';
	import Photo from '$lib/components/Photo.svelte';
	import { openBooking } from '$lib/booking.js';
	import { classes, partners, events, eventLabel, testimonials } from '$lib/data.js';
	import { txt } from '$lib/copy.js';

	// The band below shows the next gathering. Its copy is written out here, but the
	// booking label is taken from the events data so it always matches the picker.
	const nextGathering = eventLabel(events[0].items[0], events[0]);

	// The band shows events[0].items[0]. Its date chip, title and body all come from
	// that one object, so a sheet edit to the event cannot leave this section stale —
	// which is exactly what happened while both were kept by hand.
	const next = events[0].items[0];
	const nextMonth = events[0].month.slice(0, 3);

	let openTip = $state(null);
	function toggleTip(i) {
		openTip = openTip === i ? null : i;
	}
</script>

<svelte:head><title>Vinya Yoga</title></svelte:head>

<!-- HERO (copy | seam: braided vine + image edge in one SVG | image) -->
<section class="hero">
	<div class="hero-copy">
		<div class="hero-copy-inner">
			<img class="hero-logo" src="/logos/vinya-logo-brown.png" alt="Vinya — Breathe, Connect, Bloom" />
			<h1>{txt('home.hero.title')}</h1>
			<div class="hero-cta">
				<button class="btn btn-primary lg" onclick={() => openBooking('a class')}>{txt('home.hero.cta.book')}</button>
				<a class="btn btn-ghost lg" href="/events">{txt('home.hero.cta.events')}</a>
			</div>
		</div>
	</div>

	<!-- horizontal seam (mobile): sits between copy and image.
	     seam-fill's lower edge IS the image edge (wave about y=150, controls ±26).
	     Both strands braid around a centreline at y=98 that rides the SAME wave,
	     so the vine stays parallel to the image with a constant gap. -->
	<svg class="hero-seam-h" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
		<defs>
			<clipPath id="vine-h-a" clipPathUnits="userSpaceOnUse"><rect class="vine-wipe h" x="-20" y="-20" width="1040" height="240" /></clipPath>
			<clipPath id="vine-h-b" clipPathUnits="userSpaceOnUse"><rect class="vine-wipe h b" x="-20" y="-20" width="1040" height="240" /></clipPath>
		</defs>
		<path class="seam-fill" d="M0,0 L0,150 C62,176 188,176 250,150 C312,124 438,124 500,150 C562,176 688,176 750,150 C812,124 938,124 1000,150 L1000,0 Z" />
		<path class="strand a" clip-path="url(#vine-h-a)" vector-effect="non-scaling-stroke" d="M-4,98 C62,144 188,144 250,98 C312,92 438,92 500,98 C562,144 688,144 750,98 C812,92 938,92 1004,98" />
		<path class="strand b" clip-path="url(#vine-h-b)" vector-effect="non-scaling-stroke" d="M-4,98 C62,104 188,104 250,98 C312,52 438,52 500,98 C562,104 688,104 750,98 C812,52 938,52 1004,98" />
	</svg>

	<div class="hero-media">
		<!-- INSERT A PHOTO: put the file in  static/images/  then point src at it.
		     fx / fy frame the crop. Run the dev server, hold ALT and drag the photo
		     to move it (ALT + scroll to zoom); the new values are copied to your
		     clipboard, ready to paste back in here. -->
		<Photo
			src="/images/nikita-form-2200.jpg"
			srcset="/images/nikita-form-1400.jpg 1400w, /images/nikita-form-2200.jpg 2200w"
			srcsetWebp="/images/nikita-form-1400.webp 1400w, /images/nikita-form-2200.webp 2200w"
			sizes="(max-width:820px) 100vw, 50vw"
			alt="Nikita in a seated backbend on a wooden deck, surrounded by palms"
			fx={50}
			fy={78}
			fyMobile={76}
			loading="eager"
			fetchpriority="high"
		/>
	</div>

	<!-- vertical seam (desktop): cream wave = image's left edge, braided vine parallel to it.
	     Wave sits about x=150 with control offset ±26; the braid centreline is the same
	     wave at x=114, and each strand adds ±16 to the controls. Gap to the image edge
	     therefore stays in a 24-48 unit band the whole way down instead of pinching. -->
	<svg class="hero-seam" viewBox="0 0 200 1000" preserveAspectRatio="none" aria-hidden="true">
		<defs>
			<clipPath id="vine-v-a" clipPathUnits="userSpaceOnUse"><rect class="vine-wipe" x="-20" y="-20" width="240" height="1040" /></clipPath>
			<clipPath id="vine-v-b" clipPathUnits="userSpaceOnUse"><rect class="vine-wipe b" x="-20" y="-20" width="240" height="1040" /></clipPath>
		</defs>
		<path class="seam-fill" d="M0,0 L150,0 C176,62 176,188 150,250 C124,312 124,438 150,500 C176,562 176,688 150,750 C124,812 124,938 150,1000 L0,1000 Z" />
		<path class="strand a" clip-path="url(#vine-v-a)" vector-effect="non-scaling-stroke" d="M114,-4 C156,62 156,188 114,250 C104,312 104,438 114,500 C156,562 156,688 114,750 C104,812 104,938 114,1004" />
		<path class="strand b" clip-path="url(#vine-v-b)" vector-effect="non-scaling-stroke" d="M114,-4 C124,62 124,188 114,250 C72,312 72,438 114,500 C124,562 124,688 114,750 C72,812 72,938 114,1004" />
	</svg>
</section>

<!-- brand mantra band -->
<div class="marquee" aria-hidden="true">
	<div class="marquee-track">
		{#each [0, 1] as half (half)}
			<div class="seq">
				{#each Array(3) as _, r (r)}
					<span>Breathe</span><span class="dot">·</span>
					<span>Connect</span><span class="dot">·</span>
					<span>Bloom</span><span class="dot">·</span>
					<span class="brandword">Vinya</span><span class="dot">·</span>
				{/each}
			</div>
		{/each}
	</div>
</div>

<!-- practice -->
<section class="sec">
	<div class="wrap">
		<div class="sec-head row reveal" use:reveal>
			<div><div class="eyebrow">{txt('home.practice.eyebrow')}</div><h2>{txt('home.practice.title')}</h2></div>
			<a class="tlink" href="/classes">{txt('home.practice.link')} <span>→</span></a>
		</div>
		<div class="practice-grid">
			{#each classes as c}
				<div class="practice reveal" use:reveal>
					<div class="tone {c.tone}"></div>
					<h3>{c.name}</h3>
					<div class="meta">{c.meta}</div>
					<p>{c.blurb}</p>
					<button class="tlink" onclick={() => openBooking(c.name)}>{txt('home.practice.book')} <span>→</span></button>
				</div>
			{/each}
		</div>
	</div>
</section>



<!-- about -->
<section class="sec sunken">
	<div class="wrap split wide">
		<div class="media reveal" use:reveal>
			<Photo
				src="/images/vinya-studio-a.jpeg"
				alt="A kirtan circle seated on cushions in a garden, harmonium at the centre"
				fx={50}
				fy={50}
			/>
		</div>
		<div class="reveal" use:reveal>
			<div class="eyebrow">{txt('home.about.eyebrow')}</div>
			<h2 style="margin-top:22px">{txt('home.about.title')}</h2>
			<p class="lede" style="margin-top:26px">{txt('about.hero.lede')}</p>
			<div style="margin-top:36px"><a class="tlink" href="/about">{txt('home.about.link')} <span>→</span></a></div>
		</div>
	</div>
</section>


<!-- philosophy -->
<section class="sec">
	<div class="wrap triptych">
		<div class="t reveal" use:reveal><div class="h">{txt('home.pillars.1.title')}</div><p>{txt('home.pillars.1.body')}</p></div>
		<div class="t reveal" use:reveal><div class="h">{txt('home.pillars.2.title')}</div><p>{txt('home.pillars.2.body')}</p></div>
		<div class="t reveal" use:reveal><div class="h">{txt('home.pillars.3.title')}</div><p>{txt('home.pillars.3.body')}</p></div>
	</div>
</section>


<!-- instructor teaser -->
<section class="sec sunken">
	<div class="wrap split">
		<div class="reveal" use:reveal style="order:1">
			<div class="eyebrow">{txt('home.teachers.eyebrow')}</div>
			<h2 style="margin-top:22px">{txt('home.teachers.title')}</h2>
			<div style="margin-top:36px;display:flex;gap:14px;flex-wrap:wrap">
				<a class="btn btn-primary" href="/teachers">{txt('home.teachers.cta.meet')}</a>
				<a class="btn btn-secondary" href="/classes">{txt('home.teachers.cta.offerings')}</a>
			</div>
		</div>
		<div class="media arch reveal" use:reveal style="order:2">
			<Photo
				src="/images/nikita-practice.JPG"
				alt="Nikita sounding a singing bowl over someone resting in savasana"
				fx={50}
				fy={45}
			/>
		</div>
	</div>
</section>

<!-- next gathering (the one espresso accent) -->
<section class="sec espresso">
	<div class="wrap event-band">
		<div class="date-chip reveal" use:reveal><div class="d">{next.d}</div><div class="m">{nextMonth}</div></div>
		<div class="reveal" use:reveal>
			<div class="eyebrow gold" style="color:var(--gold-500)">{txt('home.gathering.eyebrow')}</div>
			<h2 style="margin-top:14px">{next.name}</h2>
			<p>{next.det}. {next.p}</p>
		</div>
		<div class="reveal" use:reveal style="display:flex;flex-direction:column;gap:14px">
			<button class="btn btn-primary lg" onclick={() => openBooking(nextGathering)}>{txt('home.gathering.cta')}</button>
			<a style="font-size:var(--text-sm);color:var(--tan-300);text-align:center;letter-spacing:.06em" href="/events">{txt('home.gathering.link')}</a>
		</div>
	</div>
</section>

<!-- testimonials -->
<section class="sec">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">{txt('home.testimonials.eyebrow')}</div><h2 style="margin-top:18px">{txt('home.testimonials.title')}</h2></div>
		<div class="quotes">
			{#each testimonials as t, i (i)}
				<div class="quote reveal" use:reveal><p>{t.quote}</p><div class="who">{t.who}</div></div>
			{/each}
		</div>
		<div class="rating reveal" use:reveal><span class="stars">★★★★★</span><span>{txt('home.testimonials.rating')}</span></div>
	</div>
</section>

<!-- gallery -->
<section class="sec sunken">
	<div class="wrap">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">{txt('home.gallery.divider')}</span><div class="line"></div></div>
		<blockquote class="blockquote-lg reveal" use:reveal style="margin-top:56px">{txt('home.gallery.quote')}</blockquote>
		<div class="gallery" style="margin-top:64px">
			<div class="g reveal" use:reveal>
				<Photo
					src="/images/vinya-studio-a.jpeg"
					alt="A kirtan circle seated on cushions in a garden, harmonium at the centre"
					fx={50}
					fy={50}
				/>
			</div>
			<div class="g arch reveal" use:reveal>
				<Photo
					src="/images/nikita-practice.JPG"
					alt="Nikita sounding a singing bowl over someone resting in savasana"
					fx={50}
					fy={45}
				/>
			</div>
			<div class="g reveal" use:reveal>
				<Photo
					src="/images/vinya-studio-b.jpeg"
					alt="An evening kirtan in the hall, musicians on the low stage under warm lights"
					fx={50}
					fy={52}
				/>
			</div>
		</div>
	</div>
</section>

<!-- partners & facilitators -->
<!-- One card, written once, rendered by both layouts below. `clone` is true for the
     marquee's duplicate half: those links repeat what the first half already said, so
     they stay out of the tab order.

     `p.h` is the drawn height in px, and it is per-logo on purpose: every one of these
     is a stacked lockup (mark over wordmark) drawn at a different scale inside its own
     artwork, so a single shared height makes one look twice the size of the next. Tune
     `h` until the row looks even rather than measures even. It falls back to 72px.

     Logos with a white background get their background floodfilled to transparent
     before they're added, so a logo never sits on its own pale square here. -->
{#snippet partnerCard(p, i, clone)}
	{#if p.href}
		<a
			class="partner-logo"
			href={p.href}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={p.name}
			style:--logo-h={p.h ? `${p.h}px` : null}
			tabindex={clone ? -1 : undefined}
		>
			<img src={p.logo} alt={p.name} loading="lazy" />
			<span class="tip">{p.name}</span>
		</a>
	{:else}
		<button
			type="button"
			class="partner-logo"
			class:open={openTip === i}
			aria-label={p.name}
			style:--logo-h={p.h ? `${p.h}px` : null}
			tabindex={clone ? -1 : undefined}
			onclick={() => toggleTip(i)}
		>
			<img src={p.logo} alt={p.name} loading="lazy" />
			<span class="tip">{p.name}</span>
		</button>
	{/if}
{/snippet}

<section class="sec" id="partners">
	<div class="wrap">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">{txt('home.partners.divider')}</span><div class="line"></div></div>

		<!-- Driven by `partners` in data.js, and nothing here needs touching when one is
		     added: three fit the row as a grid, and past three the same cards become a
		     marquee rather than wrapping onto a lonely second row. -->
		{#if partners.length > 3}
			<div class="partner-marquee reveal" use:reveal>
				<div class="partner-track">
					<div class="partner-seq">
						{#each partners as p, i (p.name)}{@render partnerCard(p, i, false)}{/each}
					</div>
					<!-- the loop's second half: identical, and hidden from screen readers so
					     every partner is announced exactly once. -->
					<div class="partner-seq" aria-hidden="true">
						{#each partners as p, i (p.name)}{@render partnerCard(p, i, true)}{/each}
					</div>
				</div>
			</div>
		{:else}
			<div class="partners reveal" use:reveal>
				{#each partners as p, i (p.name)}{@render partnerCard(p, i, false)}{/each}
			</div>
		{/if}
	</div>
</section>

<!-- jump -->
<section class="sec sunken">
	<div class="wrap">
		<div class="eyebrow reveal" use:reveal style="margin-bottom:12px">{txt('home.jump.eyebrow')}</div>
		<div class="jump reveal" use:reveal>
			<a href="/classes"><span>{txt('home.jump.classes')}</span><span class="arrow">→</span></a>
			<a href="/events"><span>{txt('home.jump.events')}</span><span class="arrow">→</span></a>
			<a href="/classes#prices"><span>{txt('home.jump.prices')}</span><span class="arrow">→</span></a>
			<a href="/teachers"><span>{txt('home.jump.teachers')}</span><span class="arrow">→</span></a>
		</div>
	</div>
</section>
