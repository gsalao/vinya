export const classes = [
	{ name: 'Slow Flow', tone: 'tan', meta: '60 min · All levels · Mat provided', blurb: 'Long exhales, few poses, plenty of time. The one to start with.', detail: "Unhurried movement with long exhales. If you've never practised before, start here." },
	{ name: 'Vinyasa Bloom', tone: 'gold', meta: '75 min · Some experience', blurb: 'Breath-led movement that builds warmth, then lets it settle.', detail: 'Breath-led sequences that build warmth and then let it settle. Options offered throughout.' },
	{ name: 'Restore & Breathe', tone: 'sky', meta: '60 min · All levels · Bolsters', blurb: 'Supported shapes held long enough for the nervous system to believe you.', detail: 'Few shapes, held long. For weeks that have asked a lot of you.' },
	{ name: 'Breath & Sound', tone: 'rust', meta: '45 min · All levels · Lying down', blurb: 'Guided breathwork, then sound. You lie down for most of it.', detail: 'Guided breathwork followed by sound. No movement experience needed at all.' }
];

export const timetable = [
	{ day: 'Monday', slots: [['07:30', 'Slow Flow', '60 min'], ['18:30', 'Vinyasa Bloom', '75 min']] },
	{ day: 'Tuesday', slots: [['19:00', 'Restore & Breathe', '60 min']] },
	{ day: 'Wednesday', slots: [['07:30', 'Slow Flow', '60 min'], ['18:30', 'Breath & Sound', '45 min']] },
	{ day: 'Thursday', slots: [['18:30', 'Vinyasa Bloom', '75 min']] },
	{ day: 'Saturday', slots: [['09:30', 'Vinyasa Bloom', '75 min'], ['11:15', 'Slow Flow', '60 min']] }
];

export const prices = [
	{ lbl: 'Drop-in', amt: '€18', note: 'One class, whenever it suits.' },
	{ lbl: '5-class pass', amt: '€80', note: 'Valid three months. No rush.' },
	{ lbl: '10-class pass', amt: '€150', note: 'Valid six months. Most people land here.', feature: true },
	{ lbl: '1:1 session', amt: '€65', note: '75 min, yoga or holistic.' }
];

export const faqs = [
	{ q: "I've never done yoga. Is that really okay?", a: "Yes, and you won't be the only one. Slow Flow and Breath & Sound are both built for a first class. Tell us when you arrive and your teacher will keep an eye on you without making it obvious." },
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

export const bookOptions = [
	'Slow Flow', 'Vinyasa Bloom', 'Restore & Breathe', 'Breath & Sound', '1:1 Holistic session', 'Beginners course (4 evenings)',
	'Full Moon Flow & Sound Bath · 8 Aug', 'Bloom Slowly: beginners workshop · 23 Aug', 'Sunrise Rooftop Flow · 5 Sep', 'Breath & Body day retreat · 26 Sep'
];
