<script>
	import { page } from '$app/stores';
	import { openBooking } from '$lib/booking.js';

	let menuOpen = $state(false);
	let scrolled = $state(false);

	const links = [
		{ href: '/', label: 'Home' },
		{ href: '/classes', label: 'Classes' },
		{ href: '/instructors', label: 'Instructors' },
		{ href: '/events', label: 'Events' },
		{ href: '/about', label: 'About' }
	];

	function isActive(href) {
		const p = $page.url.pathname;
		return href === '/' ? p === '/' : p.startsWith(href);
	}
	const close = () => (menuOpen = false);

	$effect(() => {
		document.body.classList.toggle('menu-open', menuOpen);
	});
	$effect(() => {
		const onScroll = () => (scrolled = window.scrollY > 8);
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});
</script>

<header class:scrolled>
	<div class="wrap nav">
		<a href="/" class="brand" onclick={close}>Vinya</a>
		<nav class="nav-links" aria-label="Primary">
			{#each links as l}
				<a href={l.href} class:active={isActive(l.href)}>{l.label}</a>
			{/each}
		</nav>
		<div class="nav-right">
			<button class="btn btn-primary sm" onclick={() => openBooking('a class')}>Book a class</button>
			<button
				class="hamburger"
				aria-label="Menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span></span><span></span><span></span>
			</button>
		</div>
	</div>
</header>

<div class="mobile-menu">
	{#each links as l, i}
		<a href={l.href} class:active={isActive(l.href)} onclick={close}>
			<span>{l.label}</span><span class="n">0{i + 1}</span>
		</a>
	{/each}
	<div class="mobile-cta">
		<button class="btn btn-primary lg" onclick={() => { close(); openBooking('a class'); }}>Book a class</button>
		<a class="btn btn-secondary lg" href="/instructors" onclick={close}>Meet Nikita</a>
	</div>
</div>
