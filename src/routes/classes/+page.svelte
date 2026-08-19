<script>
	import { reveal } from '$lib/reveal.js';
	import { openBooking } from '$lib/booking.js';
	import { classes, timetable, prices, faqs, offerings, locationOf } from '$lib/data.js';
	import { openDetail } from '$lib/detail.js';
	import { openPay } from '$lib/pay.js';
	import { txt } from '$lib/copy.js';

	function classDetail(c) {
		openDetail({ eyebrow: txt('classes.detail.class'), title: c.name, meta: c.meta, body: c.blurb, location: locationOf(c.name), bookLabel: c.name });
	}
	function slotDetail(day, s) {
		const [time, name, duration] = s;
		openDetail({ eyebrow: txt('classes.detail.session'), title: name, meta: `${day} · ${time} · ${duration}`, location: locationOf(name), bookLabel: name });
	}
</script>

<svelte:head><title>Classes: Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="lead-row">
			<div><div class="eyebrow">{txt('classes.hero.eyebrow')}</div><h1>{txt('classes.hero.title')}</h1></div>
			<p>{txt('classes.hero.body')}</p>
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
						<span class="tap-cue">{txt('classes.detail.cue')} <span class="arrow">→</span></span>
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
			<div><div class="eyebrow">{txt('classes.timetable.eyebrow')}</div><h2 style="margin-top:16px">{txt('classes.timetable.title')}</h2></div>
			<span style="font-size:var(--text-sm);color:var(--text-muted)">{txt('classes.timetable.hint')}</span>
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
									<span class="tap-cue">{txt('classes.detail.cue')} <span class="arrow">→</span></span>
								</button>
								<button class="btn btn-primary sm" onclick={() => openBooking(s[1])}>{txt('classes.timetable.book')}</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="sec" id="prices">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">{txt('classes.prices.eyebrow')}</div><h2 style="margin-top:18px">{txt('classes.prices.title')}</h2></div>
		<div class="prices">
			{#each prices as p}
				<!-- spans, not div/p: a button's content model is phrasing content only -->
				<button class="price {p.feature ? 'feature' : ''} reveal" use:reveal onclick={() => openPay(p.id)}>
					<span class="lbl">{p.lbl}</span><span class="amt">{p.amt}</span><span class="note">{p.note}</span>
					<span class="tap-cue">Pay {p.amt} <span class="arrow">→</span></span>
				</button>
			{/each}
		</div>
		<p class="prices-note">{txt('classes.prices.note')}</p>
	</div>
</section>

<section class="sec sunken">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">{txt('classes.offerings.eyebrow')}</div><h2 style="margin-top:18px">{txt('classes.offerings.title')}</h2></div>
		{#each offerings as g}
			<div class="offer-cat"><h3>{g.cat}</h3><div class="line"></div></div>
			<div class="offer-list">
				{#each g.items as it}
					<div class="offer-row reveal" use:reveal>
						<div><h4>{it.name}</h4><p>{it.note}</p></div>
						<button class="btn btn-secondary" onclick={() => openBooking(it.name)}>{txt('classes.offerings.enquire')}</button>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</section>

<section class="sec" id="faq">
	<div class="wrap wrap-narrow">
		<div class="sec-head reveal" use:reveal><div class="eyebrow">{txt('classes.faq.eyebrow')}</div><h2 style="margin-top:18px">{txt('classes.faq.title')}</h2></div>
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
