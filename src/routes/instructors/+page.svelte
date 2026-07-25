<script>
	import { reveal } from '$lib/reveal.js';
	import Ph from '$lib/components/Ph.svelte';
	import { openBooking } from '$lib/booking.js';
</script>

<svelte:head><title>Instructors — Vinya Yoga</title></svelte:head>

<section>
	<div class="wrap phead">
		<div class="eyebrow">Instructors</div>
		<h1>The person holding the room.</h1>
		<p>Vinya is small and personal on purpose. For now that means one teacher who knows every regular by name, with room to grow the circle as the studio does.</p>
	</div>
</section>

<section class="sec" style="padding-top:clamp(56px,7vh,80px)">
	<div class="wrap teacher">
		<!-- LEFT: portrait + facts (fills the column, no empty gap) -->
		<div class="profile reveal" use:reveal>
			<div class="portrait"><Ph cap="Nikita Coppens" /></div>
			<div class="facts">
				<div class="k">At a glance</div>
				<div class="row">
					<div><span>Based in</span><b>Netherlands</b></div>
					<div><span>Teaches</span><b>Yoga &amp; breathwork</b></div>
					<div><span>Also offers</span><b>1:1 holistic sessions</b></div>
					<div><span>Background</span><b>Mental-health care (GGZ)</b></div>
					<div><span>Studied in</span><b>India</b></div>
				</div>
			</div>
			<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 with Nikita</button>
		</div>

		<!-- RIGHT: name, tagline, bio -->
		<div class="reveal" use:reveal>
			<div class="eyebrow" style="color:var(--rust-500)">Founder &amp; teacher</div>
			<h2 style="margin-top:16px">Nikita Coppens</h2>
			<p class="tagline">A guide into slow, honest yoga, and the quiet work of the nervous system.</p>
			<div class="role">Yoga teacher · Holistic therapeut · Netherlands</div>
			<div class="bio">
				<p class="lede">Nikita came to yoga the long way around, through years of care work, and it shows in how she holds a room. Patient, attuned, and unhurried.</p>
				<p>Before Vinya, Nikita worked in mental-health care across the Netherlands, as a personal support worker in a sheltered-living organisation. Her caseload was wide and often complex: people living with a mild intellectual disability, borderline, or schizophrenia. She wrote care plans, carried her own caseload, and arranged support through WMO, WLZ and PGB. Work like that teaches you to meet a person where they are, not where a plan says they should be.</p>
				<p>Her attention kept circling the same question: lasting change, approached holistically. She trained further as an addiction counsellor with Elsden Trainingen, then followed the question further still, to India, where she studied yoga, sound healing and alternative medicine. It widened what health could mean to her. Not only care, but awareness and connection, body and mind treated as one.</p>
				<p>For the past four years she has been holding gatherings where people come together and, through breath, movement or sound, find a little healing of body and mind. She believes deeply in community and in breaking loneliness: a safe room where people can be themselves and not have to stand alone in whatever they are moving through.</p>
				<p>At Vinya she brings both halves together, professional care and a broader view of wellbeing, into classes and 1:1 holistic sessions. The intention is always the same. Leave with a little more room to breathe.</p>
			</div>

			<div class="chips" style="margin-top:32px">
				<span class="chip">Yoga</span><span class="chip">Sound healing</span><span class="chip">Holistic therapy</span><span class="chip">Breathwork</span><span class="chip">1:1 sessions</span><span class="chip">Community</span>
			</div>

			<div class="studio-strip">
				<div class="g"><Ph cap="In the studio" tone="sage" /></div>
				<div class="g"><Ph cap="A gathering" tone="sky" /></div>
			</div>

			<div class="spec-list">
				<div class="spec"><h4>How she teaches</h4><p>Patient and attuned. She meets you where you are today, offering an invitation as clearly as an instruction.</p></div>
				<div class="spec"><h4>Care background</h4><p>Years in Dutch mental-health care (GGZ) as a personal support worker, and trained as an addiction counsellor.</p></div>
				<div class="spec"><h4>Studied in India</h4><p>Yoga, sound healing and alternative medicine, where her view of health widened to body and mind as one.</p></div>
				<div class="spec"><h4>Beyond class</h4><p>1:1 holistic sessions and community sound-healing gatherings, built around not standing alone.</p></div>
			</div>

			<div style="margin-top:44px;display:flex;gap:14px;flex-wrap:wrap">
				<button class="btn btn-primary" onclick={() => openBooking('1:1 Holistic session')}>Book a 1:1 with Nikita</button>
				<a class="btn btn-secondary" href="/classes">See the timetable</a>
			</div>
		</div>
	</div>
</section>

<section class="sec sunken">
	<div class="wrap wrap-narrow" style="text-align:center">
		<div class="divider reveal" use:reveal><div class="line"></div><span class="lbl">Growing the circle</span><div class="line"></div></div>
		<blockquote class="blockquote-lg reveal" use:reveal style="margin-top:48px;max-width:24ch">Room for more teachers, when the right ones arrive.</blockquote>
		<p class="reveal" use:reveal style="font-size:var(--text-base);line-height:1.85;color:var(--text-secondary);margin:28px auto 0;max-width:52ch">Vinya will stay small, but not solo forever. As guest teachers and workshop leaders join, they'll be introduced here, each with their own way of holding the room.</p>
		<div class="reveal" use:reveal style="margin-top:36px"><button class="btn btn-secondary" onclick={() => openBooking('a class')}>Get in touch about teaching</button></div>
	</div>
</section>
