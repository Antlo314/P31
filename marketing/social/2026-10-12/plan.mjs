// 30 days of engagement posts for @proverbs31market (Instagram + Facebook), Oct 12 – Nov 10 2026.
// One post on every day the October calendar (marketing/social/2026-10) does not already cover.
// Times are Eastern, chosen from 28 days of Instagram "followers online" data: weekdays 12–3 PM
// and 7–9 PM, Saturday 4–9 PM, Sunday 1 PM and 7–9 PM. Formats that earn replies without
// engagement bait: fill-in-the-blank scripture (the proven one), finish-the-sentence, this-or-that,
// pop quizzes, a Sunday "Amen" verse, and one honest invitation a week.
export const TIMEZONE = 'America/New_York';
export const ACCOUNTS = { instagram: '6ac6716d90b16e751447d7fe', facebook: '6ac67950507b603704a87454' };
export const CALENDAR = 'p31-2026-10-12';

const TAGS = {
  fill: '#P31Marketplace #Proverbs31Woman #BibleChallenge #FaithAndBusiness #WomenWhoBuild',
  talk: '#P31Marketplace #Proverbs31Woman #WomenWhoBuild #KingdomEntrepreneur #AtlantaMarkets',
  amen: '#P31Marketplace #Proverbs31Woman #SundayWord #FaithAndBusiness',
  cta: '#P31Marketplace #WomenOwnedBusiness #AtlantaMarkets #KingdomEntrepreneur',
};
const fb = (s) => s.replace(/Link in bio\.?/gi, (m) => m); // Facebook gets full links in the text below

// kind: fill | prompt | choice | quiz | amen | cta
export const POSTS = [
  {
    id: 'fill-rubies', when: '2026-10-12T19:00:00', label: 'Mon Oct 12 · 7:00 PM', kind: 'fill',
    verse: 'Who can find a virtuous woman? for her price is far above', answer: 'rubies', ref: 'PROVERBS 31:10',
    instagram: `Bible fill-in-the-blank, round two 🤭\n\n"Who can find a virtuous woman? for her price is far above ______." Proverbs 31:10\n\nNo peeking. Drop the missing word in the comments 👇\n\n${TAGS.fill}`,
  },
  {
    id: 'choice-market', when: '2026-10-14T12:30:00', label: 'Wed Oct 14 · 12:30 PM', kind: 'choice',
    question: 'Which market is more you?', a: 'Morning market ☕ · coffee, sunshine, first pick', b: 'Evening market 🌙 · lights, music, date night',
    instagram: `Settle it for us: morning market or evening market? ☕🌙\n\nA) Morning: coffee in hand, sunshine, first pick of everything\nB) Evening: string lights, music, make it a date night\n\nComment A or B, and tell us why 👇 We read every answer when we plan the next one.\n\n${TAGS.talk}`,
  },
  {
    id: 'fill-room', when: '2026-10-16T13:00:00', label: 'Fri Oct 16 · 1:00 PM', kind: 'fill',
    verse: "A man's gift maketh room for him, and bringeth him before great", answer: 'men', ref: 'PROVERBS 18:16',
    instagram: `This verse is where "Where her gifts make room" comes from. 💜\n\n"A man's gift maketh room for him, and bringeth him before great ______." Proverbs 18:16\n\nFill in the blank in the comments 👇 Then tell us: what's the gift that keeps opening doors for you?\n\n${TAGS.fill}`,
  },
  {
    id: 'prompt-woman', when: '2026-10-19T19:00:00', label: 'Mon Oct 19 · 7:00 PM', kind: 'prompt',
    eyebrow: 'Finish the sentence', text: 'A Proverbs 31 woman is', ask: 'Your word below 👇',
    instagram: `Finish the sentence: a Proverbs 31 woman is ______.\n\nOne word or a whole paragraph, we want to hear how you'd say it. 👇\n\n${TAGS.talk}`,
  },
  {
    id: 'fill-understanding', when: '2026-10-22T13:00:00', label: 'Thu Oct 22 · 1:00 PM', kind: 'fill',
    verse: 'Trust in the LORD with all thine heart; and lean not unto thine own', answer: 'understanding', ref: 'PROVERBS 3:5',
    instagram: `Lunch-break Bible check 📖\n\n"Trust in the LORD with all thine heart; and lean not unto thine own ______." Proverbs 3:5\n\nNo peeking, no Googling. Comment the word 👇\n\n${TAGS.fill}`,
  },
  {
    id: 'quiz-not-in-31', when: '2026-10-23T20:00:00', label: 'Fri Oct 23 · 8:00 PM', kind: 'quiz',
    question: 'Which one is NOT in Proverbs 31?', options: ['She planteth a vineyard', 'She maketh fine linen', 'She feareth the LORD', 'She buildeth her house'],
    instagram: `P31 pop quiz. Which of these is NOT in Proverbs 31? 🧐\n\nA) She planteth a vineyard\nB) She maketh fine linen\nC) She feareth the LORD\nD) She buildeth her house\n\nAnswer in the comments before you look it up 👇 (One of these lives in a different chapter.)\n\n${TAGS.fill}`,
  },
  {
    id: 'cta-vendors', when: '2026-10-24T18:00:00', label: 'Sat Oct 24 · 6:00 PM', kind: 'cta',
    eyebrow: 'Vendor applications open', title: 'Your table at the<br /><em>Winter Gala</em>', items: ['Hand-selected women-owned brands', 'Art, beauty, clothing, food, more', 'Apply in five minutes', 'We reply to every application'], pill: 'P31MARKET.COM/APPLY',
    instagram: `Makers, this one's for you. 🕯️💍🧁\n\nVendor applications for the Winter Gala are open. If you make it with your hands, we want to see it: art, beauty, clothing, food, wellness, home.\n\nThe form takes five minutes and we reply to every single one. Apply at p31market.com/apply (link in bio).\n\nKnow a woman whose work belongs on a P31 table? Send her this.\n\n${TAGS.cta}`,
    facebook: `Makers, this one's for you. 🕯️💍🧁\n\nVendor applications for the Winter Gala are open. If you make it with your hands, we want to see it: art, beauty, clothing, food, wellness, home.\n\nThe form takes five minutes and we reply to every single one: https://www.p31market.com/apply\n\nKnow a woman whose work belongs on a P31 table? Send her this.\n\n${TAGS.cta}`,
  },
  {
    id: 'amen-wait', when: '2026-10-25T13:00:00', label: 'Sun Oct 25 · 1:00 PM', kind: 'amen',
    verse: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', ref: 'ISAIAH 40:31',
    instagram: `For the woman in a waiting season. 🕊️\n\n"But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." Isaiah 40:31\n\nIf this is your prayer this week, comment Amen 🙏🏾 and we'll be praying it with you.\n\n${TAGS.amen}`,
  },
  {
    id: 'fill-faint', when: '2026-10-26T19:00:00', label: 'Mon Oct 26 · 7:00 PM', kind: 'fill',
    verse: 'And let us not be weary in well doing: for in due season we shall reap, if we faint', answer: 'not', ref: 'GALATIANS 6:9',
    instagram: `Monday fill-in-the-blank, for everyone building something slowly. 🌱\n\n"And let us not be weary in well doing: for in due season we shall reap, if we faint ______." Galatians 6:9\n\nComment the word 👇 and if you're tired this week, say that too.\n\n${TAGS.fill}`,
  },
  {
    id: 'prompt-why', when: '2026-10-27T20:00:00', label: 'Tue Oct 27 · 8:00 PM', kind: 'prompt',
    eyebrow: 'Finish the sentence', text: 'My business exists because', ask: 'Tell us your why 👇',
    instagram: `Finish the sentence: my business exists because ______.\n\nThe real reason, not the polished one. Drop it below 👇 We'll be reading every single one.\n\n${TAGS.talk}`,
  },
  {
    id: 'fill-kindness', when: '2026-10-28T12:30:00', label: 'Wed Oct 28 · 12:30 PM', kind: 'fill',
    verse: 'She openeth her mouth with wisdom; and in her tongue is the law of', answer: 'kindness', ref: 'PROVERBS 31:26',
    instagram: `Midweek Bible fill-in-the-blank 📖\n\n"She openeth her mouth with wisdom; and in her tongue is the law of ______." Proverbs 31:26\n\nComment your answer 👇 Bonus: who's a woman in your life who lives this verse?\n\n${TAGS.fill}`,
  },
  {
    id: 'choice-bag', when: '2026-10-29T20:00:00', label: 'Thu Oct 29 · 8:00 PM', kind: 'choice',
    question: 'First thing in your market bag?', a: 'Handmade candle 🕯️', b: 'Handmade jewelry 💍',
    instagram: `You walk into a P31 market with $40. What goes in the bag first? 👜\n\nA) A handmade candle 🕯️\nB) A handmade piece of jewelry 💍\n\nComment A or B 👇 (and if you make either one, tell us, we're always looking.)\n\n${TAGS.talk}`,
  },
  {
    id: 'fill-heartily', when: '2026-10-30T13:00:00', label: 'Fri Oct 30 · 1:00 PM', kind: 'fill',
    verse: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto', answer: 'men', ref: 'COLOSSIANS 3:23',
    instagram: `Friday fill-in-the-blank for the women who do it heartily. 💪🏾\n\n"And whatsoever ye do, do it heartily, as to the Lord, and not unto ______." Colossians 3:23\n\nNo peeking, comment the word 👇\n\n${TAGS.fill}`,
  },
  {
    id: 'cta-collective', when: '2026-10-31T18:00:00', label: 'Sat Oct 31 · 6:00 PM', kind: 'cta',
    eyebrow: 'The P31 Collective by NEBA', title: 'Mentorship for<br /><em>women who build</em>', items: ['Business mentorship', 'Faith-based mentorship', 'Private classrooms and live sessions', 'Start with a free intro call'], pill: 'THEP31COLLECTIVE.ORG/JOIN',
    instagram: `Some of you are not waiting on a sign. You're waiting on a mentor. 💜\n\nThe P31 Collective by NEBA is private mentorship for faith-driven women entrepreneurs: business mentorship and faith-based mentorship, with live sessions and a classroom built for you.\n\nIt starts with a free intro call. Apply at thep31collective.org/join (link in bio).\n\n${TAGS.cta}`,
    facebook: `Some of you are not waiting on a sign. You're waiting on a mentor. 💜\n\nThe P31 Collective by NEBA is private mentorship for faith-driven women entrepreneurs: business mentorship and faith-based mentorship, with live sessions and a classroom built for you.\n\nIt starts with a free intro call: https://www.thep31collective.org/join\n\n${TAGS.cta}`,
  },
  {
    id: 'amen-hands', when: '2026-11-01T13:00:00', label: 'Sun Nov 1 · 1:00 PM', kind: 'amen',
    verse: 'And let the beauty of the LORD our God be upon us: and establish thou the work of our hands upon us; yea, the work of our hands establish thou it.', ref: 'PSALM 90:17',
    instagram: `New month. Same prayer over your hands. 🙌🏾\n\n"And let the beauty of the LORD our God be upon us: and establish thou the work of our hands upon us; yea, the work of our hands establish thou it." Psalm 90:17\n\nComment Amen if you're asking God to establish your work this month 🙏🏾\n\n${TAGS.amen}`,
  },
  {
    id: 'fill-established', when: '2026-11-02T19:00:00', label: 'Mon Nov 2 · 7:00 PM', kind: 'fill',
    verse: 'Commit thy works unto the LORD, and thy thoughts shall be', answer: 'established', ref: 'PROVERBS 16:3',
    instagram: `Monday Bible fill-in-the-blank 📖\n\n"Commit thy works unto the LORD, and thy thoughts shall be ______." Proverbs 16:3\n\nComment the word 👇 Then tell us one thing you're committing to Him this week.\n\n${TAGS.fill}`,
  },
  {
    id: 'quiz-verse', when: '2026-11-03T20:00:00', label: 'Tue Nov 3 · 8:00 PM', kind: 'quiz',
    question: 'Which verse is our marketplace built on?', options: ['Proverbs 31:10', 'Proverbs 31:25', 'Proverbs 31:31', 'Proverbs 31:26'],
    instagram: `P31 pop quiz 🧐 Which verse is the whole marketplace built on?\n\nA) Proverbs 31:10\nB) Proverbs 31:25\nC) Proverbs 31:31\nD) Proverbs 31:26\n\nComment your letter 👇 (If you've been here a while, you know this one.)\n\n${TAGS.fill}`,
  },
  {
    id: 'fill-strength', when: '2026-11-04T12:30:00', label: 'Wed Nov 4 · 12:30 PM', kind: 'fill',
    verse: 'I can do all things through Christ which', answer: 'strengtheneth me', ref: 'PHILIPPIANS 4:13',
    instagram: `Midweek check-in. Finish the verse 💪🏾\n\n"I can do all things through Christ which ______." Philippians 4:13\n\nComment the missing words 👇 and name the thing you're doing this week that needs that strength.\n\n${TAGS.fill}`,
  },
  {
    id: 'prompt-money', when: '2026-11-05T20:00:00', label: 'Thu Nov 5 · 8:00 PM', kind: 'prompt',
    eyebrow: 'Finish the sentence', text: 'The best money advice a woman ever gave me:', ask: 'Pass it on below 👇',
    instagram: `Finish the sentence: the best money advice a woman ever gave me was ______.\n\nA mother, an auntie, a mentor, a stranger at a market. Pass it on in the comments 👇 Someone here needs it tonight.\n\n${TAGS.talk}`,
  },
  {
    id: 'fill-praised', when: '2026-11-06T13:00:00', label: 'Fri Nov 6 · 1:00 PM', kind: 'fill',
    verse: 'Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be', answer: 'praised', ref: 'PROVERBS 31:30',
    instagram: `Friday fill-in-the-blank 📖\n\n"Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be ______." Proverbs 31:30\n\nNo peeking. Comment the word 👇\n\n${TAGS.fill}`,
  },
  {
    id: 'cta-gala', when: '2026-11-07T18:00:00', label: 'Sat Nov 7 · 6:00 PM', kind: 'cta',
    eyebrow: 'Proverbs 31 Marketplace presents', title: 'The Winter<br /><em>Gala</em>', items: ['Hand-selected women-owned brands', 'Art, beauty, clothing, food and more', 'All are welcome', 'Date announcing soon'], pill: 'GET NOTIFIED · P31MARKET.COM/CALENDAR',
    instagram: `The Winter Gala is coming. ✨\n\nHand-selected women-owned brands under one roof: art, beauty, clothing, food and more. All are welcome.\n\nThe date drops soon, and the people on our list hear first. Get notified at p31market.com/calendar (link in bio).\n\nWho are you bringing? Tag your market partner below 👇\n\n${TAGS.cta}`,
    facebook: `The Winter Gala is coming. ✨\n\nHand-selected women-owned brands under one roof: art, beauty, clothing, food and more. All are welcome.\n\nThe date drops soon, and the people on our list hear first. Get notified: https://www.p31market.com/calendar\n\nWho are you bringing? Tag your market partner below 👇\n\n${TAGS.cta}`,
  },
  {
    id: 'amen-plans', when: '2026-11-08T13:00:00', label: 'Sun Nov 8 · 1:00 PM', kind: 'amen',
    verse: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.', ref: 'JEREMIAH 29:11',
    instagram: `Sunday word for the woman who can't see the whole plan yet. 🕊️\n\n"For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." Jeremiah 29:11\n\nComment Amen if you're trusting the plan you can't see 🙏🏾\n\n${TAGS.amen}`,
  },
  {
    id: 'fill-believed', when: '2026-11-09T19:00:00', label: 'Mon Nov 9 · 7:00 PM', kind: 'fill',
    verse: 'And blessed is she that believed: for there shall be a performance of those things which were told her from the', answer: 'Lord', ref: 'LUKE 1:45',
    instagram: `Monday fill-in-the-blank, and it's one of our favorites. 💜\n\n"And blessed is she that believed: for there shall be a performance of those things which were told her from the ______." Luke 1:45\n\nComment the word 👇 and tell us: what have you been believing for?\n\n${TAGS.fill}`,
  },
  {
    id: 'prompt-believing', when: '2026-11-10T20:00:00', label: 'Tue Nov 10 · 8:00 PM', kind: 'prompt',
    eyebrow: 'Finish the sentence', text: "This season I'm believing God for", ask: 'Say it out loud below 👇',
    instagram: `Finish the sentence: this season I'm believing God for ______.\n\nSay it here first. Speaking it is half the faith. 👇\n\n${TAGS.talk}`,
  },
];

// Facebook gets the Instagram text unless a post sets its own (links instead of "link in bio").
for (const p of POSTS) if (!p.facebook) p.facebook = fb(p.instagram);
