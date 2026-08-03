<script>
	import { fade } from 'svelte/transition';
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import Photo from '$lib/components/Photo.svelte';
	import { openBooking } from '$lib/booking.js';
	import { teachers } from '$lib/data.js';

	let idx = $state(0);
	let t = $derived(teachers[idx]);
	const prevTeacher = () => (idx = (idx - 1 + teachers.length) % teachers.length);
	const nextTeacher = () => (idx = (idx + 1) % teachers.length);
</script>

<svelte:head><title>Teachers — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead" style="padding-top:clamp(32px,5vh,56px);text-align:center">
		<div class="eyebrow">Who we are</div>
		<h1 style="margin:14px auto 0">Meet our teachers.</h1>
	</div>
</section>

<!-- TOP: teacher showcase, cycle with the arrows when more than one teacher -->
<section class="sec" style="padding-top:clamp(20px,3vh,36px)">
	<div class="wrap">
		<div class="teacher-carousel">
			<button class="car-arrow prev" onclick={prevTeacher} disabled={teachers.length < 2} aria-label="Previous teacher">←</button>

			{#key idx}
				<div class="teacher-card reveal in" in:fade={{ duration: 220 }}>
					<div class="portrait">
						<Photo src={t.photo.src} srcset={t.photo.srcset} sizes="(max-width:820px) 100vw, 40vw" alt={t.photo.alt} fx={t.photo.fx} fy={t.photo.fy} />
					</div>
					<div class="info">
						<h2>{t.name}</h2>
						<div class="role">{t.role}</div>
						<p class="intro-lede">{t.intro}</p>
						<ul class="highlight-list">
							{#each t.highlights as h}<li>{h}</li>{/each}
						</ul>
						<div class="intro-cta">
							<button class="btn btn-primary" onclick={() => openBooking(t.cta.option)}>{t.cta.label}</button>
							<a class="btn btn-secondary" href="/classes">See the timetable</a>
						</div>
					</div>
				</div>
			{/key}

			<button class="car-arrow next" onclick={nextTeacher} disabled={teachers.length < 2} aria-label="Next teacher">→</button>
		</div>
		{#if teachers.length > 1}
			<div class="car-dots">
				{#each teachers as team, i}<button class="dot" class:active={i === idx} onclick={() => (idx = i)} aria-label={`Show ${team.name}`}></button>{/each}
			</div>
		{/if}
	</div>
</section>


<!-- FULL-WIDTH: how she works -->
<section class="sec sunken">
	<div class="wrap">
		<div class="sec-head reveal" use:reveal style="text-align:center;margin-left:auto;margin-right:auto"><div class="eyebrow">How Vinya teachers work</div><h2 style="margin-top:18px">Care first, always.</h2></div>
		<div class="spec-grid">
			<div class="spec reveal" use:reveal><h4>How we teaches</h4><p>Patient and attuned. She meets you where you are today, offering an invitation as clearly as an instruction.</p></div>
			<div class="spec reveal" use:reveal><h4>Care background</h4><p>Years in Dutch mental-health care (GGZ) as a personal support worker, and trained as an addiction counsellor.</p></div>
			<div class="spec reveal" use:reveal><h4>Studied in India</h4><p>Yoga, sound healing and alternative medicine, where her view of health widened to body and mind as one.</p></div>
			<div class="spec reveal" use:reveal><h4>Beyond class</h4><p>1:1 holistic sessions and community sound-healing gatherings, built around not standing alone.</p></div>
		</div>
		<div class="reveal" use:reveal style="margin-top:52px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
			<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 session</button>
			<a class="btn btn-secondary" href="/classes">See the timetable</a>
		</div>
	</div>
</section>

<section class="sec">
	<div class="wrap wrap-narrow" style="text-align:center">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">Growing the circle</span><div class="line"></div></div>
		<blockquote class="blockquote-lg reveal" use:reveal style="margin-top:48px;max-width:24ch">Room for more teachers, when the right ones arrive.</blockquote>
		<p class="reveal" use:reveal style="font-size:var(--text-base);line-height:1.85;color:var(--text-secondary);margin:28px auto 0;max-width:52ch">Vinya is always open for collaboration. As guest teachers and workshop leaders join, they'll be introduced here, each with their own way of holding the room.</p>
		<div class="reveal" use:reveal style="margin-top:36px"><button class="btn btn-secondary" onclick={() => openBooking('a class')}>Get in touch about teaching</button></div>
	</div>
</section>
