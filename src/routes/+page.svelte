<script>
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import { openBooking } from '$lib/booking.js';
	import { classes } from '$lib/data.js';
</script>

<svelte:head><title>Vinya Yoga — Breathe, Connect, Bloom</title></svelte:head>

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
		<!-- INSERT A PHOTO: put the file in  static/  then replace the <span> line below with:
		     <img src="/nikita-hero.jpg" alt="Nikita at Vinya" />   -->
		<span class="cap">Nikita photo coming</span>
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

<!-- philosophy -->
<section class="sec">
	<div class="wrap triptych">
		<div class="t reveal" use:reveal><div class="h">Breathe</div><p>Breath is the bridge between who you are guarded and who you are open. We start there, every time.</p></div>
		<div class="t reveal" use:reveal><div class="h">Connect</div><p>Moving together creates connection together. Come for the practice, stay for the connection.
</p></div>
		<div class="t reveal" use:reveal><div class="h">Bloom</div><p>Come as you are today, not as the version you think is ready.</p></div>
	</div>
</section>

<!-- about -->
<section class="sec sunken">
	<div class="wrap split wide">
		<div class="media reveal" use:reveal><Ph cap="The studio" tone="sky" /></div>
		<div class="reveal" use:reveal>
			<div class="eyebrow">About Vinya</div>
			<h2 style="margin-top:22px">A room that makes space for you.</h2>
			<p class="lede" style="margin-top:26px">Vinya is a yoga space where movement, breath and the nervous system meet. Slow, warm, and never rushed.</p>
			<p style="margin-top:22px">We started from a simple belief: we become connected because we bloom. Hesitation doesn't dissolve by pushing through it. It dissolves through breath. That is what every class holds space for, whether it's a Tuesday evening flow or a full-moon gathering.</p>
			<div style="margin-top:36px"><a class="tlink" href="/about">More about Vinya <span>→</span></a></div>
		</div>
	</div>
</section>

<!-- practice -->
<section class="sec">
	<div class="wrap">
		<div class="sec-head row reveal" use:reveal>
			<div><div class="eyebrow">The practice</div><h2>Four ways to breathe this week</h2></div>
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

<!-- instructor teaser -->
<section class="sec sunken">
	<div class="wrap split">
		<div class="reveal" use:reveal style="order:1">
			<div class="eyebrow">Your teacher</div>
			<h2 style="margin-top:22px">Held by someone who came to yoga the long way around.</h2>
			<p class="lede" style="margin-top:26px">Every class at Vinya is led by <span class="italic" style="color:var(--brown-700)">Nikita Coppens</span>, yoga teacher and holistic therapeut, based in the Netherlands.</p>
			<p style="margin-top:20px">Years in mental-health care, then addiction counselling, then study in India: yoga, sound healing, alternative medicine. She teaches the way she learned to care. Patient, attuned, unhurried.</p>
			<div style="margin-top:36px;display:flex;gap:14px;flex-wrap:wrap">
				<a class="btn btn-primary" href="/instructors">Meet Nikita</a>
				<button class="btn btn-secondary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 session</button>
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
			<button class="btn btn-primary lg" onclick={() => openBooking('Full Moon Flow & Sound Bath · 8 Aug')}>Reserve your place</button>
			<a style="font-size:var(--text-sm);color:var(--tan-300);text-align:center;letter-spacing:.06em" href="/events">All events</a>
		</div>
	</div>
</section>

<!-- testimonials -->
<section class="sec">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">In their words</div><h2 style="margin-top:18px">Quietly, people keep coming back.</h2></div>
		<div class="quotes">
			<div class="quote reveal" use:reveal><p>"I came in stiff and a little cynical. I left breathing differently. The room is so quiet you can actually hear yourself soften."</p><div class="who">Marieke · Slow Flow</div></div>
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

<!-- jump -->
<section class="sec">
	<div class="wrap">
		<div class="eyebrow reveal" use:reveal style="margin-bottom:12px">Where to next</div>
		<div class="jump reveal" use:reveal>
			<a href="/classes"><span>Find a class for you</span><span class="arrow">→</span></a>
			<a href="/events"><span>Workshops &amp; gatherings</span><span class="arrow">→</span></a>
			<a href="/classes"><span>Passes &amp; prices</span><span class="arrow">→</span></a>
			<a href="/instructors"><span>Meet your teacher</span><span class="arrow">→</span></a>
		</div>
	</div>
</section>
