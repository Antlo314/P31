// "Push me God" collection: 48 posts in the look of the CEO's Canva quote card (bold caps,
// script handle, topo lines) across the brand colours, with curator and mentorship invitations
// mixed in. The Design studio opens any of them as a template; marketing/social/2026-10-13-quotes
// draws and schedules them. Scripture is KJV, word for word. Captions avoid engagement bait.
// In captions, {link} becomes "link in bio" on Instagram and the full address on Facebook.

const TAGS = {
  faith: '#P31Marketplace #Proverbs31Woman #FaithAndBusiness #KingdomEntrepreneur #ChristianWomenInBusiness #WomenWhoBuild',
  scripture: '#P31Marketplace #Proverbs31 #ScriptureForToday #KJV #Proverbs31Woman #FaithOverFear',
  curator: '#P31Marketplace #WomenOwnedBusiness #AtlantaMakers #ShopSmall #WomenWhoBuild #KingdomEntrepreneur',
  mentorship: '#P31Collective #KingdomEntrepreneur #WomenInBusiness #FaithAndBusiness #MentorshipMatters #P31Marketplace',
};

const Q = (headline, caption, extra = {}) => ({ template: 'quote', kind: 'faith', words: { headline }, caption, ...extra });
const P = (intro, headline, caption) => ({ template: 'prayer', kind: 'faith', words: { intro, headline }, caption });
const S = (verse, reference, caption) => ({ template: 'scripture', kind: 'scripture', words: { verse, reference }, caption });
const C = (eyebrow, headline, body, caption) => ({ template: 'invite', kind: 'curator', link: 'curator', words: { eyebrow, headline, body, button: 'Apply at p31market.com/apply' }, caption });
const M = (eyebrow, headline, body, button, caption) => ({ template: 'invite', kind: 'mentorship', link: 'mentorship', words: { eyebrow, headline, body, button }, caption });
const B = (kind, link, eyebrow, headline, ask, caption) => ({ template: 'blank', kind, link, words: { eyebrow, headline, ask }, caption });

const POSTS = [
  Q('Lord, stretch me. I’m ready for the room You promised.', 'Growth is uncomfortable. So is staying the same. 💜\n\nIf you’re praying for more, get ready to be stretched for it. What is God stretching you in this season?'),
  Q('She was never too much. She was built for more.', 'To every woman who was told to tone it down: the fire in you was put there on purpose.\n\nWhat are you building that once felt “too big” to say out loud?'),
  C('Now accepting curators', 'Your gift was never meant to stay hidden.', 'Your own storefront on p31market.com, a seat at our Atlanta markets, coaching and a sisterhood of women who build.',
    'Your gift was never meant to stay hidden. ✨\n\nApplications are open to become a P31 curator: your own storefront on p31market.com, a seat at our seasonal Atlanta markets, brand curation, design and coaching, and a community of women who build together.\n\nEvery curator is hand-selected for craft, story and purpose. Apply today: {link}'),
  Q('Delayed is not denied. Keep building.', 'The wait is not wasted. God is working on the details you can’t see yet.\n\nIf you’re still building through a delay, comment “still building” and let us cheer you on. 🧱'),
  S('Strength and honour are her clothing; and she shall rejoice in time to come.', 'Proverbs 31:25', 'Strength and honour are her clothing. Not worry. Not fear. Strength and honour.\n\nWhat would you do differently this week if you dressed in strength every morning?'),
  Q('My business is my ministry. My gift is my assignment.', 'Every product, every client, every post can carry purpose.\n\nHow does your business serve people beyond the sale? We’d love to hear it.'),
  M('The P31 Collective', 'You don’t need another sign. You need a mentor.', 'Business and faith-based mentorship for women who build, with live sessions and a private classroom.', 'Book your free intro call',
    'Some of you are not waiting on a sign. You’re waiting on a mentor. 💜\n\nThe P31 Collective by NEBA is private mentorship for faith-driven women entrepreneurs: business mentorship and faith-based mentorship, with live sessions and a classroom built for you.\n\nIt starts with a free intro call: {link}'),
  Q('Order my steps, God. I’ll do the work.', 'Faith and work were always meant to walk together.\n\nWhat’s one step you’re taking this week, trusting God with the rest?'),
  P('Dear God,', 'Give me the courage to be seen in the work You gave me.', 'Hiding your gift doesn’t make it safer. It just keeps it from the people it was meant for.\n\nIf this is your prayer today, comment Amen. 🙏🏾'),
  Q('Pray like it depends on God. Work like it depends on you.', 'Both. Always both. 💼🙏🏾\n\nWhich one comes easier for you, the praying or the working?'),
  C('Become a P31 curator', 'Your shop. Your story. Our sisterhood.', 'Sell your craft on p31market.com and at our seasonal Atlanta markets, with women who build with purpose.',
    'Your shop. Your story. Our sisterhood. 🛍️\n\nP31 curators get their own storefront on p31market.com and a seat at our seasonal Atlanta markets, plus coaching and a community that builds together.\n\nWoman-led brand with a gift to share? Apply: {link}'),
  Q('I’m not chasing a seat at the table. I’m building one.', 'And there’s room at it for the women coming after you.\n\nWhat are you building that you want to pass on?', { align: 'center' }),
  Q('Faith over fear. Purpose over pressure.', 'Pressure says hurry. Purpose says obey.\n\nWhich one have you been listening to lately?'),
  S('A man’s gift maketh room for him, and bringeth him before great men.', 'Proverbs 18:16', 'Your gift makes room. You don’t have to force the door.\n\nWhat is the gift God has placed in your hands? Tell us below. 💜'),
  M('Mentorship for women who build', 'Stop building alone.', 'Strategy, accountability and faith, with mentors who have walked the road before you.', 'Free intro call: thep31collective.org/join',
    'You were never meant to build alone. 🤝\n\nThe P31 Collective pairs faith-driven women entrepreneurs with mentorship for the business and the heart behind it: live sessions, a private classroom and women who’ve walked the road.\n\nStart with a free intro call: {link}'),
  Q('Quiet seasons grow deep roots.', 'If it feels slow right now, look down. Something is growing.\n\nWhat has a quiet season taught you?', { align: 'center' }),
  Q('Rejected? No. Redirected.', 'That closed door may be the most loving thing God did for your business this year.\n\nHas a “no” ever led you somewhere better?'),
  Q('I will not shrink to fit rooms I’ve outgrown.', 'Outgrowing a place is not ungratefulness. It’s growth.\n\nComment “growing” if you feel this one. 🌱'),
  B('curator', 'curator', 'Finish the sentence', 'If I opened a P31 shop tomorrow, I’d sell', 'Tell us in the comments',
    'Dream with us for a second. ✨\n\nIf you opened a shop on the P31 Marketplace tomorrow, what would you sell? Tell us below.\n\nAnd if you’re serious about it, curator applications are open: {link}'),
  Q('Your obedience is someone else’s breakthrough.', 'The post you’re nervous to share, the product you’re scared to launch, someone needs it.\n\nWhat is God asking you to release?'),
  Q('Build it with prayer. Brand it with purpose.', 'Your logo matters. Your why matters more.\n\nIn one sentence, why does your business exist? Drop it below.'),
  Q('God, help me trust the pace of Your plan.', 'Comparison will tell you you’re late. God’s timing says otherwise.\n\nIf you needed this reminder today, comment Amen. 🙏🏾', { align: 'center' }),
  M('Business mentorship', 'Your vision needs a plan. Let’s write it together.', 'Live sessions and a private classroom to grow your business, rooted in faith.', 'Book your free intro call',
    '“Write the vision, and make it plain.” Habakkuk 2:2\n\nA vision without a plan stays a dream. Business mentorship in the P31 Collective gives you live sessions, a private classroom and accountability to build it out.\n\nIt starts with a free intro call: {link}'),
  S('Commit thy works unto the LORD, and thy thoughts shall be established.', 'Proverbs 16:3', 'Before the plan, the prayer. 🙏🏾\n\nWhat work are you committing to the Lord this week? Name it below and let us pray with you.'),
  Q('Kingdom woman. Business mind. Unshakable heart.', 'All three. No apologies. 👑\n\nWhich one are you growing in right now?'),
  Q('I’m not behind. I’m being prepared.', 'Preparation is not punishment. It’s protection for what’s coming.\n\nWhat is God preparing you for?'),
  C('Makers, bakers and builders', 'Bring your craft to the P31 Marketplace.', 'Handmade goods, wellness, treats, books, decor and services from women-led brands.',
    'Calling the makers, the bakers and the builders. 🧁💍📚\n\nThe P31 Marketplace is home to women-led brands: handmade goods, jewelry, wellness, treats, books and journals, home decor and services.\n\nYour own storefront, our seasonal Atlanta markets, coaching and community. Apply to become a curator: {link}'),
  Q('Stop waiting to feel ready. Start because you’re called.', 'Ready is a feeling. Called is a fact.\n\nWhat would you start this week if you stopped waiting?'),
  P('Note to self:', 'You’re not starting over. You’re starting with experience.', 'Nothing you went through was wasted. You carry wisdom into this next chapter.\n\nWhat did your last season teach you that you’re bringing with you?'),
  Q('Lord, give me the strength to stay consistent.', 'Big moments get attention. Consistent days build the business.\n\nWhat’s one thing you’re committing to show up for daily?', { align: 'center' }),
  B('mentorship', 'mentorship', 'Be honest', 'The one thing I need help with in my business is', 'Tell us below',
    'No judgment here. 💜\n\nWhat’s the one thing you need help with in your business right now? Pricing, marketing, time, faith, focus? Tell us below.\n\nThis is the work we do together in the P31 Collective. Start with a free intro call: {link}'),
  Q('Grace for today. Vision for tomorrow.', 'You don’t need all the answers today. Just enough grace for the next step.\n\nWhat is one thing you’re thankful for in your business today?'),
  S('And the LORD answered me, and said, Write the vision, and make it plain upon tables, that he may run that readeth it.', 'Habakkuk 2:2', 'Write it down. Make it plain. Then run with it. ✍🏾\n\nWhat is one line of the vision God gave you? Write it in the comments.'),
  Q('Heal the woman. Then build the business.', 'Your business can only grow as healthy as the woman leading it.\n\nHow are you taking care of you this week?'),
  C('Curator applications are open', 'Room is being made for you.', 'Every P31 curator is hand-selected for craft, story and purpose. Yours could be next.',
    'Room is being made for you. 💜\n\nWe hand-select every P31 curator for craft, story and purpose. Curators get a storefront on p31market.com, a seat at our seasonal Atlanta markets, coaching and a community of women who build together.\n\nApply today: {link}'),
  Q('It’s not too late. You’re right on God’s time.', 'Age, setbacks, starting late. None of it cancels the call.\n\nIf you’re starting something new this year, tell us what it is. 👇🏾'),
  Q('Small steps still count when God is ordering them.', 'Progress is progress. Celebrate it.\n\nWhat small win did you have this week?'),
  Q('Not every closed door is a no. Some are a not yet.', 'Keep knocking. Keep preparing. Keep believing.\n\nWhat “not yet” are you still believing for?', { align: 'center' }),
  M('Faith-based mentorship', 'Grow your faith and your business at the same time.', 'The P31 Collective by NEBA walks with you in both.', 'Start with a free intro call',
    'You don’t have to choose between your faith and your business. 🙏🏾💼\n\nThe P31 Collective offers faith-based mentorship and business mentorship for women who build, with live sessions and a private classroom.\n\nIt starts with a free intro call: {link}'),
  Q('She’s clothed in strength and still leads with love.', 'Strength and softness can live in the same woman.\n\nWho is a woman that leads like this in your life?'),
  Q('Rest is not quitting. Rest is holy.', 'Even God rested. Your business will be better for it.\n\nHow do you rest well? Share your favorite way below.', { align: 'center' }),
  S('Who can find a virtuous woman? for her price is far above rubies.', 'Proverbs 31:10', 'Far above rubies. That is the worth God places on you. 💎\n\nIf you needed the reminder today, comment Amen.'),
  C('For the woman with a gift', 'Stop selling alone. Build with us.', 'A storefront, seasonal markets, coaching and a community that cheers you on.',
    'Selling alone is exhausting. Building together is different. 🤝\n\nAs a P31 curator you get a storefront on p31market.com, a seat at our seasonal Atlanta markets, coaching and a sisterhood that cheers you on.\n\nApply to become a curator: {link}'),
  Q('What God started in you, He will finish.', 'Philippians 1:6 is still true on the hard days.\n\nWhat has God started in you that you’re trusting Him to finish?'),
  P('Lord,', 'Keep my hands busy and my heart humble.', 'Success is a blessing. Humility keeps it one.\n\nIf this is your prayer too, comment Amen. 🙏🏾'),
  Q('Your gift will make room for you. Keep showing up.', 'The door opens for the one who keeps knocking.\n\nWhat’s the gift you’re showing up with this week?'),
  M('Your next level', 'The right mentor can save you years.', 'Private mentorship for faith-driven women entrepreneurs. It starts with a free intro call.', 'thep31collective.org/join',
    'Some lessons you can learn the hard way. Or you can learn them from someone who already did. 💡\n\nThe P31 Collective by NEBA: business and faith-based mentorship for women who build, with live sessions and a private classroom.\n\nBook your free intro call: {link}'),
  Q('Push past the doubt. The promise is on the other side.', 'Doubt is loud. The promise is louder.\n\nWhat promise are you holding on to right now?'),
];

// The look rotates through the brand styles (lilac, the CEO's own, most often) and patterns.
const LOOKS = ['lilac', 'plum', 'olive', 'thistle', 'lilac', 'gold', 'green', 'amethyst', 'lilac', 'ivory', 'royal', 'sage', 'lilac', 'blush', 'dusk'];
const PATTERNS = ['topo', 'topo', 'topo', 'waves', 'topo', 'topo', 'rings', 'topo', 'topo', 'arches', 'topo', 'topo', 'blobs', 'topo', 'dots'];

export const COLLECTION = POSTS.map((p, i) => ({
  id: `q${String(i + 1).padStart(2, '0')}`,
  ...p,
  style: LOOKS[i % LOOKS.length],
  pattern: PATTERNS[(i * 7) % PATTERNS.length],
  seed: 11 + i * 17,
  hashtags: TAGS[p.kind],
}));

export const LINK_URLS = { curator: 'https://www.p31market.com/apply', mentorship: 'https://www.thep31collective.org/join' };

/** Instagram and Facebook captions for a collection post. */
export function captionsFor(p) {
  const url = p.link ? LINK_URLS[p.link] : '';
  return {
    instagram: `${p.caption.replace('{link}', 'link in bio')}\n\n${p.hashtags}`,
    facebook: `${p.caption.replace('{link}', url)}\n\n${p.hashtags.split(' ').slice(0, 4).join(' ')}`,
  };
}
