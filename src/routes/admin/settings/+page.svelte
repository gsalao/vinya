<script>
	let { data, form } = $props();
</script>

<svelte:head><title>Settings · Vinya</title></svelte:head>

<h1>Settings</h1>

<section class="sec">
	<h2>Who receives booking requests</h2>
	<p class="blurb">Separate several addresses with a comma. Everyone listed gets a copy.</p>
	{#if form?.error}<p class="err" role="alert">{form.error}</p>
	{:else if form?.saved === 'recipients'}<p class="ok" role="status">Saved.</p>{/if}
	<form method="POST" action="?/recipients">
		<label><span>Send to</span><input name="mail_to" value={data.settings.mail_to ?? ''} /></label>
		<label><span>Copy to (optional)</span><input name="mail_cc" value={data.settings.mail_cc ?? ''} /></label>
		<p class="note">Changing this emails whoever was receiving them before, so a change can never happen quietly.</p>
		<button class="btn btn-primary sm">Save</button>
	</form>
</section>

<section class="sec">
	<h2>Change your password</h2>
	{#if form?.saved === 'password'}<p class="ok" role="status">Changed. Use the new one next time.</p>{/if}
	<form method="POST" action="?/password">
		<label><span>New password</span><input name="password" type="password" autocomplete="new-password" /></label>
		<label><span>Type it again</span><input name="confirm" type="password" autocomplete="new-password" /></label>
		<p class="note">At least 12 characters. A short phrase you will remember beats a short jumble you will not.</p>
		<button class="btn btn-primary sm">Change password</button>
	</form>
</section>

<style>
	h1 { font-size: var(--text-3xl); color: var(--brown-700); margin-bottom: 22px; }
	.sec { background: var(--surface-card); border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md); padding: clamp(20px, 3vw, 30px); margin-bottom: 28px; max-width: 620px; }
	h2 { font-size: var(--text-xl); color: var(--brown-700); }
	.blurb, .note { color: var(--text-secondary); font-size: var(--text-sm); }
	.note { margin-top: 4px; }
	form { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; align-items: flex-start; }
	label { display: flex; flex-direction: column; gap: 5px; width: 100%; }
	label span { font-size: var(--text-xs); color: var(--text-secondary); }
	input { font: inherit; font-size: var(--text-sm); padding: 9px 11px; border: 1px solid var(--border-default);
		border-radius: var(--radius-sm); background: var(--surface-page); width: 100%; }
	.err { background: #fdeceb; border: 1px solid #f0b7b2; color: #8a2318; padding: 11px 14px;
		border-radius: var(--radius-sm); font-size: var(--text-sm); margin-top: 12px; }
	.ok { background: #eef7ea; border: 1px solid #c3e0b8; color: #2f5d2a; padding: 11px 14px;
		border-radius: var(--radius-sm); font-size: var(--text-sm); margin-top: 12px; }
</style>
