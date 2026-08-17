<script>
	import { booking, closeBooking } from '$lib/booking.js';
	import { bookOptions, timetable, locationOf, prices, priceById, isOneToOne } from '$lib/data.js';
	import { prepareReceipt, describeSize, ACCEPTED } from '$lib/receipt.js';
	import PayPanel from './PayPanel.svelte';

	// 'details' collects everything, 'verify' proves the address, 'done' confirms.
	// Splitting verification onto its own screen keeps the code entry from landing
	// far below the fold on a phone, where people miss it.
	let step = $state('details');
	let busy = $state(false);
	let failed = $state('');

	let selected = $state([]);
	let dateByItem = $state({});
	let name = $state('');
	let email = $state('');
	let notes = $state('');
	let website = $state(''); // honeypot: hidden, so a human never fills it in

	const HAVE_PASS = 'have-pass';
	let payChoice = $state('drop-in');
	let payTouched = $state(false);
	let payMethod = $state('tikkie');

	let receipt = $state(null);
	let receiptNote = $state('');

	let token = $state('');
	let code = $state('');
	let resendIn = $state(0);
	let sentTo = $state('');

	let chosenPass = $derived(payChoice === HAVE_PASS ? null : priceById(payChoice));
	let showPay = $derived(Boolean(chosenPass) && payMethod === 'tikkie');
	let oneToOne = $derived(selected.some(isOneToOne));

	$effect(() => {
		if (!payTouched) payChoice = oneToOne ? '1on1' : 'drop-in';
	});

	function choosePay(id) {
		payChoice = id;
		payTouched = true;
		if (id === HAVE_PASS) clearReceipt();
	}
	function chooseMethod(m) {
		payMethod = m;
		if (m === 'cash') clearReceipt();
	}
	function clearReceipt() {
		receipt = null;
		receiptNote = '';
	}

	async function onReceipt(e) {
		const file = e.target.files?.[0];
		if (!file) return clearReceipt();
		receiptNote = 'Checking…';
		const res = await prepareReceipt(file);
		if (!res.ok) {
			receipt = null;
			receiptNote =
				res.reason === 'size'
					? `That file is ${describeSize(res.size)} — please keep it under 4 MB.`
					: 'Please attach a JPEG, PNG, WebP or PDF.';
			e.target.value = '';
			return;
		}
		receipt = res.file;
		receiptNote = res.resized
			? `Attached · shrunk from ${describeSize(res.from)} to ${describeSize(res.to)}`
			: `Attached · ${describeSize(res.file.size)}`;
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
	const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

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

	/** One human-readable line per session, used in the owner's email. */
	function sessionLines() {
		return selected.map((o) => {
			const slot = slotFor(o);
			if (!slot) return o;
			const dateStr = fmtDate(new Date(dateByItem[o]));
			return `${o} · ${slot.day} ${dateStr} · ${slot.time}–${slot.end}${slot.location ? ` · ${slot.location}` : ''}`;
		});
	}

	$effect(() => {
		if ($booking.open) {
			step = 'details';
			failed = '';
			code = '';
			token = '';
			receipt = null;
			receiptNote = '';
			payTouched = false;
			payMethod = 'tikkie';
			selected = $booking.item && bookOptions.includes($booking.item) ? [$booking.item] : [];
			dateByItem = {};
		}
	});

	let timer;
	function startResendCooldown(seconds = 45) {
		resendIn = seconds;
		clearInterval(timer);
		timer = setInterval(() => {
			resendIn -= 1;
			if (resendIn <= 0) clearInterval(timer);
		}, 1000);
	}

	async function requestCode(e) {
		e?.preventDefault();
		if (busy || !selected.length) return;
		busy = true;
		failed = '';
		try {
			const res = await fetch('/api/otp', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email, website })
			});
			const data = await res.json();
			if (!res.ok) {
				failed = data.error ?? 'Could not send a code. Please try again.';
				return;
			}
			token = data.token;
			sentTo = email;
			step = 'verify';
			startResendCooldown();
		} catch {
			failed = 'Could not reach the site. Please check your connection and try again.';
		} finally {
			busy = false;
		}
	}

	async function resend() {
		if (resendIn > 0 || busy) return;
		code = '';
		await requestCode();
	}

	async function confirm(e) {
		e.preventDefault();
		if (busy || code.length !== 6) return;
		busy = true;
		failed = '';

		const fd = new FormData();
		fd.set('token', token);
		fd.set('code', code);
		fd.set('name', name);
		fd.set('email', email);
		fd.set('notes', notes);
		fd.set('joining', JSON.stringify(selected));
		fd.set('sessions', JSON.stringify(sessionLines()));
		fd.set('pass', chosenPass ? chosenPass.id : '');
		fd.set('method', payMethod);
		if (receipt) fd.set('receipt', receipt);

		try {
			const res = await fetch('/api/booking', { method: 'POST', body: fd });
			const data = await res.json();
			if (!res.ok) {
				failed = data.error ?? 'That did not go through. Please try again.';
				// An expired code cannot be retyped into working, so send them back
				// rather than leaving them guessing at the same box.
				if (data.reason === 'expired') resendIn = 0;
				return;
			}
			step = 'done';
		} catch {
			failed = 'Could not reach the site. Please check your connection and try again.';
		} finally {
			busy = false;
		}
	}

	function backToDetails() {
		step = 'details';
		failed = '';
	}

	function onKey(e) {
		if (e.key === 'Escape' && $booking.open) closeBooking();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if $booking.open}
	<!-- Clicking the scrim closes. Keyboard users close with Escape, handled above,
	     so the interaction is not mouse-only. -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.target === e.currentTarget && closeBooking()}>
		<div class="modal-card">
			<div class="modal-x"><button aria-label="Close" onclick={closeBooking}>×</button></div>
			<div class="modal-body">
				{#if step === 'details'}
					<div class="eyebrow">Booking request</div>
					<h3>Hold a place for me</h3>
					<form class="form" onsubmit={requestCode}>
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
							<legend>Which pass?</legend>
							<div class="check-grid">
								{#each prices as p}
									<label class="check-chip">
										<input type="radio" name="pass" value={p.id} checked={payChoice === p.id} onchange={() => choosePay(p.id)} />
										<span>{p.lbl} · {p.amt}</span>
									</label>
								{/each}
								<label class="check-chip">
									<input type="radio" name="pass" value={HAVE_PASS} checked={payChoice === HAVE_PASS} onchange={() => choosePay(HAVE_PASS)} />
									<span>I already have a pass</span>
								</label>
							</div>
						</fieldset>

						{#if chosenPass}
							<fieldset class="pay-pick">
								<legend>How would you like to pay?</legend>
								<div class="check-grid">
									<label class="check-chip">
										<input type="radio" name="method" value="tikkie" checked={payMethod === 'tikkie'} onchange={() => chooseMethod('tikkie')} />
										<span>Tikkie now</span>
									</label>
									<label class="check-chip">
										<input type="radio" name="method" value="cash" checked={payMethod === 'cash'} onchange={() => chooseMethod('cash')} />
										<span>Cash on arrival</span>
									</label>
								</div>
							</fieldset>
						{/if}

						{#if showPay}
							<PayPanel price={chosenPass} compact />
							<label class="receipt">
								<span>Paid already? Attach the receipt (optional)</span>
								<input type="file" accept={ACCEPTED} onchange={onReceipt} />
							</label>
							{#if receiptNote}<p class="form-note">{receiptNote}</p>{/if}
						{:else if chosenPass}
							<p class="form-note">{chosenPass.amt} on arrival. Cash or card at the studio.</p>
						{/if}

						<!-- Honeypot. Hidden from people and from screen readers; only a bot
						     filling every field will put anything in it. -->
						<div class="hp" aria-hidden="true">
							<label>Website<input tabindex="-1" autocomplete="off" bind:value={website} /></label>
						</div>

						{#if failed}<p class="form-alert" role="alert">{failed}</p>{/if}
						<div class="form-actions">
							<button class="btn btn-primary lg" type="submit" disabled={busy || !selected.length}>{busy ? 'Sending…' : 'Send request'}</button>
							<span class="form-note">We'll email you a code to confirm it's you.</span>
						</div>
					</form>
				{:else if step === 'verify'}
					<div class="eyebrow">One more step</div>
					<h3>Check your email</h3>
					<form class="form" onsubmit={confirm}>
						<p style="font-size:var(--text-base);line-height:1.8;color:var(--text-secondary);overflow-wrap:anywhere">
							We sent a six-digit code to <strong>{sentTo}</strong>. Enter it to send your request.
						</p>
						<label class="code-field">
							<span>Confirmation code</span>
							<input
								bind:value={code}
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength="6"
								placeholder="000000"
								oninput={(e) => (code = e.target.value.replace(/\D/g, '').slice(0, 6))}
							/>
						</label>
						{#if failed}<p class="form-alert" role="alert">{failed}</p>{/if}
						<div class="form-actions">
							<button class="btn btn-primary lg" type="submit" disabled={busy || code.length !== 6}>{busy ? 'Sending…' : 'Confirm & send'}</button>
							<button class="linkish" type="button" onclick={resend} disabled={resendIn > 0 || busy}>
								{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
							</button>
						</div>
						<p class="form-note">
							Not the right address? <button class="linkish" type="button" onclick={backToDetails}>Go back and change it</button>.
							The code lasts 10 minutes. Check your spam folder if it hasn't arrived.
						</p>
					</form>
				{:else}
					<div class="eyebrow">Request sent</div>
					<h3>Held, gently.</h3>
					<div style="display:flex;flex-direction:column;gap:18px">
						<p style="font-size:var(--text-base);line-height:1.8;color:var(--text-secondary)">
							Your request is in. You'll get a confirmation by email within a day.
						</p>
						{#if chosenPass && payMethod === 'cash'}
							<p class="form-note">{chosenPass.amt} due on arrival.</p>
						{:else if chosenPass && receipt}
							<p class="form-note">Your receipt went along with the request. Nothing else to do.</p>
						{:else if chosenPass}
							<p class="form-note">If you haven't paid the {chosenPass.amt} yet, you can still do it from the passes section, or on arrival.</p>
						{/if}
						<div><button class="btn btn-secondary" onclick={closeBooking}>Close</button></div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
