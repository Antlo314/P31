// The December countdown to the Proverbs 31 Business & Leadership Luncheon: five posts from two
// Saturdays out to the morning of the day. Facts from the Eventbrite listing: Saturday December 19 2026,
// 1:30 – 5 PM, The Four Event Center, 8599 Roswell Rd Suite B, Atlanta; check-in opens 1:15 PM, doors
// close 2 PM; seated meal, light refreshments, free parking, business casual, limited seating, sales final.
// Times are Eastern. The earlier run (../2026-10-17-luncheon) ends Nov 28; this one picks up Dec 5.
export const TIMEZONE = 'America/New_York';
export const ACCOUNTS = { instagram: '6ac6716d90b16e751447d7fe', facebook: '6ac67950507b603704a87454' };
export const CALENDAR = 'p31-luncheon-countdown-2026';
export const TICKETS = 'https://www.eventbrite.com/e/proverbs-31-business-leadership-luncheon-tickets-2002850002272';

const TAGS = '#P31Marketplace #BusinessLuncheon #WomenInLeadership #FaithAndBusiness #AtlantaEvents #WomenEntrepreneurs #Proverbs31Woman';
const WHEN = 'Saturday, December 19 · 1:30 – 5 PM';
const WHERE = 'The Four Event Center · Atlanta';
const ADDRESS = '8599 Roswell Rd, Suite B, Atlanta, GA 30350';

// kind: count (big number) | opts (pick one)
export const POSTS = [
  {
    id: 'count-14', when: '2026-12-05T18:00:00', label: 'Sat Dec 5 · 6:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: '14', unit: 'days', title: 'Two Saturdays <em>to go</em>',
    meta: `${WHEN} · ${WHERE}`,
    items: ['A seated meal, light refreshments, free parking', 'Business casual. Bring business cards', 'Seating is limited'],
    pill: 'TICKETS ON EVENTBRITE · LINK IN BIO',
    instagram: `Two weeks from today. 🗓️✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${WHEN} at ${WHERE}: a seated meal, light networking, and an afternoon of faith, leadership tips and real business moves with women who are building the same way you are.\n\nSeating is limited and all sales are final, so if you have been meaning to grab your seat, this is the week. Tickets on Eventbrite (link in bio).\n\nWhat is the one thing you are hoping to walk away with? Tell us below 👇\n\n${TAGS}`,
    facebook: `Two weeks from today. 🗓️✨\n\nThe Proverbs 31 Business & Leadership Luncheon is ${WHEN} at ${WHERE}: a seated meal, light networking, and an afternoon of faith, leadership tips and real business moves with women who are building the same way you are.\n\nSeating is limited and all sales are final, so if you have been meaning to grab your seat, this is the week. Tickets: ${TICKETS}\n\nWhat is the one thing you are hoping to walk away with? Tell us below 👇\n\n${TAGS}`,
  },
  {
    id: 'count-7', when: '2026-12-12T18:00:00', label: 'Sat Dec 12 · 6:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: '7', unit: 'days', title: 'One week <em>to go</em>',
    meta: `${WHEN} · ${WHERE}`,
    items: ['Check-in opens 1:15 PM · doors close at 2', 'Lunch, leadership and business talk until 5', 'Last seats on Eventbrite'],
    pill: 'LAST SEATS · LINK IN BIO',
    instagram: `One week to go. 🙌🏾\n\nNext Saturday, December 19, we gather at ${WHERE} for the Business & Leadership Luncheon. Check-in opens at 1:15 PM, doors close at 2, and we rise and build together until 5.\n\nThe last seats are on Eventbrite (link in bio). All sales are final.\n\nWhat is the one question you are bringing for a room full of women leaders? 👇\n\n${TAGS}`,
    facebook: `One week to go. 🙌🏾\n\nNext Saturday, December 19, we gather at ${WHERE} for the Business & Leadership Luncheon. Check-in opens at 1:15 PM, doors close at 2, and we rise and build together until 5.\n\nThe last seats: ${TICKETS} (all sales are final).\n\nWhat is the one question you are bringing for a room full of women leaders? 👇\n\n${TAGS}`,
  },
  {
    id: 'count-3', when: '2026-12-16T12:30:00', label: 'Wed Dec 16 · 12:30 PM', kind: 'opts',
    eyebrow: 'Three days to go · Dec 19', question: 'What are you bringing to the Luncheon?',
    options: ['Business cards', 'A notebook and a big question', 'A friend who needs this'],
    ask: 'Comment A, B or C 👇',
    instagram: `Three days to go. What are you bringing to the Business & Leadership Luncheon? 👜\n\nA) Business cards\nB) A notebook and a big question\nC) A friend who needs this\n\nComment your letter 👇 (D, all of the above, is allowed.)\n\nSaturday, December 19, 1:30 PM, ${WHERE}. A few seats are still on Eventbrite (link in bio).\n\n${TAGS}`,
    facebook: `Three days to go. What are you bringing to the Business & Leadership Luncheon? 👜\n\nA) Business cards\nB) A notebook and a big question\nC) A friend who needs this\n\nComment your letter 👇 (D, all of the above, is allowed.)\n\nSaturday, December 19, 1:30 PM, ${WHERE}. A few seats are still on Eventbrite: ${TICKETS}\n\n${TAGS}`,
  },
  {
    id: 'count-1', when: '2026-12-18T19:00:00', label: 'Fri Dec 18 · 7:00 PM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: 'Tomorrow', unit: '', title: 'See you at <em>1:30</em>',
    meta: `Saturday, December 19 · ${WHERE}`,
    items: ['Check-in opens 1:15 PM · doors close at 2', ADDRESS, 'Free parking on site · business casual', 'Questions on the day: 470-562-2852'],
    pill: 'TOMORROW · SATURDAY, DECEMBER 19',
    instagram: `Tomorrow. ✨\n\nEverything you need for the Business & Leadership Luncheon:\n\n📍 ${WHERE}, ${ADDRESS}\n🕐 Check-in opens 1:15 PM. Please arrive by 1:30; doors close at 2.\n🚗 Free parking on site\n👗 Business casual\n📞 Questions on the day: 470-562-2852\n\nBring your business cards and come ready to be poured into, in faith and in business.\n\nWho is coming? Say hi below so we can look for you 👇\n\n${TAGS}`,
    facebook: `Tomorrow. ✨\n\nEverything you need for the Business & Leadership Luncheon:\n\n📍 ${WHERE}, ${ADDRESS}\n🕐 Check-in opens 1:15 PM. Please arrive by 1:30; doors close at 2.\n🚗 Free parking on site\n👗 Business casual\n📞 Questions on the day: 470-562-2852\n\nBring your business cards and come ready to be poured into, in faith and in business. Last-minute seat: ${TICKETS}\n\nWho is coming? Say hi below so we can look for you 👇\n\n${TAGS}`,
  },
  {
    id: 'count-0', when: '2026-12-19T09:00:00', label: 'Sat Dec 19 · 9:00 AM', kind: 'count',
    eyebrow: 'Business & Leadership Luncheon', big: 'Today', unit: '', title: 'Rise, build <em>and become.</em>',
    meta: `Today, 1:30 – 5 PM · ${WHERE}`,
    items: ['Check-in 1:15 PM · doors close at 2', ADDRESS, 'Seated lunch, leadership and business moves'],
    pill: 'SEE YOU AT 1:30 PM',
    instagram: `Today is the day. 🙏🏾✨\n\nThe Proverbs 31 Business & Leadership Luncheon, 1:30 PM at ${WHERE}. Check-in opens at 1:15 and doors close at 2, so give yourself a little grace in traffic.\n\nCome as you are, in your business casual best, ready to rise and build with a room full of women walking in purpose.\n\nIf you are coming, comment "I'm in" so we can look for you 👇 See you this afternoon.\n\n${TAGS}`,
    facebook: `Today is the day. 🙏🏾✨\n\nThe Proverbs 31 Business & Leadership Luncheon, 1:30 PM at ${WHERE} (${ADDRESS}). Check-in opens at 1:15 and doors close at 2, so give yourself a little grace in traffic.\n\nCome as you are, in your business casual best, ready to rise and build with a room full of women walking in purpose.\n\nIf you are coming, comment "I'm in" so we can look for you 👇 See you this afternoon.\n\n${TAGS}`,
  },
];
