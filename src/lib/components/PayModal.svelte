<script>
	import { pay, closePay } from '$lib/pay.js';
	import { priceById } from '$lib/data.js';
	import { openBooking } from '$lib/booking.js';
	import PayPanel from './PayPanel.svelte';

	let price = $derived(priceById($pay.id));

	function onKey(e) {
		if (e.key === 'Escape' && $pay.open) closePay();
	}
	function book() {
		closePay();
		openBooking();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if $pay.open && price}
	<!-- Clicking the scrim closes. Keyboard users close with Escape, handled above,
	     so the interaction is not mouse-only. -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal" role="dialog" aria-modal="true" tabindex="-1" aria-label="Pay for the {price.lbl}" onclick={(e) => e.target === e.currentTarget && closePay()}>
		<div class="modal-card">
			<div class="modal-x"><button aria-label="Close" onclick={closePay}>×</button></div>
			<div class="modal-body">
				<div class="eyebrow">Passes &amp; prices</div>
				<h3>{price.lbl}</h3>
				<PayPanel {price} />
				<p class="pay-after">
					{price.note} Paying here does not hold a place in a class —
					<button class="linkish" onclick={book}>send a booking request</button> for that.
				</p>
			</div>
		</div>
	</div>
{/if}
