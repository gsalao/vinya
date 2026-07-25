<script>
	let { cap = '', tone = '' } = $props();
</script>

<div class="ph {tone}">
	<img src="/logos/vinya-logo-brown.png" alt="" aria-hidden="true" />
	{#if cap}<span class="cap">{cap}</span>{/if}
</div>
