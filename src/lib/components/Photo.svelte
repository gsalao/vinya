<!-- Drop-in photo that always fills its box and never grows it.
     The box decides the size; the picture is cropped to fit, never the other way round.

     Framing is set with a focal point instead of an image editor:
       fx / fy    the point of the photo (0-100%) kept in view when it's cropped.
                  Raising fy slides the picture UP, showing more of its lower half.
       zoom       1 = fit, higher crops in around that point
       *Mobile    optional separate framing below 820px, where the box is a very
                  different shape. Falls back to the desktop values when unset.

     While `npm run dev` is running you can hold ALT and drag the photo to move it,
     or ALT + scroll to zoom. The values are copied to the clipboard on release,
     ready to paste back into the tag. Drag it at phone width and it hands you the
     mobile props instead. -->
<script>
	import { dev } from '$app/environment';
	import { untrack } from 'svelte';

	let {
		src,
		srcset = undefined,
		sizes = undefined,
		alt = '',
		fx = 50,
		fy = 10,
		zoom = 1,
		fxMobile = undefined,
		fyMobile = undefined,
		zoomMobile = undefined,
		cap = '',
		loading = 'lazy',
		fetchpriority = 'auto'
	} = $props();

	// Two framings: the wide layout and the narrow one below 820px. The props seed
	// them and the ALT-drag tool takes over from there, so reading them once (rather
	// than tracking them) is the point.
	let wide = $state(untrack(() => ({ x: fx, y: fy, z: zoom })));
	let narrow = $state(
		untrack(() => ({ x: fxMobile ?? fx, y: fyMobile ?? fy, z: zoomMobile ?? zoom }))
	);

	let isNarrow = $state(false);
	let box;
	let drag = null;
	let badge = $state('');
	let badgeTimer;

	const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

	$effect(() => {
		if (!dev) return;
		const mq = window.matchMedia('(max-width:820px)');
		const sync = () => (isNarrow = mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	function announce() {
		const f = isNarrow ? narrow : wide;
		const s = isNarrow ? 'Mobile' : '';
		const parts = [`fx${s}={${Math.round(f.x)}}`, `fy${s}={${Math.round(f.y)}}`];
		if (f.z > 1.005) parts.push(`zoom${s}={${f.z.toFixed(2)}}`);
		badge = parts.join(' ');
		navigator.clipboard?.writeText(badge).catch(() => {});
		clearTimeout(badgeTimer);
		badgeTimer = setTimeout(() => (badge = ''), 2600);
	}

	function down(e) {
		if (!dev || !e.altKey) return;
		e.preventDefault();
		drag = { px: e.clientX, py: e.clientY };
		box.setPointerCapture(e.pointerId);
	}

	function move(e) {
		if (!drag) return;
		const f = isNarrow ? narrow : wide;
		// dragging right pulls the picture right, which means showing more of its
		// left-hand side, so the focal percentage moves down
		f.x = clamp(f.x - ((e.clientX - drag.px) / box.clientWidth) * 100, 0, 100);
		f.y = clamp(f.y - ((e.clientY - drag.py) / box.clientHeight) * 100, 0, 100);
		drag.px = e.clientX;
		drag.py = e.clientY;
	}

	function up(e) {
		if (!drag) return;
		drag = null;
		box.releasePointerCapture(e.pointerId);
		announce();
	}

	function wheel(e) {
		if (!dev || !e.altKey) return;
		e.preventDefault();
		const f = isNarrow ? narrow : wide;
		f.z = clamp(f.z - e.deltaY * 0.0015, 1, 3);
		announce();
	}
</script>

<div
	class="photo"
	class:tunable={dev}
	bind:this={box}
	style="--fx:{wide.x}%;--fy:{wide.y}%;--z:{wide.z};--fx-m:{narrow.x}%;--fy-m:{narrow.y}%;--z-m:{narrow.z}"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onwheel={wheel}
>
	<img {src} {srcset} {sizes} {alt} {loading} {fetchpriority} decoding="async" draggable="false" />
	{#if cap}<span class="cap">{cap}</span>{/if}
	{#if dev && badge}<span class="focal-badge">{badge} · copied</span>{/if}
</div>

<style>
	.photo {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.photo img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--fx) var(--fy);
		transform: scale(var(--z));
		transform-origin: var(--fx) var(--fy);
		display: block;
		user-select: none;
	}
	@media (max-width: 820px) {
		.photo img {
			object-position: var(--fx-m) var(--fy-m);
			transform: scale(var(--z-m));
			transform-origin: var(--fx-m) var(--fy-m);
		}
	}
	.photo .cap {
		position: absolute;
		left: 24px;
		bottom: 22px;
		font-size: 10.5px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(88, 45, 26, 0.5);
	}
	/* dev only */
	.tunable {
		cursor: default;
	}
	.focal-badge {
		position: absolute;
		left: 12px;
		top: 12px;
		z-index: 5;
		padding: 6px 10px;
		border-radius: 6px;
		background: rgba(44, 26, 16, 0.82);
		color: #fbf6ef;
		font: 500 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
		letter-spacing: 0.04em;
		pointer-events: none;
	}
</style>
