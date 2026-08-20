<script>
	import { upload, removeUploaded, imageId } from './resize.js';

	/** One photo, with the crop control that keeps faces in frame.
	 *
	 *  The site crops photos to fit boxes of different shapes, so the same
	 *  portrait is a tall column on one page and a wide band on another. Without
	 *  a way to say what matters in the picture, a standing photo in a wide slot
	 *  crops to the middle of a torso. Dragging the preview writes the focal
	 *  point the site already uses, so she can fix that herself instead of asking
	 *  a developer to edit numbers.
	 */
	let { row, column, index, slot, aspect = '4 / 5', help = '', crop = true, label = 'Photo' } = $props();

	let busy = $state(false);
	let error = $state('');
	let progress = $state('');
	let box;

	// Stored as strings because every other content column is a string; the
	// sliders and the drag both write back in the same shape.
	let fx = $derived(Number(row.fx ?? 50));
	let fy = $derived(Number(row.fy ?? 50));
	const clamp = (n) => Math.min(100, Math.max(0, n));

	async function pick(event) {
		const file = event.target.files?.[0];
		if (!file) return;
		error = '';
		busy = true;
		try {
			progress = 'Resizing…';
			const previous = row[column];
			const { url } = await upload(file, imageId(slot), { raw: !crop });
			progress = 'Saving…';
			row[column] = url;
			// Only after the new one is safely stored, so a failed upload never
			// leaves her with neither photo.
			await removeUploaded(previous);
			progress = '';
		} catch (e) {
			error = e.message ?? 'That did not work. Please try a different photo.';
		} finally {
			busy = false;
			event.target.value = '';
		}
	}

	function positionFrom(clientX, clientY) {
		const r = box.getBoundingClientRect();
		row.fx = String(Math.round(clamp(((clientX - r.left) / r.width) * 100)));
		row.fy = String(Math.round(clamp(((clientY - r.top) / r.height) * 100)));
	}

	let dragging = $state(false);
	function down(e) {
		if (!row[column]) return;
		dragging = true;
		positionFrom(e.clientX, e.clientY);
		box.setPointerCapture(e.pointerId);
	}
	function move(e) {
		if (dragging) positionFrom(e.clientX, e.clientY);
	}
	function up(e) {
		dragging = false;
		box.releasePointerCapture?.(e.pointerId);
	}

	// Keyboard equivalent: dragging is a mouse gesture, and the focal point is
	// the one setting where being unable to use it means asking for help.
	function key(e) {
		if (!row[column]) return;
		const step = e.shiftKey ? 10 : 2;
		const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
		const m = moves[e.key];
		if (!m) return;
		e.preventDefault();
		row.fx = String(clamp(fx + m[0]));
		row.fy = String(clamp(fy + m[1]));
	}
</script>

<div class="field">
	<span class="label">{label}</span>

	<div
		class="frame"
		style="aspect-ratio:{aspect}"
		bind:this={box}
		onpointerdown={crop ? down : undefined}
		onpointermove={move}
		onpointerup={up}
		onkeydown={key}
		role={row[column] && crop ? 'application' : 'presentation'}
		tabindex={row[column] && crop ? 0 : -1}
		aria-label={row[column] ? 'Drag or use the arrow keys to choose what stays in frame' : undefined}
	>
		{#if row[column] && crop}
			<img src={row[column]} alt="" style="object-position:{fx}% {fy}%" draggable="false" />
			<span class="pin" style="left:{fx}%; top:{fy}%"></span>
		{:else if row[column]}
			<img class="whole" src={row[column]} alt="" draggable="false" />
		{:else}
			<span class="empty">No photo yet</span>
		{/if}

		{#if busy}<span class="busy">{progress}</span>{/if}
	</div>

	{#if row[column] && crop}
		<p class="hint">Drag the picture to choose what stays in view when it is cropped. Arrow keys work too.</p>
	{/if}
	{#if help}<small>{help}</small>{/if}
	{#if error}<p class="err" role="alert">{error}</p>{/if}

	<div class="actions">
		<label class="btn btn-secondary sm">
			{row[column] ? `Replace ${label.toLowerCase()}` : `Choose a ${label.toLowerCase()}`}
			<input type="file" accept={crop ? "image/jpeg,image/png,image/webp" : "image/svg+xml,image/png,image/webp"} onchange={pick} disabled={busy} />
		</label>
		{#if row[column]}
			<button
				type="button"
				class="remove"
				onclick={async () => { const old = row[column]; row[column] = ''; await removeUploaded(old); }}
				disabled={busy}
			>Remove</button>
		{/if}
	</div>

	<!-- Named by row position, because the save action reads columns positionally.
	     `slot` names the file in storage and must not be used here: they held the
	     same value once, and the moment they diverged every image save silently
	     submitted an empty field. -->
	<input type="hidden" name={`${index}.${column}`} value={row[column] ?? ''} />
</div>

<style>
	.field { display: flex; flex-direction: column; gap: 8px; grid-column: 1 / -1; }
	.label { font-size: var(--text-xs); color: var(--text-secondary); }
	.frame { position: relative; width: 100%; max-width: 300px; overflow: hidden;
		border-radius: var(--radius-sm); border: 1px solid var(--border-default);
		background: var(--surface-sunken); cursor: grab; touch-action: none; }
	.frame:active { cursor: grabbing; }
	.frame:focus-visible { outline: 2px solid var(--sky-500); outline-offset: 2px; }
	.frame img { width: 100%; height: 100%; object-fit: cover; display: block; user-select: none; }
	.frame img.whole { object-fit: contain; padding: 14px; background: var(--surface-card); }
	.pin { position: absolute; width: 14px; height: 14px; border-radius: 50%; translate: -50% -50%;
		border: 2px solid #fff; background: rgba(0, 0, 0, .35); box-shadow: 0 0 0 1px rgba(0, 0, 0, .3);
		pointer-events: none; }
	.empty { position: absolute; inset: 0; display: grid; place-items: center;
		color: var(--text-muted); font-size: var(--text-sm); }
	.busy { position: absolute; inset: 0; display: grid; place-items: center;
		background: rgba(251, 246, 239, .86); font-size: var(--text-sm); color: var(--brown-700); }
	.hint, small { font-size: 11px; color: var(--text-muted); line-height: 1.45; }
	.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
	.actions label { position: relative; overflow: hidden; cursor: pointer; }
	.actions input[type='file'] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
	.remove { background: none; border: none; color: var(--rust-500); cursor: pointer;
		font: inherit; font-size: var(--text-xs); padding: 4px; }
	.err { background: #fdeceb; border: 1px solid #f0b7b2; color: #8a2318; padding: 9px 12px;
		border-radius: var(--radius-sm); font-size: var(--text-sm); margin: 0; }
</style>
