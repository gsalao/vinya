<script>
	import { booking, closeBooking } from '$lib/booking.js';
	import { bookOptions, timetable } from '$lib/data.js';
	import { submitBooking } from '$lib/supabase.js';

	let sent = $state(false);
	let busy = $state(false);
	let selected = $state(bookOptions[0]);
	let name = $state('');
	let email = $state('');
	let notes = $state('');

	function addMinutes(time, mins) {
		const [h, m] = time.split(':').map(Number);
		const total = h * 60 + m + mins;
		return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
	}
	function slotFor(className) {
		for (const r of timetable) {
			for (const s of r.slots) {
				if (s[1] === className) return { day: r.day, time: s[0], end: addMinutes(s[0], parseInt(s[2], 10)), duration: s[2] };
			}
		}
		return null;
	}
	let slot = $derived(slotFor(selected));

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

	let dateOptions = $derived(slot ? nextDates(slot.day) : []);
	let selectedDate = $state(null);
	$effect(() => {
		selectedDate = dateOptions.length ? dateOptions[0].toISOString() : null;
	});

	$effect(() => {
		if ($booking.open) {
			sent = false;
			selected = bookOptions.includes($booking.item) ? $booking.item : bookOptions[0];
		}
	});
	$effect(() => {
		document.body.style.overflow = $booking.open ? 'hidden' : '';
	});

	async function submit(e) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		const dateStr = selectedDate ? fmtDate(new Date(selectedDate)) : slot?.day;
		const session = slot ? `${selected} · ${slot.day} ${dateStr} · ${slot.time}–${slot.end}` : selected;
		await submitBooking({ session, name, email, notes });
		busy = false;
		sent = true;
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
						<label>
							<span>What would you like to join?</span>
							<select bind:value={selected}>
								{#each bookOptions as o}<option value={o}>{o}</option>{/each}
							</select>
						</label>
						{#if slot}
							<label>
								<span>Which {slot.day}?</span>
								<select bind:value={selectedDate}>
									{#each dateOptions as d}<option value={d.toISOString()}>{slot.day} ({fmtDate(d)})</option>{/each}
								</select>
							</label>
							<p class="form-note">{slot.time}–{slot.end} · {slot.duration}</p>
						{/if}
						<div class="two">
							<label><span>Your name</span><input required bind:value={name} placeholder="Your name" /></label>
							<label><span>Email</span><input required type="email" bind:value={email} placeholder="you@email.com" /></label>
						</div>
						<label>
							<span>Anything I should know?</span>
							<textarea rows="2" bind:value={notes} placeholder="Injuries, first class, nerves. All welcome here."></textarea>
						</label>
						<div style="display:flex;gap:14px;align-items:center;margin-top:4px;flex-wrap:wrap">
							<button class="btn btn-primary lg" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
							<span class="form-note">No payment now. You'll hear back by email.</span>
						</div>
					</form>
				{:else}
					<div class="eyebrow">Request sent</div>
					<h3>Held, gently.</h3>
					<div style="display:flex;flex-direction:column;gap:18px">
						<p style="font-size:var(--text-base);line-height:1.8;color:var(--text-secondary)">Your request is in. You'll get a confirmation by email within a day, and payment can be on arrival or by transfer, whichever is easier.</p>
						<div><button class="btn btn-secondary" onclick={closeBooking}>Close</button></div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
