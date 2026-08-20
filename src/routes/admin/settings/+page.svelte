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
	<h2>Who can sign in</h2>
	<p class="blurb">Everyone here has the same access. Each person changes their own password.</p>

	{#if form?.form === 'people' && form?.error}<p class="err" role="alert">{form.error}</p>
	{:else if form?.added}<p class="ok" role="status">{form.added} can now sign in. Tell them their starting password and ask them to change it.</p>
	{:else if form?.removed}<p class="ok" role="status">{form.removed} can no longer sign in.</p>{/if}

	<ul class="people">
		{#each data.people as person (person)}
			<li>
				<span class="who">{person}{#if person === data.me}<em>you</em>{/if}</span>
				<form method="POST" action="?/removePerson" class="inline">
					<input type="hidden" name="email" value={person} />
					<input
						name="myPassword"
						type="password"
						placeholder="Your password"
						autocomplete="current-password"
						required
						aria-label="Your password, to confirm removing {person}"
					/>
					<button class="remove">{person === data.me ? 'Remove myself' : 'Remove'}</button>
				</form>
			</li>
		{/each}
	</ul>
	{#if data.people.some((p) => p === data.me)}
		<p class="note">Removing yourself signs you out immediately.</p>
	{/if}

	<h3>Add someone</h3>
	<form method="POST" action="?/addPerson">
		<label><span>Their email</span><input name="email" type="email" autocomplete="off" required /></label>
		<label>
			<span>A starting password for them</span>
			<input name="theirPassword" type="password" autocomplete="new-password" required />
			<small>At least 12 characters. Tell it to them yourself, and ask them to change it once they are in.</small>
		</label>
		<label>
			<span>Your own password</span>
			<input name="myPassword" type="password" autocomplete="current-password" required />
			<small>So that finding an unattended screen is not enough to create an account.</small>
		</label>
		<button class="btn btn-primary sm">Add them</button>
	</form>
</section>

<section class="sec">
	<h2>Change your password</h2>
	<p class="blurb">Yours only — nobody can change anyone else's.</p>
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
	.people { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
	.people li { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
		padding: 11px 14px; background: var(--surface-page); border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm); }
	.who { flex: 1; font-size: var(--text-sm); min-width: 180px; }
	.who em { font-style: normal; font-size: 11px; letter-spacing: .08em; text-transform: uppercase;
		color: var(--text-muted); border: 1px solid var(--border-default); border-radius: var(--radius-pill);
		padding: 2px 8px; margin-left: 8px; }
	.inline { flex-direction: row; align-items: center; gap: 8px; margin: 0; flex-wrap: wrap; }
	.inline input { width: auto; min-width: 150px; }
	.remove { background: none; border: none; color: var(--rust-500); cursor: pointer;
		font: inherit; font-size: var(--text-xs); padding: 6px; white-space: nowrap; }
	h3 { font-family: var(--font-display); font-weight: 400; font-size: var(--text-lg);
		color: var(--brown-700); margin: 26px 0 0; }
	.ok { background: #eef7ea; border: 1px solid #c3e0b8; color: #2f5d2a; padding: 11px 14px;
		border-radius: var(--radius-sm); font-size: var(--text-sm); margin-top: 12px; }
</style>
