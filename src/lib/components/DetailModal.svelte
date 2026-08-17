<script>
	import { detail, closeDetail } from '$lib/detail.js';
	import { openBooking } from '$lib/booking.js';

	function onKey(e) {
		if (e.key === 'Escape' && $detail.open) closeDetail();
	}
	function book() {
		const label = $detail.bookLabel;
		closeDetail();
		openBooking(label);
	}
</script>

<svelte:window onkeydown={onKey} />

{#if $detail.open}
	<!-- Clicking the scrim closes. Keyboard users close with Escape, handled above,
	     so the interaction is not mouse-only. -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.target === e.currentTarget && closeDetail()}>
		<div class="modal-card">
			<div class="modal-x"><button aria-label="Close" onclick={closeDetail}>×</button></div>
			<div class="modal-body">
				<div class="eyebrow">{$detail.eyebrow}</div>
				<h3>{$detail.title}</h3>
				<div style="display:flex;flex-direction:column;gap:16px">
					{#if $detail.meta}<p class="form-note">{$detail.meta}</p>{/if}
					{#if $detail.body}<p style="font-size:var(--text-base);line-height:1.8;color:var(--text-secondary)">{$detail.body}</p>{/if}
					{#if $detail.location}<p class="form-note">{$detail.location}</p>{/if}
					<div><button class="btn btn-primary lg" onclick={book}>Book {$detail.bookLabel}</button></div>
				</div>
			</div>
		</div>
	</div>
{/if}
