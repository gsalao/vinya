<script>
	import { reveal } from '$lib/reveal.js';
	import { openBooking } from '$lib/booking.js';
	import { classes, timetable, prices, faqs } from '$lib/data.js';
</script>

<svelte:head><title>Classes — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="lead-row">
			<div><div class="eyebrow">Classes</div><h1>A week with room in it.</h1></div>
			<p>Four class types, one small studio. Book the week you need. No membership, no pressure to keep a streak.</p>
		</div>
	</div>
</section>

<section class="sec" style="padding-top:clamp(56px,7vh,80px)">
	<div class="wrap">
		<div class="class-list">
			{#each classes as c}
				<div class="class-row reveal" use:reveal>
					<div class="lead"><div class="tone {c.tone}"></div><h3>{c.name}</h3><div class="meta">{c.meta}</div></div>
					<p>{c.detail}</p>
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
			<span style="font-size:var(--text-sm);color:var(--text-muted)">Times to be confirmed · tap a session to book</span>
		</div>
		<div>
			{#each timetable as r}
				<div class="tt-row">
					<div class="day">{r.day}</div>
					<div class="tt-slots">
						{#each r.slots as s}
							<div class="slot">
								<span><strong>{s[0]}</strong> · {s[1]} · {s[2]}</span>
								<button class="btn btn-primary sm" onclick={() => openBooking(`${s[1]} · ${r.day.slice(0, 3)} ${s[0]}`)}>Book</button>
							</div>
						{/each}
					</div>
				</div>
			{/each}
			<div class="tt-row">
				<div class="day" style="color:var(--text-muted)">Sunday</div>
				<div style="font-size:var(--text-sm);color:var(--text-muted)">Rest, or an event when there is one. Look at <a href="/events">what's coming</a>.</div>
			</div>
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
		<p style="font-size:var(--text-sm);color:var(--text-muted);margin-top:24px">Prices are placeholders until the studio confirms them.</p>
	</div>
</section>

<section class="sec sunken">
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
