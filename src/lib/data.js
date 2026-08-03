export const providers = {
	truColours: { name: 'Tru Colours', address: 'Geschutswerf 12-14, 1018 BX Amsterdam' }
};

// Add a new teacher by adding an entry here. photo.src/srcset point at files in
// static/images/; fx/fy are the focal point (see Photo.svelte for the ALT-drag tool).
export const teachers = [
	{
		slug: 'nikita-coppens',
		name: 'Nikita Coppens',
		role: 'Yoga teacher · Holistic therapeut',
		intro: 'Nikita came to yoga the long way around, through years of care work, and it shows in how she holds a room. Patient, attuned, and unhurried.',
		highlights: [
			'Originally from the Netherlands',
			'Teaches yoga, breathwork, and Kirtan',
			'Also offers 1:1 holistic sessions',
			'Background in Dutch mental-health care (GGZ)',
			'Studied yoga, sound healing and alternative medicine in India'
		],
		photo: {
			src: '/images/nikita-standing-2200.jpg',
			srcset: '/images/nikita-standing-1400.jpg 1400w, /images/nikita-standing-2200.jpg 2200w',
			alt: 'Nikita Coppens standing in natural light',
			fx: 50,
			fy: 20
		},
		cta: { label: 'Book a 1:1 with Nikita', option: '1:1 Holistic session' }
	}
];

export const classes = [
	{ name: 'Kundalini Yoga', tone: 'tan', meta: '60 min · All levels · Mat provided', blurb: 'Breath, mantra and movement built in kriyas that rise slowly, then let go.', provider: 'truColours' },
	{ name: 'Slow Yoga Adjustment', tone: 'sky', meta: '60 min · All levels · Hands-on adjustment', blurb: 'Slow shapes, held long, with hands-on adjustment so you feel exactly where you hold on.', provider: 'truColours' }
];

export const timetable = [
	{ day: 'Tuesday', slots: [['10:30', 'Kundalini Yoga', '60 min']] },
	{ day: 'Sunday', slots: [['12:45', 'Slow Yoga Adjustment', '60 min']] }
];

export const venue = providers.truColours;

export function locationOf(className) {
	const c = classes.find((cl) => cl.name === className);
	const p = c && providers[c.provider];
	return p ? `${p.name} · ${p.address}` : '';
}

export const prices = [
	{ lbl: 'Drop-in', amt: '€15', note: 'One class, whenever it suits.' },
	{ lbl: '5-class pass', amt: '€50', note: 'Valid three months. No rush.' },
	{ lbl: '10-class pass', amt: '€90', note: 'Valid six months. Most people land here.', feature: true },
	{ lbl: '1:1 session', amt: '€60', note: '75 min, yoga or holistic.' }
];

export const offerings = [
	{
		cat: 'Weekly', items: [
			{ name: 'Multi-Style Yoga Classes', note: 'A rotating mix of styles across the week, beyond the set timetable.' },
			{ name: 'Pre & Post Natal Yoga', note: 'Gentle, safe practice through pregnancy and after.' }
		]
	},
	{
		cat: 'Monthly', items: [
			{ name: 'Community Yoga & Brunch', note: 'Practice together, then stay for food.' },
			{ name: 'Social Events', note: 'Gatherings beyond the mat.' }
		]
	},
	{
		cat: 'Private', items: [
			{ name: 'Birthday Celebration', note: 'Yoga as part of the celebration, wherever you are hosting.' },
			{ name: 'Friend Gathering', note: 'A private class with your own group.' },
			{ name: '1:1 Sessions', note: 'One on one, yoga or holistic.' }
		]
	},
	{
		cat: 'Corporate Teambuilding', items: [
			{ name: 'Yoga, Soundhealing & Brunch', note: 'A team morning off-site, on the mat and around the table.' }
		]
	}
];

export const faqs = [
	{ q: "I've never done yoga. Is that really okay?", a: "Yes, and you won't be the only one. Kundalini Yoga and Slow Yoga Adjustment are both built for a first class. Tell us when you arrive and your teacher will keep an eye on you without making it obvious." },
	{ q: 'What should I bring?', a: 'Comfortable clothes, water, and socks if you get cold. Mats, bolsters and blankets are here. Bring your own mat if you would rather.' },
	{ q: 'How early should I arrive?', a: 'Ten minutes is plenty. Doors close at the start time so the room stays quiet. If you are running late, message us and we will let you in between sections.' },
	{ q: 'Do I need to book in advance?', a: 'Please do, groups are small and classes fill. Book through the form on this site and you will get a confirmation by email.' },
	{ q: 'What if I need to cancel?', a: 'Cancel up to 12 hours before and the class goes back on your pass. Life happens later than that sometimes, so just tell us. (Policy to confirm.)' }
];

export const events = [
	{
		month: 'August 2026', n: '2 gatherings', items: [
			{ d: '08', w: 'Sat', name: 'Full Moon Flow & Sound Bath', det: '19:00 · 90 min · €28 · Location to confirm', p: 'Slow flow as the light goes, then bowls and voice to close. Bring something warm to lie under.', rem: '6 places left' },
			{ d: '23', w: 'Sun', name: 'Bloom Slowly: a workshop for beginners', det: '10:00 · 3 hours · €45 · Tea included', p: 'Three unhurried hours on breath, the six shapes worth knowing, and a home practice that survives a normal week.', rem: '10 places' }
		]
	},
	{
		month: 'September 2026', n: '2 gatherings', items: [
			{ d: '05', w: 'Sat', name: 'Sunrise Rooftop Flow', det: '07:30 · 60 min · €22 · Rooftop, to confirm', p: 'Outdoors, weather permitting. Coffee afterwards for anyone who wants to stay.', rem: 'Weather dependent' },
			{ d: '26', w: 'Sat', name: 'Breath & Body: a day retreat', det: '09:30 to 16:00 · €95 · Lunch included', p: 'Two practices, a long lunch, and holistic bodywork in between. Eight people only.', rem: '8 places' }
		]
	}
];

// Add a new partner/facilitator by adding an entry here. logo points at a file in
// static/logos/. href is optional — with it the logo links out, without it the
// logo just shows its tooltip.
export const partners = [
	{ name: 'Partner One', logo: '/logos/partner-placeholder-1.svg', href: 'https://example.com' },
	{ name: 'Studio Two', logo: '/logos/partner-placeholder-2.svg' },
	{ name: 'Collective Three', logo: '/logos/partner-placeholder-3.svg', href: 'https://example.com' }
];

export const bookOptions = [
	'Kundalini Yoga', 'Slow Yoga Adjustment', '1:1 Holistic session', 'Beginners course (4 evenings)',
	'Multi-Style Yoga Classes', 'Pre & Post Natal Yoga', 'Community Yoga & Brunch', 'Social Events',
	'Birthday Celebration', 'Friend Gathering', '1:1 Sessions', 'Yoga, Soundhealing & Brunch',
	'Full Moon Flow & Sound Bath · 8 Aug', 'Bloom Slowly: beginners workshop · 23 Aug', 'Sunrise Rooftop Flow · 5 Sep', 'Breath & Body day retreat · 26 Sep'
];
