<script>
	import { reveal } from '$lib/reveal.js';
	import { openBooking } from '$lib/booking.js';
	import { classes, timetable, prices, faqs, offerings, locationOf } from '$lib/data.js';
	import { openDetail } from '$lib/detail.js';

	function classDetail(c) {
		openDetail({ eyebrow: 'Class', title: c.name, meta: c.meta, body: c.blurb, location: locationOf(c.name), bookLabel: c.name });
	}
	function slotDetail(day, s) {
		const [time, name, duration] = s;
		openDetail({ eyebrow: 'Session', title: name, meta: `${day} · ${time} · ${duration}`, location: locationOf(name), bookLabel: name });
	}
</script>

<svelte:head><title>Classes — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="lead-row">
			<div><div class="eyebrow">Classes</div><h1>A week with room in it.</h1></div>
			<p>Classes facilitated in different studios. Book the class you need. No membership, no pressure to keep a streak.</p>
		</div>
	</div>
</section>

<section class="sec" style="padding-top:clamp(56px,7vh,80px)">
	<div class="wrap">
		<div class="class-list">
			{#each classes as c}
				<div class="class-row reveal" use:reveal>
					<div class="lead"><div class="tone {c.tone}"></div><h3>{c.name}</h3><div class="meta">{c.meta}</div></div>
					<button class="row-trigger" onclick={() => classDetail(c)}>
						<span class="row-trigger-txt">{locationOf(c.name)}</span>
						<span class="tap-cue">Details <span class="arrow">→</span></span>
					</button>
					<button class="btn btn-secondary" onclick={() => openBooking(c.name)}>Book {c.name}</button>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="sec sunken">
	<div class="wrap">
		<div class="sec-head row" style="margin-bottom:44px">
			<div><div class="eyebrow">Weekly rhythm</div><h2 style="margin-top:16px">The timetable</h2></div>
			<span style="font-size:var(--text-sm);color:var(--text-muted)">Tap a session to book</span>
		</div>
		<div>
			{#each timetable as r}
				<div class="tt-row">
					<div class="day">{r.day}</div>
					<div class="tt-slots">
						{#each r.slots as s}
							<div class="slot">
								<button class="row-trigger" onclick={() => slotDetail(r.day, s)}>
									<span class="row-trigger-txt"><strong>{s[0]}</strong> · {s[1]} · {s[2]}</span>
									<span class="tap-cue">Details <span class="arrow">→</span></span>
								</button>
								<button class="btn btn-primary sm" onclick={() => openBooking(s[1])}>Book</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="sec">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">Passes &amp; prices</div><h2 style="margin-top:18px">Pay for the week you need.</h2></div>
		<div class="prices">
			{#each prices as p}
				<div class="price {p.feature ? 'feature' : ''} reveal" use:reveal>
					<div class="lbl">{p.lbl}</div><div class="amt">{p.amt}</div><p>{p.note}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="sec sunken">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">Our offerings</div><h2 style="margin-top:18px">Beyond the weekly mat.</h2></div>
		{#each offerings as g}
			<div class="offer-cat"><h3>{g.cat}</h3><div class="line"></div></div>
			<div class="offer-list">
				{#each g.items as it}
					<div class="offer-row reveal" use:reveal>
						<div><h4>{it.name}</h4><p>{it.note}</p></div>
						<button class="btn btn-secondary" onclick={() => openBooking(it.name)}>Enquire</button>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</section>

<section class="sec" id="faq">
	<div class="wrap wrap-narrow">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">First time?</div><h2 style="margin-top:18px">Everything you're quietly wondering</h2></div>
		<div class="faq">
			{#each faqs as f}
				<details>
					<summary>{f.q}<span class="pm">+</span></summary>
					<p>{f.a}</p>
				</details>
			{/each}
		</div>
	</div>
</section>
