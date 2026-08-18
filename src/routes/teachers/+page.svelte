<script>
	import { fade } from 'svelte/transition';
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import Photo from '$lib/components/Photo.svelte';
	import { openBooking } from '$lib/booking.js';
	import { teachers } from '$lib/data.js';
	import { txt } from '$lib/copy.js';

	let idx = $state(0);
	let t = $derived(teachers[idx]);
	const prevTeacher = () => (idx = (idx - 1 + teachers.length) % teachers.length);
	const nextTeacher = () => (idx = (idx + 1) % teachers.length);
</script>

<svelte:head><title>Teachers: Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead" style="padding-top:clamp(32px,5vh,56px);text-align:center">
		<div class="eyebrow">{txt('teachers.hero.eyebrow')}</div>
		<h1 style="margin:14px auto 0">{txt('teachers.hero.title')}</h1>
	</div>
</section>

<!-- TOP: teacher showcase, cycle with the arrows when more than one teacher -->
<section class="sec" style="padding-top:clamp(20px,3vh,36px)">
	<div class="wrap">
		<div class="teacher-carousel">
			{#if teachers.length > 1}
				<button class="car-arrow prev" onclick={prevTeacher} aria-label="Previous teacher">←</button>
			{/if}

			{#key idx}
				<div class="teacher-card reveal in" in:fade={{ duration: 220 }}>
					<div class="portrait">
						<Photo src={t.photo.src} srcset={t.photo.srcset} srcsetWebp={t.photo.srcsetWebp} sizes="(max-width:820px) 100vw, 40vw" alt={t.photo.alt} fx={t.photo.fx} fy={t.photo.fy} />
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
							<a class="btn btn-secondary" href="/classes">{txt('teachers.hero.timetable')}</a>
						</div>
					</div>
				</div>
			{/key}

			{#if teachers.length > 1}
				<button class="car-arrow next" onclick={nextTeacher} aria-label="Next teacher">→</button>
			{/if}
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
		<div class="sec-head reveal" use:reveal style="text-align:center;margin-left:auto;margin-right:auto"><div class="eyebrow">{txt('teachers.work.eyebrow')}</div><h2 style="margin-top:18px">{txt('teachers.work.title')}</h2></div>
		<div class="spec-grid">
			<div class="spec reveal" use:reveal><h4>{txt('teachers.work.1.title')}</h4><p>{txt('teachers.work.1.body')}</p></div>
			<div class="spec reveal" use:reveal><h4>{txt('teachers.work.2.title')}</h4><p>{txt('teachers.work.2.body')}</p></div>
			<div class="spec reveal" use:reveal><h4>{txt('teachers.work.3.title')}</h4><p>{txt('teachers.work.3.body')}</p></div>
			<div class="spec reveal" use:reveal><h4>{txt('teachers.work.4.title')}</h4><p>{txt('teachers.work.4.body')}</p></div>
		</div>
		<div class="reveal" use:reveal style="margin-top:52px;display:flex;gap:14px;flex-wrap:wrap;justify-content:center">
			<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>{txt('teachers.work.cta.book')}</button>
			<a class="btn btn-secondary" href="/classes">{txt('teachers.work.cta.timetable')}</a>
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
