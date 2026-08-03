<script>
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import Photo from '$lib/components/Photo.svelte';
	import { openBooking } from '$lib/booking.js';
	import { classes, partners, events, eventLabel } from '$lib/data.js';

	// The band below shows the next gathering. Its copy is written out here, but the
	// booking label is taken from the events data so it always matches the picker.
	const nextGathering = eventLabel(events[0].items[0], events[0]);

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
			<h1>Breathe through the hesitation. Bloom into who you already are.</h1>
			<div class="hero-cta">
				<button class="btn btn-primary lg" onclick={() => openBooking('a class')}>Book a class</button>
				<a class="btn btn-ghost lg" href="/events">See what's coming</a>
			</div>
		</div>
	</div>

	<!-- horizontal seam (mobile): sits between copy and image.
	     seam-fill's lower edge IS the image edge (wave about y=150, controls ±26).
	     Both strands braid around a centreline at y=98 that rides the SAME wave,
	     so the vine stays parallel to the image with a constant gap. -->
	<svg class="hero-seam-h" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true">
		<path class="seam-fill" d="M0,0 L0,150 C62,176 188,176 250,150 C312,124 438,124 500,150 C562,176 688,176 750,150 C812,124 938,124 1000,150 L1000,0 Z" />
		<path class="strand a" pathLength="1000" vector-effect="non-scaling-stroke" d="M-4,98 C62,144 188,144 250,98 C312,92 438,92 500,98 C562,144 688,144 750,98 C812,92 938,92 1004,98" />
		<path class="strand b" pathLength="1000" vector-effect="non-scaling-stroke" d="M-4,98 C62,104 188,104 250,98 C312,52 438,52 500,98 C562,104 688,104 750,98 C812,52 938,52 1004,98" />
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
		<path class="seam-fill" d="M0,0 L150,0 C176,62 176,188 150,250 C124,312 124,438 150,500 C176,562 176,688 150,750 C124,812 124,938 150,1000 L0,1000 Z" />
		<path class="strand a" pathLength="1000" vector-effect="non-scaling-stroke" d="M114,-4 C156,62 156,188 114,250 C104,312 104,438 114,500 C156,562 156,688 114,750 C104,812 104,938 114,1004" />
		<path class="strand b" pathLength="1000" vector-effect="non-scaling-stroke" d="M114,-4 C124,62 124,188 114,250 C72,312 72,438 114,500 C124,562 124,688 114,750 C72,812 72,938 114,1004" />
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
			<div><div class="eyebrow">The practice</div><h2>Schedule for this week</h2></div>
			<a class="tlink" href="/classes">See the full timetable <span>→</span></a>
		</div>
		<div class="practice-grid">
			{#each classes as c}
				<div class="practice reveal" use:reveal>
					<div class="tone {c.tone}"></div>
					<h3>{c.name}</h3>
					<div class="meta">{c.meta}</div>
					<p>{c.blurb}</p>
					<button class="tlink" onclick={() => openBooking(c.name)}>Book a place <span>→</span></button>
				</div>
			{/each}
		</div>
	</div>
</section>



<!-- about -->
<section class="sec sunken">
	<div class="wrap split wide">
		<div class="media reveal" use:reveal><Ph cap="The studio" tone="sky" /></div>
		<div class="reveal" use:reveal>
			<div class="eyebrow">About Vinya</div>
			<h2 style="margin-top:22px">A space with room to breathe.</h2>
			<p class="lede" style="margin-top:26px">Vinya is a yoga inspired initiative in the Netherlands. Most people who find us are somewhere in the middle of: a change, a tiredness, a hesitation they can't name or ready to step out of their comfort zone. Either you're ready to work on your physical and mental state.</p>
			<div style="margin-top:36px"><a class="tlink" href="/about">More about Vinya <span>→</span></a></div>
		</div>
	</div>
</section>


<!-- philosophy -->
<section class="sec">
	<div class="wrap triptych">
		<div class="t reveal" use:reveal><div class="h">Breathe</div><p>Breathe is the bridge between who you are guarded and who you are open. We start there, every time.</p></div>
		<div class="t reveal" use:reveal><div class="h">Connect</div><p>Moving together creates connection together. Come for the practice, stay for the connection.
</p></div>
		<div class="t reveal" use:reveal><div class="h">Bloom</div><p>Come as you are today, not as the version you think is ready.</p></div>
	</div>
</section>


<!-- instructor teaser -->
<section class="sec sunken">
	<div class="wrap split">
		<div class="reveal" use:reveal style="order:1">
			<div class="eyebrow">Your teachers</div>
			<h2 style="margin-top:22px">Held by people who came to yoga the long way around.</h2>
			<div style="margin-top:36px;display:flex;gap:14px;flex-wrap:wrap">
				<a class="btn btn-primary" href="/teachers">Meet the teachers</a>
				<a class="btn btn-secondary" href="/classes">Explore our offerings</a>
			</div>
		</div>
		<div class="media arch reveal" use:reveal style="order:2"><Ph cap="Nikita Coppens" tone="tan" /></div>
	</div>
</section>

<!-- next gathering (the one espresso accent) -->
<section class="sec espresso">
	<div class="wrap event-band">
		<div class="date-chip reveal" use:reveal><div class="d">08</div><div class="m">Aug</div></div>
		<div class="reveal" use:reveal>
			<div class="eyebrow gold" style="color:var(--gold-500)">Next gathering</div>
			<h2 style="margin-top:14px">Full Moon Flow &amp; Sound Bath</h2>
			<p>Saturday 19:00 · 90 minutes · €28 · Location to be confirmed. Slow flow as the light goes, then sound to close.</p>
		</div>
		<div class="reveal" use:reveal style="display:flex;flex-direction:column;gap:14px">
			<button class="btn btn-primary lg" onclick={() => openBooking(nextGathering)}>Reserve your place</button>
			<a style="font-size:var(--text-sm);color:var(--tan-300);text-align:center;letter-spacing:.06em" href="/events">All events</a>
		</div>
	</div>
</section>

<!-- testimonials -->
<section class="sec">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">In their words</div><h2 style="margin-top:18px">Quietly, people keep coming back.</h2></div>
		<div class="quotes">
			<div class="quote reveal" use:reveal><p>"I came in stiff and a little cynical. I left breathing differently. The room is so quiet you can actually hear yourself soften."</p><div class="who">Marieke · Slow Yoga Adjustment</div></div>
			<div class="quote reveal" use:reveal><p>"First yoga in my life at 43. Nobody made me feel behind. I've been back every week since."</p><div class="who">Tomas · Beginners course</div></div>
			<div class="quote reveal" use:reveal><p>"The 1:1 sessions with Nikita did more for my sleep than anything else this year. Gentle, and exactly what I needed."</p><div class="who">Sanne · 1:1 Holistic</div></div>
		</div>
		<div class="rating reveal" use:reveal><span class="stars">★★★★★</span><span>Loved by a small, growing circle · real reviews to be gathered here</span></div>
	</div>
</section>

<!-- gallery -->
<section class="sec sunken">
	<div class="wrap">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">In this together</span><div class="line"></div></div>
		<blockquote class="blockquote-lg reveal" use:reveal style="margin-top:56px">Leave a little more room to bloom.</blockquote>
		<div class="gallery" style="margin-top:64px">
			<div class="g reveal" use:reveal><Ph cap="Practice" tone="sky" /></div>
			<div class="g arch reveal" use:reveal><Ph cap="The room" tone="gold" /></div>
			<div class="g reveal" use:reveal><Ph cap="A gathering" tone="tan" /></div>
		</div>
	</div>
</section>

<!-- partners & facilitators -->
<section class="sec">
	<div class="wrap">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">Partners &amp; Facilitators</span><div class="line"></div></div>
		<div class="partners" style="margin-top:56px">
			{#each partners as p, i (p.name)}
				{#if p.href}
					<a
						class="partner-logo reveal"
						use:reveal
						href={p.href}
						target="_blank"
						rel="noopener noreferrer"
						aria-label={p.name}
					>
						<img src={p.logo} alt={p.name} loading="lazy" />
						<span class="tip">{p.name}</span>
					</a>
				{:else}
					<button
						type="button"
						class="partner-logo reveal"
						class:open={openTip === i}
						use:reveal
						aria-label={p.name}
						onclick={() => toggleTip(i)}
					>
						<img src={p.logo} alt={p.name} loading="lazy" />
						<span class="tip">{p.name}</span>
					</button>
				{/if}
			{/each}
		</div>
	</div>
</section>

<!-- jump -->
<section class="sec sunken">
	<div class="wrap">
		<div class="eyebrow reveal" use:reveal style="margin-bottom:12px">Where to next</div>
		<div class="jump reveal" use:reveal>
			<a href="/classes"><span>Find a class for you</span><span class="arrow">→</span></a>
			<a href="/events"><span>Workshops &amp; gatherings</span><span class="arrow">→</span></a>
			<a href="/classes#prices"><span>Passes &amp; prices</span><span class="arrow">→</span></a>
			<a href="/teachers"><span>Meet your teachers</span><span class="arrow">→</span></a>
		</div>
	</div>
</section>
