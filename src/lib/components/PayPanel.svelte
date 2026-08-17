<script>
	// The single pay block, shared by the passes section and the booking
	// confirmation. Both entry points render the same markup so there is only one
	// place where a payment instruction can be got wrong.
	let { price, compact = false } = $props();

	// Shown under the code so a visitor can check the domain before paying. A QR
	// is opaque to a human, so the readable URL is the only thing that makes a
	// swapped code detectable.
	let display = $derived(price.pay.url.replace(/^https:\/\//, ''));
</script>

<div class="pay-panel {compact ? 'compact' : ''}">
	<div class="pay-head">
		<span class="pay-amt">{price.amt}</span>
		<span class="pay-lbl">{price.lbl}</span>
	</div>

	<a class="btn btn-primary lg pay-cta" href={price.pay.url} target="_blank" rel="noopener noreferrer">
		Pay with Tikkie
	</a>

	<div class="pay-qr">
		<span class="pay-or">or scan from another device</span>
		<img src={price.pay.qr} alt="Tikkie payment code for the {price.lbl} ({price.amt})" width="422" height="422" loading="lazy" decoding="async" />
		<span class="pay-url">{display}</span>
	</div>

	<p class="pay-note">
		Payment is handled by Tikkie (ABN AMRO) and opens on their site. Check the link starts with
		<strong>tikkie.me</strong> before you pay. Vinya will never ask you for card or IBAN details.
	</p>
</div>
