<script>
	import { enhance } from '$app/forms';
	import { fieldFor, blankRow } from './fields.js';
	import ImageField from './ImageField.svelte';

	let { section, form } = $props();

	let rows = $state(section.rows.map((r) => ({ ...r, __deleted: false })));
	let busy = $state(false);
	let saved = $state(false);

	let problems = $derived(form?.tab === section.tab ? (form.problems ?? []) : []);
	let problemFor = $derived((i) => problems.filter((p) => p.row === i + 1));

	function add() {
		rows = [...rows, { ...blankRow(section.columns), __deleted: false }];
		saved = false;
	}
	function move(i, by) {
		const to = i + by;
		if (to < 0 || to >= rows.length) return;
		const next = [...rows];
		[next[i], next[to]] = [next[to], next[i]];
		rows = next;
		saved = false;
	}
	const live = $derived(rows.filter((r) => !r.__deleted));
</script>

<section class="sec">
	<header>
		<h2>{section.title}</h2>
		{#if section.alsoOn}<span class="chip">also shown on {section.alsoOn}</span>{/if}
	</header>
	{#if section.blurb}<p class="blurb">{section.blurb}</p>{/if}

	{#if problems.length > 0}
		<div class="problems" role="alert">
			<strong>Not saved — {problems.length === 1 ? 'one thing needs fixing' : `${problems.length} things need fixing`}:</strong>
			<ul>
				{#each problems as p, i (i)}
					<li>{p.row ? `Row ${p.row}: ` : ''}{p.message}</li>
				{/each}
			</ul>
		</div>
	{:else if saved}
		<p class="ok" role="status">Saved. It will appear on the site shortly.</p>
	{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			busy = true;
			saved = false;
			return async ({ update, result }) => {
				await update({ reset: false });
				busy = false;
				if (result.type === 'success') saved = true;
			};
		}}
	>
		<input type="hidden" name="__tab" value={section.tab} />
		<input type="hidden" name="__count" value={rows.length} />
		<input type="hidden" name="__only" value={section.only ?? ''} />

		{#each rows as row, i (i)}
			<input type="hidden" name="__deleted.{i}" value={row.__deleted ? '1' : '0'} />
			{#if !row.__deleted}
				<article class="row" class:bad={problemFor(i).length > 0}>
					<div class="grip" class:hidden={section.fixed}>
						<span class="num">{live.indexOf(row) + 1}</span>
						<button type="button" onclick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
						<button type="button" onclick={() => move(i, 1)} aria-label="Move down" disabled={i === rows.length - 1}>↓</button>
					</div>

					<div class="fields">
						{#each section.columns as column (column)}
							{@const f = fieldFor(section.tab, column)}
							{#if f.kind === 'image' || f.kind === 'logo'}
								<ImageField
									{row}
									{column}
									slot={row.key ? String(row.key) : `${section.tab}-${i + 1}`}
									label={f.label}
									help={f.help}
									crop={f.kind === 'image'}
									aspect={f.kind === 'logo' ? '3 / 2' : '4 / 5'}
								/>
							{:else if f.kind === 'hidden'}
								<input type="hidden" name="{i}.{column}" bind:value={row[column]} />
							{:else}
							<label class:wide={f.kind === 'para' || f.kind === 'lines'}>
								<span>{f.label}</span>
								{#if f.kind === 'para'}
									<textarea name="{i}.{column}" rows="3" bind:value={row[column]}></textarea>
								{:else if f.kind === 'lines'}
									<textarea name="{i}.{column}" rows="4" bind:value={row[column]}></textarea>
								{:else if f.kind === 'flag'}
									<select name="{i}.{column}" bind:value={row[column]}>
										<option value="">No</option>
										<option value="yes">Yes</option>
									</select>
								{:else if f.kind === 'locked'}
									<input name="{i}.{column}" value={row[column]} readonly class="locked" />
								{:else}
									<input name="{i}.{column}" bind:value={row[column]} />
								{/if}
								{#if f.help}<small>{f.help}</small>{/if}
							</label>
							{/if}
						{/each}
					</div>

					{#if !section.fixed}
						<button type="button" class="del" onclick={() => { row.__deleted = true; saved = false; }} aria-label="Remove this one">Remove</button>
					{/if}
				</article>
			{/if}
		{/each}

		{#if live.length === 0}
			<p class="empty">Nothing here yet.</p>
		{/if}

		<div class="actions">
			{#if !section.fixed}
				<button type="button" class="btn btn-secondary sm" onclick={add}>Add another</button>
			{/if}
			<button class="btn btn-primary sm" disabled={busy}>{busy ? 'Saving…' : 'Save this section'}</button>
		</div>
	</form>
</section>

<style>
	.sec { background: var(--surface-card); border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md); padding: clamp(20px, 3vw, 30px); margin-bottom: 28px; }
	header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
	h2 { font-size: var(--text-xl); color: var(--brown-700); }
	.chip { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted);
		border: 1px solid var(--border-default); border-radius: var(--radius-pill); padding: 3px 10px; }
	.blurb { color: var(--text-secondary); font-size: var(--text-sm); margin-top: 8px; }
	.row { display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: start;
		padding: 18px 0; border-top: 1px solid var(--border-subtle); }
	.row.bad { background: #fdf4f3; border-radius: var(--radius-sm); padding-inline: 12px; }
	.grip.hidden { display: none; }
	.grip { display: flex; flex-direction: column; align-items: center; gap: 4px; }
	.num { font-size: 12px; color: var(--text-muted); }
	.grip button { width: 26px; height: 24px; border: 1px solid var(--border-default); background: var(--surface-page);
		border-radius: var(--radius-sm); cursor: pointer; color: var(--text-secondary); }
	.grip button:disabled { opacity: .3; cursor: default; }
	.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
	label { display: flex; flex-direction: column; gap: 5px; }
	label.wide { grid-column: 1 / -1; }
	label span { font-size: var(--text-xs); color: var(--text-secondary); letter-spacing: .02em; }
	input, textarea, select { font: inherit; font-size: var(--text-sm); padding: 9px 11px;
		border: 1px solid var(--border-default); border-radius: var(--radius-sm);
		background: var(--surface-page); color: var(--text-primary); width: 100%; }
	textarea { resize: vertical; line-height: 1.5; }
	.locked { background: var(--surface-sunken); color: var(--text-muted); }
	small { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
	.del { align-self: start; background: none; border: none; color: var(--rust-500); cursor: pointer;
		font: inherit; font-size: var(--text-xs); padding: 4px; }
	.actions { display: flex; gap: 10px; margin-top: 20px; padding-top: 18px;
		border-top: 1px solid var(--border-subtle); flex-wrap: wrap; }
	.problems { background: #fdeceb; border: 1px solid #f0b7b2; color: #8a2318; padding: 12px 16px;
		border-radius: var(--radius-sm); margin-top: 14px; font-size: var(--text-sm); }
	.problems ul { margin: 8px 0 0; padding-left: 18px; }
	.problems li { margin-top: 4px; }
	.ok { background: #eef7ea; border: 1px solid #c3e0b8; color: #2f5d2a; padding: 11px 16px;
		border-radius: var(--radius-sm); margin-top: 14px; font-size: var(--text-sm); }
	.empty { color: var(--text-muted); font-size: var(--text-sm); padding: 18px 0; }
	@media (max-width: 640px) { .row { grid-template-columns: 1fr; } .grip { flex-direction: row; } }
</style>
