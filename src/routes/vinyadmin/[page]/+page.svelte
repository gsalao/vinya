<script>
	import { enhance } from '$app/forms';
	import SectionEditor from '$lib/admin/SectionEditor.svelte';

	let { data, form } = $props();

	const TITLES = { home: 'Home page', classes: 'Classes page', teachers: 'Teachers page',
		events: 'Events page', about: 'About page' };

	let copyBusy = $state(false);
	let copySaved = $state(false);
	let copyProblems = $derived(form?.tab === 'copy' ? (form.problems ?? []) : []);

	/** A key like home.hero.title reads as "Hero — title" once the page prefix is
	 *  stripped: she is already looking at the page, so repeating it is noise. */
	const pretty = (key) => {
		const parts = key.split('.').slice(1);
		const head = parts[0]?.replace(/(^|\s)\w/g, (c) => c.toUpperCase()) ?? key;
		return parts.length > 1 ? `${head} — ${parts.slice(1).join(' ')}` : head;
	};
	const isLong = (text) => text.length > 90 || text.includes('\n');
</script>

<svelte:head><title>{TITLES[data.pageKey]} · Vinya</title></svelte:head>

<h1>{TITLES[data.pageKey]}</h1>

{#if data.copy.length > 0}
	<section class="sec">
		<header><h2>Words on this page</h2></header>
		<p class="blurb">Press Enter inside a box to start a new paragraph.</p>

		{#if copyProblems.length > 0}
			<div class="problems" role="alert">
				<strong>Not saved — fix these first:</strong>
				<ul>{#each copyProblems as p, i (i)}<li>{p.message}</li>{/each}</ul>
			</div>
		{:else if copySaved}
			<p class="ok" role="status">Saved. It will appear on the site shortly.</p>
		{/if}

		<form method="POST" action="?/saveCopy" use:enhance={() => {
			copyBusy = true; copySaved = false;
			return async ({ update, result }) => {
				await update({ reset: false });
				copyBusy = false;
				if (result.type === 'success') copySaved = true;
			};
		}}>
			{#each data.copy as row (row.key)}
				<label class:wide={isLong(row.text)}>
					<span>{pretty(row.key)}</span>
					{#if isLong(row.text)}
						<textarea name="copy.{row.key}" rows="4">{row.text}</textarea>
					{:else}
						<input name="copy.{row.key}" value={row.text} />
					{/if}
				</label>
			{/each}
			<div class="actions">
				<button class="btn btn-primary sm" disabled={copyBusy}>{copyBusy ? 'Saving…' : 'Save the words'}</button>
			</div>
		</form>
	</section>
{/if}

{#each data.sections as section (section.tab)}
	<SectionEditor {section} {form} />
{/each}

{#if data.sections.length === 0 && data.copy.length === 0}
	<p class="empty">Nothing on this page is editable yet.</p>
{/if}

<style>
	h1 { font-size: var(--text-3xl); color: var(--brown-700); margin-bottom: 22px; }
	.sec { background: var(--surface-card); border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md); padding: clamp(20px, 3vw, 30px); margin-bottom: 28px; }
	h2 { font-size: var(--text-xl); color: var(--brown-700); }
	.blurb { color: var(--text-secondary); font-size: var(--text-sm); margin-top: 8px; }
	form { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-top: 18px; }
	label { display: flex; flex-direction: column; gap: 5px; }
	label.wide { grid-column: 1 / -1; }
	label span { font-size: var(--text-xs); color: var(--text-secondary); }
	input, textarea { font: inherit; font-size: var(--text-sm); padding: 9px 11px;
		border: 1px solid var(--border-default); border-radius: var(--radius-sm);
		background: var(--surface-page); color: var(--text-primary); width: 100%; }
	textarea { resize: vertical; line-height: 1.6; }
	.actions { grid-column: 1 / -1; padding-top: 16px; border-top: 1px solid var(--border-subtle); }
	.problems { background: #fdeceb; border: 1px solid #f0b7b2; color: #8a2318; padding: 12px 16px;
		border-radius: var(--radius-sm); margin-top: 14px; font-size: var(--text-sm); }
	.problems ul { margin: 8px 0 0; padding-left: 18px; }
	.ok { background: #eef7ea; border: 1px solid #c3e0b8; color: #2f5d2a; padding: 11px 16px;
		border-radius: var(--radius-sm); margin-top: 14px; font-size: var(--text-sm); }
	.empty { color: var(--text-muted); }
</style>
