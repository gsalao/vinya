<script>
	import { booking, closeBooking } from '$lib/booking.js';
	import { bookOptions, timetable, locationOf, prices, priceById, isOneToOne } from '$lib/data.js';
	import { submitBooking, supabaseEnabled } from '$lib/supabase.js';
	import PayPanel from './PayPanel.svelte';

	let sent = $state(false);
	let simulated = $state(false);
	let failed = $state('');
	let busy = $state(false);
	let selected = $state([]);
	let name = $state('');
	let email = $state('');
	let notes = $state('');
	let dateByItem = $state({});

	// HAVE_PASS is the one pay option with no Tikkie link behind it, so it is kept
	// distinct from a price id rather than faked as one.
	const HAVE_PASS = 'have-pass';
	let payChoice = $state('drop-in');
	let payTouched = $state(false);
	let paid = $state(null);

	let oneToOne = $derived(selected.some(isOneToOne));

	// Follow the selection until the visitor expresses a preference, then stop
	// moving under them. Picking a 1:1 and watching your chosen 10-class pass
	// silently flip to €60 is worse than the default being wrong once.
	$effect(() => {
		if (!payTouched) payChoice = oneToOne ? '1on1' : 'drop-in';
	});

	function choosePay(id) {
		payChoice = id;
		payTouched = true;
	}

	function addMinutes(time, mins) {
		const [h, m] = time.split(':').map(Number);
		const total = h * 60 + m + mins;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}
	function slotFor(className) {
		for (const r of timetable) {
			for (const s of r.slots) {
				if (s[1] === className) return { day: r.day, time: s[0], end: addMinutes(s[0], parseInt(s[2], 10)), duration: s[2], location: locationOf(className) };
			}
		}
		return null;
	}

	const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function nextDates(dayName, count = 8) {
		const target = DOW.indexOf(dayName);
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
		const dates = [];
		for (let i = 0; i < count; i++) {
			dates.push(new Date(d));
			d.setDate(d.getDate() + 7);
		}
		return dates;
	}
	function fmtDate(d) {
		return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
	}

	let itemsWithSlots = $derived(selected.map((n) => ({ name: n, slot: slotFor(n) })).filter((x) => x.slot));

	$effect(() => {
		for (const { name: n, slot } of itemsWithSlots) {
			if (!dateByItem[n]) dateByItem[n] = nextDates(slot.day)[0].toISOString();
		}
	});

	function toggle(o) {
		selected = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
	}

	let pickerSummary = $derived(
		selected.length === 0
			? 'Tap to choose — pick one or more'
			: selected.length <= 2
				? selected.join(', ')
				: `${selected.slice(0, 2).join(', ')} +${selected.length - 2} more`
	);

	$effect(() => {
		if ($booking.open) {
			sent = false;
			failed = '';
			selected = $booking.item && bookOptions.includes($booking.item) ? [$booking.item] : [];
			dateByItem = {};
			payTouched = false;
			paid = null;
		}
	});
	async function submit(e) {
		e.preventDefault();
		if (busy || !selected.length) return;
		busy = true;
		failed = '';
		const session = selected
			.map((o) => {
				const slot = slotFor(o);
				if (!slot) return o;
				const dateStr = fmtDate(new Date(dateByItem[o]));
				return `${o} · ${slot.day} ${dateStr} · ${slot.time}–${slot.end}${slot.location ? ` · ${slot.location}` : ''}`;
			})
			.join('; ');
		// Folded into notes rather than given its own column: the booking_requests
		// table is not ours to migrate from here, and an insert naming a column that
		// does not exist fails the whole request.
		const chosen = payChoice === HAVE_PASS ? null : priceById(payChoice);
		const payLine = chosen ? `Intends to pay: ${chosen.lbl} (${chosen.amt})` : 'Says they already have a pass';
		const body = notes.trim();
		const res = await submitBooking({ session, name, email, notes: body ? `${body}\n— ${payLine}` : payLine });
		busy = false;
		// Never claim a place is held when nothing reached the backend: without that
		// the form reads "Held, gently." whether the row was written, the insert was
		// rejected, or there is no backend configured at all.
		if (!res.ok) {
			failed = 'That did not go through. Please try again in a moment.';
			return;
		}
		simulated = Boolean(res.simulated);
		// Captured before the reset below, because the confirmation screen still
		// needs to show the code for whatever they picked.
		paid = chosen;
		sent = true;
		selected = [];
		dateByItem = {};
		name = '';
		email = '';
		notes = '';
	}
	function onKey(e) {
		if (e.key === 'Escape' && $booking.open) closeBooking();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if $booking.open}
	<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.target === e.currentTarget && closeBooking()}>
		<div class="modal-card">
			<div class="modal-x"><button aria-label="Close" onclick={closeBooking}>×</button></div>
			<div class="modal-body">
				{#if !sent}
					<div class="eyebrow">Booking request</div>
					<h3>Hold a place for me</h3>
					<form class="form" onsubmit={submit}>
						<details class="join-picker">
							<summary>
								<span>What would you like to join?</span>
								<span class="picker-summary">{pickerSummary}</span>
							</summary>
							<div class="check-grid">
								{#each bookOptions as o}
									<label class="check-chip">
										<input type="checkbox" checked={selected.includes(o)} onchange={() => toggle(o)} />
										<span>{o}</span>
									</label>
								{/each}
							</div>
						</details>
						{#each itemsWithSlots as { name: n, slot }}
							<label>
								<span>Which {slot.day} for {n}?</span>
								<select bind:value={dateByItem[n]}>
									{#each nextDates(slot.day) as d}<option value={d.toISOString()}>{slot.day} ({fmtDate(d)})</option>{/each}
								</select>
							</label>
							<p class="form-note">{slot.time}–{slot.end} · {slot.duration}{slot.location ? ` · ${slot.location}` : ''}</p>
						{/each}
						<div class="two">
							<label><span>Your name</span><input required bind:value={name} placeholder="Your name" /></label>
							<label><span>Email</span><input required type="email" bind:value={email} placeholder="you@email.com" /></label>
						</div>
						<label>
							<span>Anything I should know?</span>
							<textarea rows="2" bind:value={notes} placeholder="Injuries, first class, nerves. All welcome here."></textarea>
						</label>
						<fieldset class="pay-pick">
							<legend>How would you like to pay?</legend>
							<div class="check-grid">
								{#each prices as p}
									<label class="check-chip">
										<input type="radio" name="pay" value={p.id} checked={payChoice === p.id} onchange={() => choosePay(p.id)} />
										<span>{p.lbl} · {p.amt}</span>
									</label>
								{/each}
								<label class="check-chip">
									<input type="radio" name="pay" value={HAVE_PASS} checked={payChoice === HAVE_PASS} onchange={() => choosePay(HAVE_PASS)} />
									<span>I already have a pass</span>
								</label>
							</div>
							<p class="form-note">
								{#if payChoice === HAVE_PASS}
									Nothing to pay now. We'll check your remaining classes when we confirm.
								{:else}
									You'll get a Tikkie code to pay with once you send this. Nothing is charged here.
								{/if}
							</p>
						</fieldset>
						<div style="display:flex;gap:14px;align-items:center;margin-top:4px;flex-wrap:wrap">
							<button class="btn btn-primary lg" type="submit" disabled={busy || !selected.length}>{busy ? 'Sending…' : 'Send request'}</button>
							<span class="form-note">You'll hear back by email within a day.</span>
						</div>
						{#if failed}<p class="form-alert" role="alert">{failed}</p>{/if}
						{#if !supabaseEnabled}
							<p class="form-alert" role="status">Prototype mode. No booking backend is connected yet, so this form will not reach anyone.</p>
						{/if}
					</form>
				{:else}
					<div class="eyebrow">Request sent</div>
					<h3>Held, gently.</h3>
					<div style="display:flex;flex-direction:column;gap:18px">
						{#if simulated}
							<p class="form-alert" role="status">Prototype mode. Nothing was actually sent, because no booking backend is connected yet.</p>
						{:else}
							<p style="font-size:var(--text-base);line-height:1.8;color:var(--text-secondary)">Your request is in. You'll get a confirmation by email within a day.</p>
						{/if}
						{#if paid}
							<PayPanel price={paid} compact />
							<p class="form-note">Paying now saves a step, but you can also settle on arrival. Your place is held either way.</p>
						{:else}
							<p class="form-note">Nothing to pay now — we'll check your remaining classes when we confirm.</p>
						{/if}
						<div><button class="btn btn-secondary" onclick={closeBooking}>Close</button></div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
