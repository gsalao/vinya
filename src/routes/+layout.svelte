<script>
	import '../app.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import BookingModal from '$lib/components/BookingModal.svelte';
	import DetailModal from '$lib/components/DetailModal.svelte';
	import PayModal from '$lib/components/PayModal.svelte';
	import { booking } from '$lib/booking.js';
	import { detail } from '$lib/detail.js';
	import { pay } from '$lib/pay.js';
	import { page } from '$app/stores';
	import { ADMIN_BASE } from '$lib/admin/paths.js';
	let { children } = $props();

	// The editor brings its own chrome. Without this the visitor-facing header,
	// footer and booking modals render around it — two navbars stacked, and a
	// "Book a class" button in a tool for editing the site.
	let isAdmin = $derived(
		$page.url.pathname === ADMIN_BASE || $page.url.pathname.startsWith(`${ADMIN_BASE}/`)
	);

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();

	$effect(() => {
		document.body.style.overflow = $booking.open || $detail.open || $pay.open ? 'hidden' : '';
	});
</script>

<svelte:head>
	<title>Vinya Yoga</title>
	<meta name="description" content="Vinya. A small yoga studio in the Netherlands. Slow, warm, unhurried classes and quiet gatherings with Nikita Coppens. All levels welcome." />
</svelte:head>

{#if isAdmin}
	{@render children()}
{:else}
	<Header />
	<main>{@render children()}</main>
	<Footer />
	<BookingModal />
	<DetailModal />
	<PayModal />
{/if}
