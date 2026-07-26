<script>
	import '../app.css';
	import { dev } from '$app/environment';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import Header from '$lib/components/Header.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import BookingModal from '$lib/components/BookingModal.svelte';
	let { children } = $props();

	injectAnalytics({ mode: dev ? 'development' : 'production' });
	injectSpeedInsights();
</script>

<svelte:head>
	<title>Vinya Yoga</title>
	<meta name="description" content="Vinya. A small yoga studio in the Netherlands. Slow, warm, unhurried classes and quiet gatherings with Nikita Coppens. All levels welcome." />
</svelte:head>

<Header />
<main>{@render children()}</main>
<Footer />
<BookingModal />
