<script>
	let { form } = $props();
	let busy = $state(false);

	// bind:value, not value={}. A plain value attribute is reactive in Svelte 5,
	// so the re-render caused by setting `busy` on submit re-applied the initial
	// value and wiped what was typed — the form then posted an empty email and
	// the server correctly refused it, while blaming the address.
	let email = $state(form?.email ?? '');
</script>

<svelte:head><title>Sign in · Vinya</title><meta name="robots" content="noindex" /></svelte:head>

<div class="shell">
	<form method="POST" class="card" onsubmit={() => (busy = true)}>
		<img class="mark" src="/logos/vinya-logo-brown.png" alt="Vinya" />
		<h1>Edit your site</h1>

		{#if form?.error}
			<p class="err" role="alert">{form.error}</p>
		{/if}

		<label>
			<span>Email</span>
			<input name="email" type="email" autocomplete="username" required bind:value={email} />
		</label>
		<label>
			<span>Password</span>
			<input name="password" type="password" autocomplete="current-password" required />
		</label>

		<button class="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
	</form>
</div>

<style>
	.shell { min-height: 100svh; display: grid; place-items: center; padding: 24px; background: var(--surface-sunken); }
	.card { width: min(420px, 100%); background: var(--surface-card); border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg); padding: clamp(28px, 5vw, 44px); box-shadow: var(--shadow-card);
		display: flex; flex-direction: column; gap: 18px; }
	.mark { height: 64px; width: auto; margin: 0 auto 4px; }
	h1 { font-size: var(--text-2xl); color: var(--brown-700); text-align: center; margin-bottom: 6px; }
	label { display: flex; flex-direction: column; gap: 7px; }
	label span { font-size: var(--text-sm); color: var(--text-secondary); }
	input { font: inherit; padding: 12px 14px; border: 1px solid var(--border-default);
		border-radius: var(--radius-sm); background: var(--surface-page); color: var(--text-primary); }
	input:focus-visible { outline: 2px solid var(--sky-500); outline-offset: 1px; }
	.err { background: #fdeceb; border: 1px solid #f0b7b2; color: #8a2318; padding: 11px 14px;
		border-radius: var(--radius-sm); font-size: var(--text-sm); margin: 0; }
	button { margin-top: 4px; }
</style>
