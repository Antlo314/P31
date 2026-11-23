// The Luncheon moved (Melanie's email, Sat Nov 21 2026): Sunday December 13 2026, 4 – 8 PM, The Four Event
// Center, 8599 Roswell Rd Suite B, Atlanta GA 30350; tickets on Stripe. Facts below come only from the new
// flyer (public/events/luncheon-2026-flyer.webp: doors close 4:30 PM, ticket includes food) and the site.
// Eventbrite-only details from the old Dec 19 listing (check-in times, parking, dress code, "sales final")
// are left out. Prices stay off the posts.
// These six replace the Dec 19 posts still queued in Zernio: lunch-dress (Nov 28) from ../2026-10-17-luncheon
// and the five countdown posts from ../2026-12-luncheon. schedule.mjs books the new ones, then removes those.
// Times are Eastern, in the followers-online windows (Sat 4–9 PM, Sun 7–9 PM, weekdays 12–3 PM).
export const TIMEZONE = 'America/New_York';
export const ACCOUNTS = { instagram: '6ac6716d90b16e751447d7fe', facebook: '6ac67950507b603704a87454' };
export const CALENDAR = 'p31-luncheon-dec13-2026';
export const TICKETS = 'https://buy.stripe.com/14A28r2uYcs6dZa5pldwc02';

// Old posts to take out of the Zernio queue (folder + post key in that folder's state.json).
export const REPLACES = [
  { folder: '2026-10-17-luncheon', key: 'lunch-dress', why: 'Nov 28 outfit poll (said Dec 19, Eventbrite)' },
  { folder: '2026-12-luncheon', key: 'count-14', why: 'Dec 5 two weeks out (Dec 19)' },
  { folder: '2026-12-luncheon', key: 'count-7', why: 'Dec 12 one week out (Dec 19)' },
  { folder: '2026-12-luncheon', key: 'count-3', why: 'Dec 16 three days out (Dec 19)' },
  { folder: '2026-12-luncheon', key: 'count-1', why: 'Dec 18 tomorrow (Dec 19, 1:30)' },
  { folder: '2026-12-luncheon', key: 'count-0', why: 'Dec 19 today (1:30)' },
];

const TAGS = '#P31Marketplace #BusinessLuncheon #WomenInLeadership #FaithAndBusiness #AtlantaEvents #WomenEntrepreneurs #Proverbs31Woman';
const DATE = 'Sunday, December 13';
const WHEN = `${DATE} · 4 – 8 PM`;
const WHERE = 'The Four Event Center · Atlanta';
const ADDRESS = '8599 Roswell Rd, Suite B, Atlanta, GA 30350';
const IG_TICKETS = 'Tickets at p31market.com (link in bio).';
const FB_TICKETS = `Tickets: ${TICKETS}`;

// kind: count (big number) | opts (pick one)
export const POSTS = [
  {
    id: 'lunch-dress', when: '2026-11-28T18:00:00', label: 'Sat Nov 28 · 6:00 PM', kind: 'opts',
    eyebrow: 'The Luncheon · Dec 13', question: 'Your Luncheon look?',
    options: ['Blazer, heels, power pose', 'Statement dress, soft glam'],
    ask: 'Comment A or B 👇',
    instagram: `Two weeks from tomorrow. What are you wearing to the Luncheon? 👗🧥\n\nA) Blazer, heels, power pose\nB) Statement dress, soft glam\n\nComment A or B 👇 (Yes, we'll be looking for you on ${DATE}.)\n\n${IG_TICKETS}\n\n${TAGS}`,
    facebook: `Two weeks from tomorrow. What are you wearing to the Luncheon? 👗🧥\n\nA) Blazer, heels, power pose\nB) Statement dress, soft glam\n\nComment A or B 👇 (Yes, we'll be looking for you on ${DATE}.)\n\n${FB_TICKETS}\n\n${TAGS}`,
  },
  {
    id: 'count-14', when: '2026-11-29T19:00:00', label: 'Sun Nov 29 · 7:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: '14', unit: 'days', title: 'Two Sundays <em>to go</em>',
    meta: `${WHEN} · ${WHERE}`,
    items: ['Food is included with your ticket', 'Doors close at 4:30 PM', 'Faith, leadership and real business moves'],
    pill: 'TICKETS AT P31MARKET.COM · LINK IN BIO',
    instagram: `Two weeks from today. 🗓️✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${DATE}, 4 – 8 PM, at ${WHERE}: food, networking, and an evening of faith, leadership and real business moves with women who are building the same way you are.\n\nIf you have been meaning to grab your seat, this is the week. ${IG_TICKETS}\n\nWhat is the one thing you are hoping to walk away with? Tell us below 👇\n\n${TAGS}`,
    facebook: `Two weeks from today. 🗓️✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${DATE}, 4 – 8 PM, at ${WHERE}: food, networking, and an evening of faith, leadership and real business moves with women who are building the same way you are.\n\nIf you have been meaning to grab your seat, this is the week. ${FB_TICKETS}\n\nWhat is the one thing you are hoping to walk away with? Tell us below 👇\n\n${TAGS}`,
  },
  {
    id: 'count-7', when: '2026-12-06T19:00:00', label: 'Sun Dec 6 · 7:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: '7', unit: 'days', title: 'One week <em>to go</em>',
    meta: `${WHEN} · ${WHERE}`,
    items: ['Starts at 4 · doors close at 4:30 PM', 'Food, leadership and business talk until 8', 'Get your ticket at p31market.com'],
    pill: 'ONE WEEK · LINK IN BIO',
    instagram: `One week to go. 🙌🏾\n\nNext Sunday, December 13, we gather at ${WHERE} for the Business & Leadership Luncheon. We start at 4 PM, doors close at 4:30, and we rise and build together until 8.\n\n${IG_TICKETS}\n\nWhat is the one question you are bringing for a room full of women leaders? 👇\n\n${TAGS}`,
    facebook: `One week to go. 🙌🏾\n\nNext Sunday, December 13, we gather at ${WHERE} for the Business & Leadership Luncheon. We start at 4 PM, doors close at 4:30, and we rise and build together until 8.\n\n${FB_TICKETS}\n\nWhat is the one question you are bringing for a room full of women leaders? 👇\n\n${TAGS}`,
  },
  {
    id: 'count-3', when: '2026-12-10T12:30:00', label: 'Thu Dec 10 · 12:30 PM', kind: 'opts',
    eyebrow: 'Three days to go · Dec 13', question: 'What are you bringing to the Luncheon?',
    options: ['Business cards', 'A notebook and a big question', 'A friend who needs this'],
    ask: 'Comment A, B or C 👇',
    instagram: `Three days to go. What are you bringing to the Business & Leadership Luncheon? 👜\n\nA) Business cards\nB) A notebook and a big question\nC) A friend who needs this\n\nComment your letter 👇 (D, all of the above, is allowed.)\n\n${DATE}, 4 PM, ${WHERE}. ${IG_TICKETS}\n\n${TAGS}`,
    facebook: `Three days to go. What are you bringing to the Business & Leadership Luncheon? 👜\n\nA) Business cards\nB) A notebook and a big question\nC) A friend who needs this\n\nComment your letter 👇 (D, all of the above, is allowed.)\n\n${DATE}, 4 PM, ${WHERE}. ${FB_TICKETS}\n\n${TAGS}`,
  },
  {
    id: 'count-1', when: '2026-12-12T19:00:00', label: 'Sat Dec 12 · 7:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: 'Tomorrow', unit: '', title: 'See you at <em>4</em>',
    meta: `${DATE} · 4 – 8 PM · ${WHERE}`,
    items: ['Doors close at 4:30 PM', ADDRESS, 'Food is included with your ticket', 'Questions: (470) 562-2852'],
    pill: 'TOMORROW · SUNDAY, DECEMBER 13',
    instagram: `Tomorrow. ✨\n\nEverything you need for the Business & Leadership Luncheon:\n\n📍 ${WHERE}, ${ADDRESS}\n🕓 4 – 8 PM. Please arrive by 4:30; doors close then.\n🍽️ Food is included with your ticket\n📞 Questions: (470) 562-2852\n\nBring your business cards and come ready to be poured into, in faith and in business.\n\nWho is coming? Say hi below so we can look for you 👇\n\n${TAGS}`,
    facebook: `Tomorrow. ✨\n\nEverything you need for the Business & Leadership Luncheon:\n\n📍 ${WHERE}, ${ADDRESS}\n🕓 4 – 8 PM. Please arrive by 4:30; doors close then.\n🍽️ Food is included with your ticket\n📞 Questions: (470) 562-2852\n\nBring your business cards and come ready to be poured into, in faith and in business. Last-minute seat: ${TICKETS}\n\nWho is coming? Say hi below so we can look for you 👇\n\n${TAGS}`,
  },
  {
    id: 'count-0', when: '2026-12-13T09:00:00', label: 'Sun Dec 13 · 9:00 AM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: 'Today', unit: '', title: 'Rise, build <em>and become.</em>',
    meta: `Today, 4 – 8 PM · ${WHERE}`,
    items: ['Doors close at 4:30 PM', ADDRESS, 'Food, leadership and business moves'],
    pill: 'SEE YOU AT 4 PM',
    instagram: `Today is the day. 🙏🏾✨\n\nThe Proverbs 31 Business & Leadership Luncheon, 4 PM at ${WHERE}. Doors close at 4:30, so give yourself a little grace in traffic.\n\nCome as you are, ready to rise and build with a room full of women walking in purpose.\n\nIf you are coming, comment "I'm in" so we can look for you 👇 See you this afternoon.\n\n${TAGS}`,
    facebook: `Today is the day. 🙏🏾✨\n\nThe Proverbs 31 Business & Leadership Luncheon, 4 PM at ${WHERE} (${ADDRESS}). Doors close at 4:30, so give yourself a little grace in traffic.\n\nCome as you are, ready to rise and build with a room full of women walking in purpose.\n\nIf you are coming, comment "I'm in" so we can look for you 👇 Last-minute seat: ${TICKETS}\n\n${TAGS}`,
  },
];
