<script>
	import { page } from '$app/stores';
	import PublishBanner from '$lib/admin/PublishBanner.svelte';
	let { data, children } = $props();

	const PAGES = [
		['home', 'Home'],
		['classes', 'Classes'],
		['teachers', 'Teachers'],
		['events', 'Events'],
		['about', 'About']
	];
	let onLogin = $derived($page.url.pathname === '/admin/login');
</script>

<svelte:head><meta name="robots" content="noindex, nofollow" /></svelte:head>

{#if onLogin}
	{@render children()}
{:else}
	<div class="admin">
		<header class="bar">
			<a class="brand" href="/admin/home">Vinya</a>
			<nav>
				{#each PAGES as [slug, label] (slug)}
					<a href="/admin/{slug}" class:on={$page.params.page === slug}>{label}</a>
				{/each}
				<a href="/admin/settings" class:on={$page.url.pathname === '/admin/settings'}>Settings</a>
			</nav>
			<div class="who">
				<span>{data.user?.email}</span>
				<form method="POST" action="/admin/settings?/signout"><button>Sign out</button></form>
			</div>
		</header>

		<PublishBanner />

		<main>{@render children()}</main>

		<footer>
			<a href="/" target="_blank" rel="noopener">View the site →</a>
		</footer>
	</div>
{/if}

<style>
	.admin { min-height: 100svh; background: var(--surface-sunken); display: flex; flex-direction: column; }
	.bar { display: flex; align-items: center; gap: 28px; padding: 0 clamp(16px, 3vw, 32px); height: 64px;
		background: var(--surface-card); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
	.brand { font-family: var(--font-display); font-size: 24px; color: var(--brown-800); }
	nav { display: flex; gap: 4px; flex: 1; flex-wrap: wrap; }
	nav a { padding: 8px 14px; border-radius: var(--radius-pill); color: var(--text-secondary);
		font-size: var(--text-sm); }
	nav a:hover { background: var(--surface-sunken); color: var(--brown-700); }
	nav a.on { background: var(--brown-700); color: var(--cream-50); }
	.who { display: flex; align-items: center; gap: 12px; font-size: var(--text-xs); color: var(--text-muted); }
	.who button { background: none; border: none; color: var(--rust-500); cursor: pointer; font: inherit;
		font-size: var(--text-xs); padding: 0; }
	.who button:hover { color: var(--rust-600); }
	main { flex: 1; width: min(1100px, 100%); margin: 0 auto; padding: clamp(24px, 4vw, 44px) clamp(16px, 3vw, 32px) 64px; }
	footer { padding: 20px 32px 40px; text-align: center; font-size: var(--text-sm); }
	@media (max-width: 720px) {
		.bar { height: auto; padding-block: 12px; }
		.who { width: 100%; justify-content: space-between; }
	}
</style>
