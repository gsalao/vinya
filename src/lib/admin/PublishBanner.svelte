<script>
	import { onMount } from 'svelte';

	/** Polls the publish state so the owner sees her change reach the site
	 *  without refreshing. Silent when idle — a banner that is always there stops
	 *  being read. */
	let state = $state(null);

	async function poll() {
		try {
			const res = await fetch('/api/publish/state');
			if (res.ok) state = await res.json();
		} catch {
			// A failed poll is not worth telling her about; the next one may work.
		}
	}

	onMount(() => {
		poll();
		const id = setInterval(poll, 5000);
		return () => clearInterval(id);
	});

	let tone = $derived(state?.status === 'failed' ? 'bad' : state?.status === 'live' ? 'good' : 'busy');
	let show = $derived(Boolean(state) && state.status !== 'idle');
</script>

{#if show}
	<div class="banner {tone}" role="status">
		<span class="dot"></span>
		<p>{state.message}</p>
		{#if state.status === 'live' && state.url}
			<a href={state.url} target="_blank" rel="noopener">See it →</a>
		{/if}
	</div>
{/if}

<style>
	.banner { display: flex; align-items: center; gap: 12px; padding: 12px clamp(16px, 3vw, 32px);
		font-size: var(--text-sm); border-bottom: 1px solid var(--border-subtle); }
	.banner p { margin: 0; flex: 1; }
	.busy { background: #fdf6e6; color: #6b5320; }
	.good { background: #eef7ea; color: #2f5d2a; }
	.bad  { background: #fdeceb; color: #8a2318; }
	.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
	.busy .dot { animation: pulse 1.4s ease-in-out infinite; }
	@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
	@media (prefers-reduced-motion: reduce) { .busy .dot { animation: none } }
	a { color: inherit; text-decoration: underline; }
</style>
