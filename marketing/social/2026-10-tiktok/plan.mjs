// Proverbs 31 Marketplace on TikTok: 14 short videos, one a day, Fri Oct 23 – Thu Nov 5 2026 (Eastern).
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
    id: 'tt01-apply', when: '2026-10-23T12:30:00', theme: 'Booths at the seasonal Atlanta markets', promo: true,
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
    id: 'tt02-fine-linen', when: '2026-10-24T13:00:00', theme: 'Saturday Bible fill-in-the-blank (Proverbs 31:24)',
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
    id: 'tt03-strength-honour', when: '2026-10-25T16:00:00', theme: 'Sunday scripture (Proverbs 31:25)',
    template: 'scripture', style: 'gold', pattern: 'topo', music: 'worship-rise', motion: 'spoken',
    words: { verse: 'Strength and honour are her clothing; and she shall rejoice in time to come.', reference: 'Proverbs 31:25' },
    footer: 'p31market.com',
    caption: 'Whatever this week holds, remember what you are clothed in. 🕊️\n\n“Strength and honour are her clothing; and she shall rejoice in time to come.” Proverbs 31:25 (KJV)\n\nThis verse is also on our Strength & Honour tees, crewnecks, totes and journals at p31market.com/merch.\n\nWhich do you need to put on this week: strength, or honour? 👇\n\n#P31Marketplace #Proverbs31Woman #SundayScripture #KJV',
  },
  {
    id: 'tt04-storefront', when: '2026-10-26T19:30:00', theme: 'The virtual storefront and its terms', promo: true,
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
    id: 'tt05-fruit-of-her-hands', when: '2026-10-27T12:30:00', theme: 'The verse the Marketplace is built on (Proverbs 31:31)',
    template: 'scripture', style: 'ivory', pattern: 'arches', music: 'sunday-keys', motion: 'spoken',
    words: { verse: 'Give her of the fruit of her hands; and let her own works praise her in the gates.', reference: 'Proverbs 31:31' },
    footer: 'p31market.com',
    caption: 'The verse this marketplace was built on. 💜\n\n“Give her of the fruit of her hands; and let her own works praise her in the gates.” Proverbs 31:31 (KJV)\n\nProverbs 31 Marketplace was made so the work of women’s hands can be seen, shopped and celebrated: online at p31market.com and at our seasonal markets in Atlanta.\n\nWhat is the work of your hands? 👇\n\n#P31Marketplace #Proverbs31Woman #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt06-luncheon', when: '2026-10-28T19:30:00', theme: 'Business and Leadership Luncheon, Dec 19', promo: true,
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
    id: 'tt07-build-together', when: '2026-10-29T12:30:00', theme: 'Collaboration over competition',
    template: 'quote', style: 'gold', pattern: 'dots', music: 'golden-hour', motion: 'spoken',
    words: { headline: 'Collaboration over competition. We build better together.' },
    script: 'Proverbs 31 Marketplace',
    caption: 'Building a business was never meant to be lonely. 💜\n\nEvery P31 virtual storefront comes with a community chat with other Proverbs 31 women creatives, and our markets put makers side by side. The woman at the next table is not your competition.\n\n“Two are better than one; because they have a good reward for their labour.” Ecclesiastes 4:9 (KJV)\n\nWhat is one thing another business owner taught you? 👇\n\n#P31Marketplace #WomenWhoBuild #WomenSupportingWomen #FaithAndBusiness',
  },
  {
    id: 'tt08-friday-prayer', when: '2026-10-30T19:30:00', theme: 'A Friday prayer for women in business',
    template: 'prayer', style: 'ivory', pattern: 'blobs', music: 'still-waters', motion: 'gentle',
    words: { intro: 'Dear God,', headline: 'Bless the work of my hands and align every business decision with Your Kingdom purpose.' },
    footer: 'p31market.com',
    caption: 'A prayer for every woman building something with her hands. 🙏🏾\n\nDear God, bless the work of my hands and align every business decision with Your Kingdom purpose. Amen.\n\nWhat decision are you praying over this weekend? 👇\n\n#P31Marketplace #BusinessPrayer #ChristianWomenInBusiness #FaithAndBusiness',
  },
  {
    id: 'tt09-growing-in', when: '2026-10-31T13:00:00', theme: 'Finish the sentence: what God is growing',
    template: 'blank', style: 'blush', pattern: 'topo', music: 'worship-rise', motion: 'gentle',
    words: { eyebrow: 'Finish the sentence', headline: 'This season, God is growing my business in', ask: 'Your answer in the comments' },
    footer: 'p31market.com',
    caption: 'Finish the sentence: This season, God is growing my business in ______.\n\nVisibility, sales, boldness, systems, peace of mind… name it and write it down.\n\n“And the LORD answered me, and said, Write the vision, and make it plain upon tables, that he may run that readeth it.” Habakkuk 2:2 (KJV)\n\nDrop yours below 👇\n\n#P31Marketplace #ChristianBusinessOwner #WomenWhoBuild #FaithAndBusiness',
  },
  {
    id: 'tt10-gift-makes-room', when: '2026-11-01T16:00:00', theme: 'Sunday scripture (Proverbs 18:16)',
    template: 'scripture', style: 'plum', pattern: 'topo', music: 'sunday-keys', motion: 'spoken',
    words: { verse: 'A man’s gift maketh room for him, and bringeth him before great men.', reference: 'Proverbs 18:16' },
    footer: 'p31market.com',
    caption: 'When God gives you a gift, He makes room for it. ✨ You don’t have to force every door. Keep showing up with excellence.\n\n“A man’s gift maketh room for him, and bringeth him before great men.” Proverbs 18:16 (KJV)\n\nIt’s the verse behind our motto: where her gifts make room.\n\nWhat gift has God been asking you to stop hiding? 👇\n\n#P31Marketplace #Proverbs1816 #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt11-two-ways', when: '2026-11-02T12:30:00', theme: 'Two ways to become a curator', promo: true,
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
    id: 'tt12-vision', when: '2026-11-03T19:30:00', theme: 'Don’t shrink your vision',
    template: 'quote', style: 'amethyst', pattern: 'topo', music: 'sunday-best', motion: 'typed',
    words: { headline: 'Don’t shrink your vision to fit people who don’t understand your calling.' },
    script: 'Where her gifts make room',
    caption: 'God gave the vision to you. Keep building, keep refining, keep showing up. 👑\n\nWhen you’re ready to put your work in front of more people, there is room for it at P31: a booth at our seasonal Atlanta markets (p31market.com/apply) or a virtual storefront (p31market.com/storefront).\n\nWhat is the vision you refuse to shrink? 👇\n\n#P31Marketplace #WomenWhoBuild #ChristianEntrepreneur #FaithAndBusiness',
  },
  {
    id: 'tt13-merch', when: '2026-11-04T12:30:00', theme: 'P31 Merch', promo: true,
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
    id: 'tt14-out-of-the-dms', when: '2026-11-05T19:30:00', theme: 'Stop selling only in your DMs', promo: true,
    template: 'quote', style: 'dusk', pattern: 'rings', music: 'boss-moves', motion: 'bold',
    words: { headline: 'Stop selling only in your DMs. Open a storefront.' },
    script: 'p31market.com/storefront',
    caption: 'Still sending payment tags back and forth in your DMs? 🛍️\n\nA P31 virtual storefront gives your customers one link to browse and secure checkout through Stripe, with up to 10 products or services and P31 marketing behind you.\n\nNo monthly fee for your first 3 months, then $14.99 a month if you keep it. A 5% fee applies to each sale. Read the terms and sign up at p31market.com/storefront.\n\nWhat is the hardest part of selling through DMs? 👇\n\n#P31Marketplace #VirtualStorefront #SmallBusinessTips #WomenOwnedBusiness',
  },
];

export const POSTS = POSTS_RAW.map((p, i) => ({ ...p, seed: 11 + i * 17, label: labelOf(p.when) }));

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
