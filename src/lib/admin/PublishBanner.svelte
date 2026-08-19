<script>
	import { onMount } from 'svelte';

	/** Tells the owner where her change has got to.
	 *
	 *  Saving and publishing are separate — a save is instant, publishing waits
	 *  for her to stop typing and then rebuilds the site. Without something on
	 *  screen the gap between the two is indistinguishable from nothing having
	 *  happened, which is the moment people save again, or give up.
	 *
	 *  Four stages, each with an honest label: saved, counting down, building,
	 *  live. The bar fills through the first three; "live" is a statement, not a
	 *  progress step, so it stops moving and offers the link instead.
	 */
	let state = $state(null);
	let now = $state(Date.now());

	async function poll() {
		try {
			const res = await fetch('/api/publish/state');
			if (res.ok) state = await res.json();
		} catch {
			// A failed poll is not worth a message; the next one is two seconds away.
		}
	}

	onMount(() => {
		poll();
		// Two seconds while something is happening, so the countdown does not
		// visibly stutter; ten when idle, because nothing is going to change.
		const tick = setInterval(() => (now = Date.now()), 250);
		let id = setInterval(poll, 2000);
		return () => {
			clearInterval(id);
			clearInterval(tick);
		};
	});

	let secondsLeft = $derived(
		state?.publishAfter ? Math.max(0, Math.ceil((new Date(state.publishAfter).getTime() - now) / 1000)) : 0
	);

	let liveIsStale = $derived(
		state?.status === 'live' && state?.updatedAt
			? now - new Date(state.updatedAt).getTime() > 120_000
			: false
	);

	let stage = $derived(
		liveIsStale
			? 'idle'
			: state?.status === 'failed'
			? 'failed'
			: state?.status === 'live'
				? 'live'
				: state?.status === 'publishing'
					? 'building'
					: state?.status === 'pending'
						? secondsLeft > 0
							? 'waiting'
							: 'starting'
						: 'idle'
	);

	const COPY = {
		waiting: 'Saved. Publishing when you stop editing…',
		starting: 'Starting to publish…',
		building: 'Updating your site — about a minute…',
		live: 'Your changes are live.',
		failed: ''
	};

	// Rough, and deliberately so: a bar that claims 63% would be inventing
	// precision it does not have. These are the three real stages.
	const FILL = { waiting: 0.15, starting: 0.35, building: 0.7, live: 1, failed: 1 };
	let fill = $derived((FILL[stage] ?? 0) * 100);
	let tone = $derived(stage === 'failed' ? 'bad' : stage === 'live' ? 'good' : 'busy');
</script>

{#if stage !== 'idle'}
	<div class="wrap {tone}" role="status" aria-live="polite">
	 <div class="inner">
		<div class="line">
			<span class="dot" class:still={stage === 'live' || stage === 'failed'}></span>
			<p>
				{#if stage === 'failed'}
					{state.message}
				{:else if stage === 'waiting'}
					Saved. Publishing in {secondsLeft}s — keep editing if you are not done.
				{:else}
					{COPY[stage]}
				{/if}
			</p>
			{#if stage === 'live' && state.url}
				<a href={state.url} target="_blank" rel="noopener">See it on the site →</a>
			{/if}
		</div>

		{#if stage !== 'failed'}
			<div class="track" aria-hidden="true">
				<div class="fill" style="width:{fill}%"></div>
			</div>
			<ol class="steps" aria-hidden="true">
				<li class:on={true}>Saved</li>
				<li class:on={stage === 'starting' || stage === 'building' || stage === 'live'}>Publishing</li>
				<li class:on={stage === 'live'}>Live on the site</li>
			</ol>
		{/if}
	 </div>
	</div>
{/if}

<style>
	.wrap { padding: 12px clamp(16px, 3vw, 32px) 14px; border-bottom: 1px solid var(--border-subtle);
		font-size: var(--text-sm); position: sticky; top: 64px; z-index: 35; width: 100%; }
	.inner { width: min(1100px, 100%); margin: 0 auto; }
	.busy { background: #fdf6e6; color: #6b5320; }
	.good { background: #eef7ea; color: #2f5d2a; }
	.bad  { background: #fdeceb; color: #8a2318; }
	.line { display: flex; align-items: center; gap: 10px; }
	.line p { margin: 0; flex: 1; }
	a { color: inherit; text-decoration: underline; white-space: nowrap; }
	.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none;
		animation: pulse 1.4s ease-in-out infinite; }
	.dot.still { animation: none; }
	@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
	.track { height: 4px; border-radius: 999px; background: rgba(0, 0, 0, .08); margin-top: 9px; overflow: hidden; }
	.fill { height: 100%; background: currentColor; border-radius: 999px;
		transition: width .5s cubic-bezier(.4, 0, .2, 1); }
	.steps { display: flex; gap: 18px; list-style: none; margin: 7px 0 0; padding: 0;
		font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
	.steps li { opacity: .35; }
	.steps li.on { opacity: 1; }
	@media (prefers-reduced-motion: reduce) {
		.dot { animation: none }
		.fill { transition: none }
	}
	@media (max-width: 720px) { .wrap { top: auto; position: static; } }
</style>
