// The Proverbs 31 Business & Leadership Luncheon on Instagram + Facebook: six posts, Oct 17 – Nov 28 2026.
// The first three replace the "Winter Gala" posts already booked on those Saturdays (the Gala became
// the Luncheon on 2026-10-11); the rest build the run-up, one Saturday at a time, at the 6 PM slot the
// followers-online data favours. Facts come from the Eventbrite listing: Saturday December 19, 1:30 – 5 PM,
// The Four Event Center, 8599 Roswell Rd Suite B, Atlanta; seated meal, light refreshments, free parking,
// business casual, doors 1:15 PM, check in by 1:30, doors close 2 PM, limited seating, sales final.
export const TIMEZONE = 'America/New_York';
export const ACCOUNTS = { instagram: '6ac6716d90b16e751447d7fe', facebook: '6ac67950507b603704a87454' };
export const CALENDAR = 'p31-luncheon-2026';
export const TICKETS = 'https://www.eventbrite.com/e/proverbs-31-business-leadership-luncheon-tickets-2002850002272';

// The Winter Gala posts these replace (folder + post key in that folder's state.json).
export const REPLACES = [
  { folder: '2026-10', key: 'gala', why: 'Oct 17 Winter Gala teaser' },
  { folder: '2026-10-12', key: 'cta-vendors', why: 'Oct 24 vendor applications for the Winter Gala' },
  { folder: '2026-10-12', key: 'cta-gala', why: 'Nov 7 Winter Gala invitation' },
];

const TAGS = '#P31Marketplace #BusinessLuncheon #WomenInLeadership #FaithAndBusiness #AtlantaEvents #WomenEntrepreneurs #Proverbs31Woman';
const DATE = 'Saturday, December 19';
const WHEN = `${DATE} · 1:30 – 5 PM`;
const WHERE = 'The Four Event Center · Atlanta';

// kind: lunch (the invitation card) | opts (pick one) | prompt (finish the sentence)
export const POSTS = [
  {
    id: 'lunch-announce', when: '2026-10-17T18:00:00', label: 'Sat Oct 17 · 6:00 PM', kind: 'lunch',
    eyebrow: 'Proverbs 31 Marketplace presents', title: 'Business &amp; Leadership<br /><em>Luncheon</em>',
    date: DATE, meta: `1:30 – 5 PM · ${WHERE}`,
    items: ['Where faith meets fierce business moves', 'A seated meal and real conversation', 'Business owners and the women about to start'],
    pill: 'TICKETS ON EVENTBRITE · LINK IN BIO',
    instagram: `Save the date. ✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${WHEN} at ${WHERE}.\n\nAn afternoon where faith meets fierce business moves and leadership tips: a seated meal, light networking, and a room full of women building what God put in their hands. Business owners, aspiring entrepreneurs, and anyone ready to start are welcome.\n\nSeating is limited. Tickets are on Eventbrite (link in bio).\n\nWho are you bringing to the table? 👇\n\n${TAGS}`,
    facebook: `Save the date. ✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${WHEN} at ${WHERE}.\n\nAn afternoon where faith meets fierce business moves and leadership tips: a seated meal, light networking, and a room full of women building what God put in their hands. Business owners, aspiring entrepreneurs, and anyone ready to start are welcome.\n\nSeating is limited. Tickets: ${TICKETS}\n\nWho are you bringing to the table? 👇\n\n${TAGS}`,
  },
  {
    id: 'lunch-who', when: '2026-10-24T18:00:00', label: 'Sat Oct 24 · 6:00 PM', kind: 'opts',
    eyebrow: 'The Luncheon · Dec 19', question: 'Which seat is yours?',
    options: ['I own a business', 'I am about to start one', 'I am figuring out if I should'],
    ask: 'Comment A, B or C 👇',
    instagram: `Which seat is yours at the Business & Leadership Luncheon? 🪑\n\nA) I own a business\nB) I'm about to start one\nC) I'm figuring out if I should\n\nAll three belong in the room on ${DATE}. Comment your letter, and tell us the one thing you want to walk away with 👇\n\nTickets are on Eventbrite (link in bio).\n\n${TAGS}`,
    facebook: `Which seat is yours at the Business & Leadership Luncheon? 🪑\n\nA) I own a business\nB) I'm about to start one\nC) I'm figuring out if I should\n\nAll three belong in the room on ${DATE}. Comment your letter, and tell us the one thing you want to walk away with 👇\n\nTickets: ${TICKETS}\n\n${TAGS}`,
  },
  {
    id: 'lunch-tickets', when: '2026-11-07T18:00:00', label: 'Sat Nov 7 · 6:00 PM', kind: 'lunch',
    eyebrow: `${DATE} · Atlanta`, title: 'What your ticket<br /><em>includes</em>',
    date: 'Business &amp; Leadership Luncheon', meta: `1:30 – 5 PM · ${WHERE}`,
    items: ['A seated meal and light refreshments', 'Light networking before doors close at 2 PM', 'Free parking on site', 'Doors open 1:15 PM · arrive by 1:30'],
    pill: 'LIMITED SEATING · LINK IN BIO',
    instagram: `Here's what your ticket to the Business & Leadership Luncheon includes 🍽️\n\n• A seated meal, with light refreshments through the afternoon\n• Light networking before we begin, so bring business cards\n• Free parking on site\n• Doors open at 1:15 PM; please arrive by 1:30. Doors close at 2.\n\n${WHEN}, ${WHERE}. Seating is limited and all sales are final, so reserve early. Tickets on Eventbrite (link in bio).\n\nWhat's one question you'd ask a room full of women leaders? 👇\n\n${TAGS}`,
    facebook: `Here's what your ticket to the Business & Leadership Luncheon includes 🍽️\n\n• A seated meal, with light refreshments through the afternoon\n• Light networking before we begin, so bring business cards\n• Free parking on site\n• Doors open at 1:15 PM; please arrive by 1:30. Doors close at 2.\n\n${WHEN}, ${WHERE}. Seating is limited and all sales are final, so reserve early. Tickets: ${TICKETS}\n\nWhat's one question you'd ask a room full of women leaders? 👇\n\n${TAGS}`,
  },
  {
    id: 'lunch-prompt', when: '2026-11-14T18:00:00', label: 'Sat Nov 14 · 6:00 PM', kind: 'prompt',
    eyebrow: 'Finish the sentence', text: 'The best business advice I ever got was', ask: 'Your line below 👇',
    instagram: `Finish the sentence: the best business advice I ever got was ______.\n\nWe'll read a few of your answers out loud at the Business & Leadership Luncheon on ${DATE}. 🎤\n\nDrop yours below 👇 Short or long, we read every one.\n\n${TAGS}`,
    facebook: `Finish the sentence: the best business advice I ever got was ______.\n\nWe'll read a few of your answers out loud at the Business & Leadership Luncheon on ${DATE}. 🎤 Tickets: ${TICKETS}\n\nDrop yours below 👇 Short or long, we read every one.\n\n${TAGS}`,
  },
  {
    id: 'lunch-countdown', when: '2026-11-21T18:00:00', label: 'Sat Nov 21 · 6:00 PM', kind: 'lunch',
    eyebrow: 'Four Saturdays to go', title: 'Business &amp; Leadership<br /><em>Luncheon</em>',
    date: DATE, meta: `1:30 – 5 PM · ${WHERE}`,
    items: ['Faith, business and leadership, over lunch', 'Dress: business casual', 'Seating is limited'],
    pill: 'TICKETS ON EVENTBRITE · LINK IN BIO',
    instagram: `Four Saturdays until the Business & Leadership Luncheon. 🗓️\n\n${WHEN}, ${WHERE}. Faith, business and leadership, over a seated lunch, with women who are building the same way you are.\n\nDress code is business casual. Seating is limited; tickets on Eventbrite (link in bio).\n\nHonest question: are you more excited for the lunch or the leadership talk? 😄 Tell us below 👇\n\n${TAGS}`,
    facebook: `Four Saturdays until the Business & Leadership Luncheon. 🗓️\n\n${WHEN}, ${WHERE}. Faith, business and leadership, over a seated lunch, with women who are building the same way you are.\n\nDress code is business casual. Seating is limited. Tickets: ${TICKETS}\n\nHonest question: are you more excited for the lunch or the leadership talk? 😄 Tell us below 👇\n\n${TAGS}`,
  },
  {
    id: 'lunch-dress', when: '2026-11-28T18:00:00', label: 'Sat Nov 28 · 6:00 PM', kind: 'opts',
    eyebrow: 'Business casual · Dec 19', question: 'Your Luncheon look?',
    options: ['Blazer, heels, power pose', 'Statement dress, soft glam'],
    ask: 'Comment A or B 👇',
    instagram: `Business casual for the Luncheon. What are you wearing? 👗🧥\n\nA) Blazer, heels, power pose\nB) Statement dress, soft glam\n\nComment A or B 👇 (Yes, we'll be looking for you on ${DATE}.)\n\nTickets on Eventbrite (link in bio).\n\n${TAGS}`,
    facebook: `Business casual for the Luncheon. What are you wearing? 👗🧥\n\nA) Blazer, heels, power pose\nB) Statement dress, soft glam\n\nComment A or B 👇 (Yes, we'll be looking for you on ${DATE}.)\n\nTickets: ${TICKETS}\n\n${TAGS}`,
  },
];
