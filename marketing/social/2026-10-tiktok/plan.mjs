// Proverbs 31 Marketplace on TikTok: 28 short videos, one a day, Wed Oct 28 – Tue Nov 24 2026 (Eastern).
// tt01–tt14 were first planned for Oct 23 – Nov 5 and moved on Oct 28 (reordered so the Saturday fill-in,
// Sunday scripture and Friday prayer still land on their days); tt15–tt28 follow. Each post keeps the seed
// of its place in POSTS_RAW, so a re-dated post draws exactly as before; POSTS is sorted by time.
// Weekdays alternate 12:30 PM and 7:30 PM, Saturdays 1:00 PM, Sundays 4:00 PM. Each one is a Design studio
// card in 9:16 (template, colour style, pattern, motion preset) with one of the studio's own music tracks,
// drawn by build.mjs and scheduled by schedule.mjs. The TikTok is the Market's, although it sits in the
// Collective's Zernio workspace, so every word here is Market only.
// House rules for the copy: facts as the live site states them (storefront: up to 10 products, free for
// 3 months, then $14.99 a month plus 5% per sale, Stripe checkout; booths: apply once, acceptance and
// event details by email), the Business and Leadership Luncheon is the only event with a date, venue or
// tickets, KJV scripture word for word, a real link or a genuine question as the call to action, no
// "comment X and we'll DM you" (TikTok can't start a DM), no engagement bait, 3 to 5 hashtags.
// No handle on the cards: TikTok shows the username over the video.
// promo: true marks the posts whose whole point is a P31 offer (a booth, a storefront, Luncheon tickets,
// merch). schedule.mjs --brand-label sends those with TikTok's "Your brand" disclosure; it is the user's call.

export const CALENDAR = '2026-10-tiktok';
export const TIMEZONE = 'America/New_York';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Fri Oct 23 · 12:30 PM" from a local Eastern "2026-10-23T12:30:00" (no time zone maths needed). */
export function labelOf(when) {
  const [d, t] = when.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${wd} ${MONTHS[m - 1]} ${day} · ${(hh % 12) || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

const POSTS_RAW = [
  {
    id: 'tt01-apply', when: '2026-10-28T12:30:00', theme: 'Booths at the seasonal Atlanta markets', promo: true,
    template: 'invite', style: 'plum', pattern: 'topo', music: 'golden-hour', motion: 'editorial',
    words: {
      eyebrow: 'Calling Atlanta makers',
      headline: 'Your gifts deserve room to grow.',
      body: 'Apply for a booth at our seasonal Atlanta markets, a faith-centered marketplace for women-led brands and artisans.',
      button: 'Apply at p31market.com/apply',
    },
    caption: 'Your gift was never meant to stay hidden in your kitchen or your craft room. ✨\n\nProverbs 31 Marketplace is a curated marketplace for women creatives, artisans and visionaries, online at p31market.com and at our seasonal markets in Atlanta.\n\nWant a booth at a P31 Market? Apply once at p31market.com/apply. Acceptance and event details are emailed to you.\n\nWhat do you make? Tell us in the comments 👇\n\n#P31Marketplace #AtlantaMakers #WomenOwnedBusiness #ShopSmallATL',
  },
  {
    id: 'tt02-fine-linen', when: '2026-10-31T13:00:00', theme: 'Saturday Bible fill-in-the-blank (Proverbs 31:24)',
    template: 'blank', style: 'thistle', pattern: 'waves', music: 'bright-open', motion: 'gentle',
    words: {
      eyebrow: 'Fill in the blank · KJV',
      headline: 'She maketh fine linen, and ______\u00A0it', // a no-break space keeps "it" with the blank
      ask: 'Proverbs 31:24 · your answer below',
    },
    footer: 'p31market.com',
    caption: 'Saturday Bible challenge 🧵 No peeking!\n\n“She maketh fine linen, and ______ it; and delivereth girdles unto the merchant.” Proverbs 31:24 (KJV)\n\nThe woman in Proverbs 31 worked with her hands and traded with the merchants. She is the woman this marketplace is named for.\n\nWhat is the missing word? Drop your answer in the comments 👇\n\n#P31Marketplace #Proverbs31Woman #BibleChallenge #FaithAndBusiness',
  },
  {
    id: 'tt03-strength-honour', when: '2026-11-01T16:00:00', theme: 'Sunday scripture (Proverbs 31:25)',
    template: 'scripture', style: 'gold', pattern: 'topo', music: 'worship-rise', motion: 'spoken',
    words: { verse: 'Strength and honour are her clothing; and she shall rejoice in time to come.', reference: 'Proverbs 31:25' },
    footer: 'p31market.com',
    caption: 'Whatever this week holds, remember what you are clothed in. 🕊️\n\n“Strength and honour are her clothing; and she shall rejoice in time to come.” Proverbs 31:25 (KJV)\n\nThis verse is also on our Strength & Honour tees, crewnecks, totes and journals at p31market.com/merch.\n\nWhich do you need to put on this week: strength, or honour? 👇\n\n#P31Marketplace #Proverbs31Woman #SundayScripture #KJV',
  },
  {
    id: 'tt04-storefront', when: '2026-11-02T19:30:00', theme: 'The virtual storefront and its terms', promo: true,
    template: 'invite', style: 'royal', pattern: 'rings', music: 'boss-moves', motion: 'bold',
    words: {
      eyebrow: 'Virtual storefront',
      headline: 'Sell online all year on p31market.com.',
      body: 'Up to 10 products or services, secure Stripe checkout and P31 marketing. Free for 3 months, then $14.99 a month. 5% per sale.',
      button: 'Start at p31market.com/storefront',
    },
    caption: 'Your products deserve a home online, not just a DM thread. 🛍️\n\nA P31 virtual storefront gives you:\n• your own storefront link on p31market.com\n• up to 10 products or services\n• secure checkout through Stripe\n• P31 marketing: SEO, Google, Meta and social\n• web support for your storefront\n\nThere’s no monthly fee for your first 3 months; after that it’s $14.99 a month if you keep your storefront. A 5% fee applies to each sale.\n\nRead the terms and sign up at p31market.com/storefront. Within 7 to 10 days you’ll get a link to set up your shop.\n\nWhat would you sell first? 👇\n\n#P31Marketplace #VirtualStorefront #WomenOwnedBusiness #ShopSmall',
  },
  {
    id: 'tt05-fruit-of-her-hands', when: '2026-11-03T12:30:00', theme: 'The verse the Marketplace is built on (Proverbs 31:31)',
    template: 'scripture', style: 'ivory', pattern: 'arches', music: 'sunday-keys', motion: 'spoken',
    words: { verse: 'Give her of the fruit of her hands; and let her own works praise her in the gates.', reference: 'Proverbs 31:31' },
    footer: 'p31market.com',
    caption: 'The verse this marketplace was built on. 💜\n\n“Give her of the fruit of her hands; and let her own works praise her in the gates.” Proverbs 31:31 (KJV)\n\nProverbs 31 Marketplace was made so the work of women’s hands can be seen, shopped and celebrated: online at p31market.com and at our seasonal markets in Atlanta.\n\nWhat is the work of your hands? 👇\n\n#P31Marketplace #Proverbs31Woman #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt06-luncheon', when: '2026-11-04T19:30:00', theme: 'Business and Leadership Luncheon, Dec 19', promo: true,
    template: 'invite', style: 'dusk', pattern: 'topo', music: 'sunday-best', motion: 'editorial',
    words: {
      eyebrow: 'Saturday, December 19 · 1:30 PM',
      headline: 'Business & Leadership Luncheon',
      body: 'Faith, business and leadership over a seated meal at The Four Event Center, Atlanta. Seating is limited.',
      button: 'Tickets on Eventbrite',
    },
    caption: 'Save the date ✨\n\nThe Proverbs 31 Business & Leadership Luncheon is Saturday, December 19, 2026, at 1:30 PM at The Four Event Center in Atlanta.\n\nAn afternoon where faith meets business and leadership: a seated meal, light networking and a room full of women building what God put in their hands. Business owners, women about to start, and anyone still deciding are all welcome.\n\nSeating is limited. Tickets are on Eventbrite: search “Proverbs 31 Business Leadership Luncheon”.\n\nWhat is one question you’d love to ask a room full of women leaders? 👇\n\n#P31Marketplace #BusinessLuncheon #WomenInLeadership #AtlantaEvents',
  },
  {
    id: 'tt07-build-together', when: '2026-10-29T19:30:00', theme: 'Collaboration over competition',
    template: 'quote', style: 'gold', pattern: 'dots', music: 'golden-hour', motion: 'spoken',
    words: { headline: 'Collaboration over competition. We build better together.' },
    script: 'Proverbs 31 Marketplace',
    caption: 'Building a business was never meant to be lonely. 💜\n\nEvery P31 virtual storefront comes with a community chat with other Proverbs 31 women creatives, and our markets put makers side by side. The woman at the next table is not your competition.\n\n“Two are better than one; because they have a good reward for their labour.” Ecclesiastes 4:9 (KJV)\n\nWhat is one thing another business owner taught you? 👇\n\n#P31Marketplace #WomenWhoBuild #WomenSupportingWomen #FaithAndBusiness',
  },
  {
    id: 'tt08-friday-prayer', when: '2026-10-30T12:30:00', theme: 'A Friday prayer for women in business',
    template: 'prayer', style: 'ivory', pattern: 'blobs', music: 'still-waters', motion: 'gentle',
    words: { intro: 'Dear God,', headline: 'Bless the work of my hands and align every business decision with Your Kingdom purpose.' },
    footer: 'p31market.com',
    caption: 'A prayer for every woman building something with her hands. 🙏🏾\n\nDear God, bless the work of my hands and align every business decision with Your Kingdom purpose. Amen.\n\nWhat decision are you praying over this weekend? 👇\n\n#P31Marketplace #BusinessPrayer #ChristianWomenInBusiness #FaithAndBusiness',
  },
  {
    id: 'tt09-growing-in', when: '2026-11-07T13:00:00', theme: 'Finish the sentence: what God is growing',
    template: 'blank', style: 'blush', pattern: 'topo', music: 'worship-rise', motion: 'gentle',
    words: { eyebrow: 'Finish the sentence', headline: 'This season, God is growing my business in', ask: 'Your answer in the comments' },
    footer: 'p31market.com',
    caption: 'Finish the sentence: This season, God is growing my business in ______.\n\nVisibility, sales, boldness, systems, peace of mind… name it and write it down.\n\n“And the LORD answered me, and said, Write the vision, and make it plain upon tables, that he may run that readeth it.” Habakkuk 2:2 (KJV)\n\nDrop yours below 👇\n\n#P31Marketplace #ChristianBusinessOwner #WomenWhoBuild #FaithAndBusiness',
  },
  {
    id: 'tt10-gift-makes-room', when: '2026-11-08T16:00:00', theme: 'Sunday scripture (Proverbs 18:16)',
    template: 'scripture', style: 'plum', pattern: 'topo', music: 'sunday-keys', motion: 'spoken',
    words: { verse: 'A man’s gift maketh room for him, and bringeth him before great men.', reference: 'Proverbs 18:16' },
    footer: 'p31market.com',
    caption: 'When God gives you a gift, He makes room for it. ✨ You don’t have to force every door. Keep showing up with excellence.\n\n“A man’s gift maketh room for him, and bringeth him before great men.” Proverbs 18:16 (KJV)\n\nIt’s the verse behind our motto: where her gifts make room.\n\nWhat gift has God been asking you to stop hiding? 👇\n\n#P31Marketplace #Proverbs1816 #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt11-two-ways', when: '2026-11-06T19:30:00', theme: 'Two ways to become a curator', promo: true,
    template: 'invite', style: 'royal', pattern: 'waves', music: 'lofi-grind', motion: 'editorial',
    words: {
      eyebrow: 'Two ways to become a curator',
      headline: 'A booth at our markets. A storefront online.',
      body: 'Vend at our seasonal Atlanta markets, or open a virtual storefront on p31market.com. Many curators do both.',
      button: 'Start at p31market.com/apply',
    },
    caption: 'Two ways to become a P31 curator 👇\n\n1. Vend at a P31 Market: a booth at our seasonal Atlanta markets. Apply once at p31market.com/apply, and acceptance and event details are emailed to you.\n\n2. Open a virtual storefront: your own storefront on p31market.com with up to 10 products or services, P31 marketing and support. Free for your first 3 months. Start at p31market.com/storefront.\n\nMany curators do both. Start with either, and the team will help with the other.\n\nBooth, storefront, or both: which fits you right now? 👇\n\n#P31Marketplace #AtlantaVendors #WomenOwnedBusiness #ShopSmallATL',
  },
  {
    id: 'tt12-vision', when: '2026-11-05T12:30:00', theme: 'Don’t shrink your vision',
    template: 'quote', style: 'amethyst', pattern: 'topo', music: 'sunday-best', motion: 'typed',
    words: { headline: 'Don’t shrink your vision to fit people who don’t understand your calling.' },
    script: 'Where her gifts make room',
    caption: 'God gave the vision to you. Keep building, keep refining, keep showing up. 👑\n\nWhen you’re ready to put your work in front of more people, there is room for it at P31: a booth at our seasonal Atlanta markets (p31market.com/apply) or a virtual storefront (p31market.com/storefront).\n\nWhat is the vision you refuse to shrink? 👇\n\n#P31Marketplace #WomenWhoBuild #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt13-merch', when: '2026-11-09T12:30:00', theme: 'P31 Merch', promo: true,
    template: 'invite', style: 'lilac', pattern: 'topo', music: 'bright-open', motion: 'bold',
    words: {
      eyebrow: 'P31 Merch',
      headline: 'Wear the word.',
      body: 'Proverbs 31 on tees, hoodies, mugs, totes and journals. Every piece is printed for you when you order.',
      button: 'Shop p31market.com/merch',
    },
    caption: 'Wear the word. 👕☕📓\n\nP31 Merch puts Proverbs 31 on tees, crewnecks, hoodies, mugs, totes, stickers, journals and hats, in designs like Strength & Honour, Her Merchandise Is Good and Where Her Gifts Make Room.\n\nEvery piece is printed for you when you order, so nothing sits in a warehouse, and every purchase supports Proverbs 31 Marketplace.\n\nBrowse them all at p31market.com/merch. Which design would you wear first? 👇\n\n#P31Marketplace #Proverbs31Woman #FaithApparel #ChristianMerch',
  },
  {
    id: 'tt14-out-of-the-dms', when: '2026-11-10T19:30:00', theme: 'Stop selling only in your DMs', promo: true,
    template: 'quote', style: 'dusk', pattern: 'rings', music: 'boss-moves', motion: 'bold',
    words: { headline: 'Stop selling only in your DMs. Open a storefront.' },
    script: 'p31market.com/storefront',
    caption: 'Still sending payment tags back and forth in your DMs? 🛍️\n\nA P31 virtual storefront gives your customers one link to browse and secure checkout through Stripe, with up to 10 products or services and P31 marketing behind you.\n\nNo monthly fee for your first 3 months, then $14.99 a month if you keep it. A 5% fee applies to each sale. Read the terms and sign up at p31market.com/storefront.\n\nWhat is the hardest part of selling through DMs? 👇\n\n#P31Marketplace #VirtualStorefront #SmallBusinessTips #WomenOwnedBusiness',
  },
  // Weeks three and four (added Oct 28): Nov 11 – Nov 24.
  {
    id: 'tt15-next-market', when: '2026-11-11T12:30:00', theme: 'Apply now for a booth at the next seasonal market', promo: true,
    template: 'invite', style: 'green', pattern: 'arches', music: 'lofi-grind', motion: 'editorial',
    words: {
      eyebrow: 'Seasonal Atlanta markets',
      headline: 'Want a booth at our next market?',
      body: 'Apply once now. New market dates are announced on p31market.com/calendar.',
      button: 'Apply at p31market.com/apply',
    },
    caption: 'Planning your next season of selling? Start with your application. 🗓️\n\nProverbs 31 Marketplace hosts seasonal markets in Atlanta for women-led brands, artisans and makers. Apply once at p31market.com/apply, and acceptance and event details are emailed to you.\n\nNew market dates are announced on p31market.com/calendar, so you can apply now and keep an eye on the calendar.\n\nWhat would your booth be known for? 👇\n\n#P31Marketplace #AtlantaVendors #WomenOwnedBusiness #ShopSmallATL',
  },
  {
    id: 'tt16-shop-small', when: '2026-11-12T19:30:00', theme: 'Shop small this season',
    template: 'quote', style: 'blush', pattern: 'dots', music: 'golden-hour', motion: 'bold',
    words: { headline: 'Shop small this season. Someone built that with her own hands.' },
    script: 'Proverbs 31 Marketplace',
    caption: 'Before the big-box carts fill up, think small. 🛍️\n\nEvery handmade candle, every printed tee, every jar of body butter from a small, women-owned shop is someone’s calling, built one order at a time.\n\n“For who hath despised the day of small things?” Zechariah 4:10 (KJV)\n\nThis season, put a few small businesses on your gift list. Where do you love to shop small? 👇\n\n#P31Marketplace #ShopSmall #WomenOwnedBusiness #ShopSmallATL',
  },
  {
    id: 'tt17-busy-season-prayer', when: '2026-11-13T12:30:00', theme: 'A Friday prayer for the busy selling season',
    template: 'prayer', style: 'thistle', pattern: 'blobs', music: 'still-waters', motion: 'gentle',
    words: { intro: 'Dear God,', headline: 'In this busy season, steady my hands and let my work serve people well.' },
    footer: 'p31market.com',
    caption: 'A Friday prayer for the busiest selling season of the year. 🙏🏾\n\nDear God, in this busy season, steady my hands and let my work serve people well. Give me rest when I need it and wisdom with every order. Amen.\n\n“And let the beauty of the LORD our God be upon us: and establish thou the work of our hands upon us; yea, the work of our hands establish thou it.” Psalm 90:17 (KJV)\n\nWhat are you asking God for as the holidays get closer? 👇\n\n#P31Marketplace #BusinessPrayer #ChristianWomenInBusiness #FaithAndBusiness',
  },
  {
    id: 'tt18-luncheon-five-weeks', when: '2026-11-14T13:00:00', theme: 'Luncheon countdown: five weeks to Dec 19', promo: true,
    template: 'invite', style: 'plum', pattern: 'rings', music: 'sunday-best', motion: 'editorial',
    words: {
      eyebrow: 'Five weeks from today',
      headline: 'Business & Leadership Luncheon',
      body: 'Saturday, December 19 at 1:30 PM at The Four Event Center, Atlanta. Faith, business and leadership over a seated meal.',
      button: 'Tickets on Eventbrite',
    },
    caption: 'Five Saturdays from now, we sit down together. ✨\n\nThe Proverbs 31 Business & Leadership Luncheon is Saturday, December 19, 2026, at 1:30 PM at The Four Event Center in Atlanta: a seated meal, light networking and real conversation about faith, business and leadership.\n\nWhether you have run a business for years or you are still deciding, there is a place for you at the table. Tickets are on Eventbrite: search “Proverbs 31 Business Leadership Luncheon”, or find it on p31market.com/calendar.\n\nWhat is one question you would bring to a table of women leaders? 👇\n\n#P31Marketplace #BusinessLuncheon #WomenInLeadership #AtlantaEvents',
  },
  {
    id: 'tt19-commit-thy-works', when: '2026-11-15T16:00:00', theme: 'Sunday scripture (Proverbs 16:3)',
    template: 'scripture', style: 'sage', pattern: 'waves', music: 'worship-rise', motion: 'spoken',
    words: { verse: 'Commit thy works unto the LORD, and thy thoughts shall be established.', reference: 'Proverbs 16:3' },
    footer: 'p31market.com',
    caption: 'Before the plans, the prayer. 🕊️\n\n“Commit thy works unto the LORD, and thy thoughts shall be established.” Proverbs 16:3 (KJV)\n\nThe last weeks of the year fill up fast: orders, markets, family, year-end plans. Hand the work to God first, then build.\n\nWhat work are you committing to Him this week? 👇\n\n#P31Marketplace #SundayScripture #ChristianEntrepreneur #KJV',
  },
  {
    id: 'tt20-one-link', when: '2026-11-16T19:30:00', theme: 'A storefront link for gift season', promo: true,
    template: 'invite', style: 'lilac', pattern: 'topo', music: 'boss-moves', motion: 'bold',
    words: {
      eyebrow: 'Virtual storefront',
      headline: 'Give your customers one link this season.',
      body: 'Up to 10 products or services with secure Stripe checkout. Free for 3 months, then $14.99 a month. 5% per sale.',
      button: 'Start at p31market.com/storefront',
    },
    caption: 'Gift shoppers want to find you fast. Give them one link. 🎁\n\nA P31 virtual storefront is your own page on p31market.com with:\n• up to 10 products or services\n• secure checkout through Stripe\n• P31 marketing: SEO, Google, Meta and social\n• a community chat with other P31 women creatives\n\nThere’s no monthly fee for your first 3 months; after that it’s $14.99 a month if you keep your storefront. A 5% fee applies to each sale.\n\nRead the terms and sign up at p31market.com/storefront. Within 7 to 10 days you’ll get a link to set up your shop.\n\nWhich product would you list first? 👇\n\n#P31Marketplace #VirtualStorefront #WomenOwnedBusiness #ShopSmall',
  },
  {
    id: 'tt21-proudest', when: '2026-11-17T12:30:00', theme: 'Finish the sentence: the work you are proudest of',
    template: 'blank', style: 'ivory', pattern: 'dots', music: 'bright-open', motion: 'gentle',
    words: { eyebrow: 'Finish the sentence', headline: 'The thing I make that I am proudest of is', ask: 'Your answer in the comments' },
    footer: 'p31market.com',
    caption: 'Finish the sentence: The thing I make that I am proudest of is ______.\n\nThe woman in Proverbs 31 knew the worth of her own work:\n\n“She perceiveth that her merchandise is good: her candle goeth not out by night.” Proverbs 31:18 (KJV)\n\nName yours, and own it. 👇\n\n#P31Marketplace #Proverbs31Woman #WomenWhoBuild #FaithAndBusiness',
  },
  {
    id: 'tt22-not-afraid-of-the-snow', when: '2026-11-18T19:30:00', theme: 'P31 Merch for colder days (Proverbs 31:21)', promo: true,
    template: 'invite', style: 'olive', pattern: 'grain', music: 'golden-hour', motion: 'bold',
    words: {
      eyebrow: 'P31 Merch · Proverbs 31:21',
      headline: 'She is not afraid of the snow.',
      body: 'On a tee and a mug, next to crewnecks, hoodies, totes and journals. Every piece is printed for you when you order.',
      button: 'Shop p31market.com/merch',
    },
    caption: 'Cold days are coming. She is ready. ❄️\n\n“She is not afraid of the snow for her household: for all her household are clothed with scarlet.” Proverbs 31:21 (KJV)\n\nOur She Is Not Afraid design is on a tee and a mug at p31market.com/merch, next to crewnecks, hoodies, totes and journals in designs like Strength & Honour and Far Above Rubies.\n\nEvery piece is printed when you order, in 2 to 7 business days, and then shipped, so order gifts early.\n\nWho on your list is not afraid of the snow? 👇\n\n#P31Marketplace #ChristianMerch #FaithApparel #Proverbs31Woman',
  },
  {
    id: 'tt23-luncheon-one-month', when: '2026-11-19T12:30:00', theme: 'Luncheon countdown: one month to Dec 19', promo: true,
    template: 'quote', style: 'royal', pattern: 'topo', music: 'sunday-best', motion: 'typed',
    words: { headline: 'One month until the Business & Leadership Luncheon.' },
    script: 'Saturday, December 19 · 1:30 PM',
    caption: 'One month from today. 🗓️\n\nThe Proverbs 31 Business & Leadership Luncheon is Saturday, December 19, 2026, at 1:30 PM at The Four Event Center in Atlanta.\n\nCome for a seated meal, light networking and an afternoon about building a business and leading with faith. Business owners, women about to start, and anyone still deciding are all welcome.\n\nTickets are on Eventbrite: search “Proverbs 31 Business Leadership Luncheon”, or find it on p31market.com/calendar.\n\nWhat is one leadership lesson this year taught you? 👇\n\n#P31Marketplace #BusinessLuncheon #WomenInLeadership #AtlantaEvents',
  },
  {
    id: 'tt24-thankful-prayer', when: '2026-11-20T19:30:00', theme: 'A Friday prayer of thanks before Thanksgiving week',
    template: 'prayer', style: 'amethyst', pattern: 'waves', music: 'still-waters', motion: 'gentle',
    words: { intro: 'Dear God,', headline: 'Thank You for every open door this year, and for the ones You closed.' },
    footer: 'p31market.com',
    caption: 'A Friday prayer as Thanksgiving week comes close. 🙏🏾\n\nDear God, thank You for every open door this year, and for the ones You closed. Thank You for every customer, every lesson and every provision. Amen.\n\n“In every thing give thanks: for this is the will of God in Christ Jesus concerning you.” 1 Thessalonians 5:18 (KJV)\n\nWhat door are you thanking God for this year? 👇\n\n#P31Marketplace #BusinessPrayer #ChristianWomenInBusiness #Gratitude',
  },
  {
    id: 'tt25-openeth-her-mouth', when: '2026-11-21T13:00:00', theme: 'Saturday Bible fill-in-the-blank (Proverbs 31:26)',
    template: 'blank', style: 'gold', pattern: 'waves', music: 'bright-open', motion: 'gentle',
    words: {
      eyebrow: 'Fill in the blank · KJV',
      headline: 'She openeth her mouth with ______',
      ask: 'Proverbs 31:26 · your answer below',
    },
    footer: 'p31market.com',
    caption: 'Saturday Bible challenge 📖 No peeking!\n\n“She openeth her mouth with ______; and in her tongue is the law of kindness.” Proverbs 31:26 (KJV)\n\nIn business, how we speak to customers, vendors and each other matters as much as what we sell.\n\nWhat is the missing word? Drop your answer in the comments 👇\n\n#P31Marketplace #Proverbs31Woman #BibleChallenge #FaithAndBusiness',
  },
  {
    id: 'tt26-enter-his-gates', when: '2026-11-22T16:00:00', theme: 'Sunday scripture for Thanksgiving week (Psalm 100:4)',
    template: 'scripture', style: 'dusk', pattern: 'arches', music: 'sunday-keys', motion: 'spoken',
    words: { verse: 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.', reference: 'Psalm 100:4' },
    footer: 'p31market.com',
    caption: 'Thanksgiving week starts with thanks to Him. 🍂\n\n“Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.” Psalm 100:4 (KJV)\n\nBefore the recipes, the travel and the holiday orders, take a minute to count what God has done in your business this year.\n\nWhat is at the top of your thank-you list? 👇\n\n#P31Marketplace #SundayScripture #Thanksgiving #KJV',
  },
  {
    id: 'tt27-grateful', when: '2026-11-23T12:30:00', theme: 'Thanksgiving week gratitude',
    template: 'quote', style: 'thistle', pattern: 'topo', music: 'sunday-keys', motion: 'spoken',
    words: { headline: 'Grateful for every woman who chose to build anyway.' },
    script: 'Happy Thanksgiving week',
    caption: 'To every woman who started scared, sold her first piece, came back after a slow season, or is still deciding: we are grateful for you. 💜\n\nProverbs 31 Marketplace exists so the work of women’s hands can be seen and celebrated, online at p31market.com and at our seasonal markets in Atlanta.\n\n“Give her of the fruit of her hands; and let her own works praise her in the gates.” Proverbs 31:31 (KJV)\n\nWhat is one thing you are grateful for in your business this year? 👇\n\n#P31Marketplace #Gratitude #WomenWhoBuild #WomenSupportingWomen',
  },
  {
    id: 'tt28-shop-small-weekend', when: '2026-11-24T19:30:00', theme: 'Shop small the Saturday after Thanksgiving', promo: true,
    template: 'invite', style: 'plum', pattern: 'dots', music: 'boss-moves', motion: 'bold',
    words: {
      eyebrow: 'The Saturday after Thanksgiving',
      headline: 'Shop small. Shop women-owned.',
      body: 'Put local makers and women-owned shops on your list this weekend, P31 Merch included.',
      button: 'Shop p31market.com/merch',
    },
    caption: 'The Saturday after Thanksgiving is for shopping small. 🛍️\n\nThis weekend, before you click “add to cart” on a giant website, look for the makers near you: the candle maker, the jeweler, the baker, the woman selling from her table at a local market.\n\nP31 Merch belongs on that list too: Proverbs 31 on tees, crewnecks, hoodies, mugs, totes, stickers, journals and hats at p31market.com/merch, printed for you when you order.\n\nAnd if you are the maker, a P31 virtual storefront is free for your first 3 months, then $14.99 a month if you keep it, plus 5% per sale: p31market.com/storefront.\n\nWhich small shop is first on your list this weekend? 👇\n\n#P31Marketplace #ShopSmall #WomenOwnedBusiness #ShopSmallATL',
  },
];

export const POSTS = POSTS_RAW.map((p, i) => ({ ...p, seed: 11 + i * 17, label: labelOf(p.when) }))
  .sort((a, b) => a.when.localeCompare(b.when));

// Words that must never appear on a Market TikTok (Collective wording, DM promises, bait, handles).
const BANNED = [
  [new RegExp([
    /\b(we('|’)ll|we will|will|we('|’)d|to) (DM|inbox|message) you\b/, // "we'll DM you", "our assistant will message you"
    /\bDM(s|'d|’d|ed)? you\b/, // "DMs you", "DM'd you"
    /\b(send|sent|sending|message|messaging) you (a |an |the )?(DM|direct message|private message|message)\b/, // "we will send you a DM"
    /\b(sent|send|straight|right|slide) (to|in|into) your (DMs?|inbox)\b/, /\bcheck your (DMs?|inbox|messages)\b/,
  ].map((r) => r.source).join('|'), 'i'), 'promises a DM'],
  // "Comment VENDOR", "comment “SELL” below", "type YES": the keyword is in capitals, the verb in any case.
  [/\b([Cc]omment|COMMENT|[Tt]ype|TYPE|[Rr]eply|REPLY|[Dd]rop|DROP) ["“'‘]?[A-Z]{3,}\b/, 'comment-a-keyword call to action'],
  [/\btag (a|your)\b|\bshare (this )?if\b|\bshare with\b/i, 'engagement bait'],
  [/collective|mentorship|mentor\b|gathering|NEBA|thep31collective/i, 'Collective wording'],
  [/@\w/, 'a handle'],
  [/klarna|afterpay|cash ?app|venmo/i, 'a payment method the shops do not take'],
];

/** What is wrong with a post's copy (empty when it is fine): length, hashtags, house rules. */
export function problems(p) {
  const out = [];
  const tags = p.caption.match(/#\w+/g) || [];
  if ([...p.caption].length > 2200) out.push(`caption is ${[...p.caption].length} characters (TikTok allows 2,200)`);
  if (tags.length < 3 || tags.length > 5) out.push(`${tags.length} hashtags (want 3 to 5)`);
  if (!tags.includes('#P31Marketplace')) out.push('no #P31Marketplace');
  const card = Object.values(p.words).concat(p.script || [], p.footer || []).join(' ');
  for (const [re, why] of BANNED) {
    if (re.test(p.caption)) out.push(`caption: ${why}`);
    if (re.test(card)) out.push(`card: ${why}`);
  }
  return out;
}
