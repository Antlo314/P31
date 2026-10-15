// Screen test: opens every main screen on both sites (and clicks the key buttons) in the
// dev server's sample-data mode, and fails if any page crashes, shows the error screen,
// logs a page error, comes up blank, or a button the test expects is missing.
//
//   npm run dev                 (in another terminal)
//   node scripts/screen-test.mjs
//
// P31_BASE (default http://localhost:5180) and CHROME_PATH can be set for CI.
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const BASE = process.env.P31_BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p));

// Every screen runs on the dev-only sample data, so the test needs no accounts or secrets.
const at = (site, who) => (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}site=${site}&demo=${who}&devRole=off`;
const mk = at('market', 'admin');
const cl = at('collective', 'admin');
const st = at('collective', 'student');
const fa = at('collective', 'faith');

// [name, url, buttons to click in order, text the page must show]
const SCREENS = [
  ['market home', mk('/')], ['shop', mk('/shop')], ['curators', mk('/directory')], ['market dates', mk('/calendar')],
  ['about + team', mk('/about')], ['vendor application', mk('/apply'), [], 'What best describes what you sell or offer?'], ['services', mk('/services')], ['partner', mk('/partner')], ['curator sign-in', mk('/login')],
  ['collective home', cl('/'), [], 'You belong here'], ['academy', cl('/academy')], ['systems showcase', at('collective', 'student')('/systems')],
  ['join', cl('/join')], ['mentorship', cl('/mentorship')], ['business mentorship', cl('/mentorship/business')],
  ['faith mentorship', cl('/mentorship/faith')], ['verify', cl('/verify')], ['portal', cl('/portal?choose')],
  ['today', cl('/today'), [], 'Join applications'], ['portal sends the team to today', cl('/portal'), [], 'Work to grade'], ['students skip today', st('/today')],
  ['mentor overview', cl('/academy/business/teach')],
  ['student preview window', cl('/academy/business/teach'), ['Preview', 'Desktop', 'Tablet']], ['mentor inbox', cl('/academy/business/teach/inbox/u-s1')],
  ['students', cl('/academy/business/teach/students')],
  ['student page tabs', cl('/academy/business/teach/students/u-s1'), ['Personal tasks', 'Files', '1:1 sessions', 'Action plans', 'Progress', 'Work', 'Private notes']],
  ['see their dashboard', cl('/academy/business/teach/students/u-s1'), ['See their dashboard']],
  ['assignments + new', cl('/academy/business/teach/assignments'), ['New assignment']],
  ['gradebook + grade', cl('/academy/business/teach/gradebook'), ['Grade']],
  ['quizzes + new', cl('/academy/business/teach/quizzes'), ['New quiz']],
  ['sessions + go live', cl('/academy/business/teach/sessions'), ['Go live now']],
  ['call report', cl('/academy/business/teach/sessions'), ['Report']],
  ['curriculum', cl('/academy/business/teach/curriculum')], ['announcements', cl('/academy/business/teach/announcements')],
  ['completion', cl('/academy/business/teach/completion')], ['intro calls', cl('/academy/business/teach/calls')],
  ['invites', cl('/academy/business/teach/invites')], ['mentor discussions', cl('/academy/business/teach/discussions')],
  ['student home', st('/academy/business')], ['lessons', st('/academy/business/learn')], ['lesson', st('/academy/business/learn/l5')],
  ['student assignments', st('/academy/business/assignments')], ['assignment', st('/academy/business/assignments/a1')],
  ['student quizzes', st('/academy/business/quizzes')], ['quiz', st('/academy/business/quizzes/q1')],
  ['student sessions', st('/academy/business/sessions')], ['member line', st('/academy/business/messages')],
  ['library', st('/academy/business/library')], ['progress', st('/academy/business/progress')], ['action plans', st('/academy/business/plans')],
  ['goals', st('/academy/business/goals')], ['discussions', st('/academy/business/discussions')], ['thread', st('/academy/business/discussions/t1')],
  ['billing', st('/academy/business/billing')], ['faith home', fa('/academy/faith')], ['journal', fa('/academy/faith/journal')],
  ['studio', cl('/studio')], ['studio calendar', cl('/studio/calendar')], ['studio compose', cl('/studio/compose')],
  ['studio inbox', cl('/studio/inbox')], ['studio comments', cl('/studio/comments')], ['studio create', cl('/studio/create')],
  ...['', 'crm', 'applications', 'social', 'growth', 'events', 'campaigns', 'orders', 'academy', 'clips', 'photos', 'pro-edit', 'health', 'settings']
    .map((p) => [`systems ${p || 'overview'}`, cl(`/systems${p ? '/' + p : ''}`)]),
  ['systems overview by site', cl('/systems'), [], 'Paid this month'],
  ['systems overview: collective numbers', cl('/systems'), [], 'Students active'],
  // Phones: the admin console folds to what works on the go; video tools wait for a computer.
  ['systems overview on a phone', cl('/systems'), [], 'Proverbs 31 Marketplace', { phone: true }],
  ['systems more sheet on a phone', cl('/systems/orders'), ['More'], 'On your computer', { phone: true }],
  ['systems clip studio on a phone', cl('/systems/clips'), [], 'Clip Studio needs a computer', { phone: true }],
  ['systems davinci on a phone', cl('/systems/pro-edit'), [], 'DaVinci is paused for now', { phone: true }],
  ['systems orders on a phone', cl('/systems/orders'), [], 'Marketplace orders', { phone: true }],
  ['studio creative tools on a phone', cl('/studio/create'), ['Clip Studio'], 'Clip Studio needs a computer', { phone: true }],
  ['curator creative studio on a phone', at('market', 'curator')('/dashboard/studio'), ['Clip Studio'], 'Clip Studio needs a computer', { phone: true }],
  ['today on a phone', cl('/today'), [], 'Join applications', { phone: true }],
  ['team access', cl('/systems/team'), [], 'Add a login'],
  ['vendor applications', cl('/systems/vendors'), [], 'Sample Candle Co.'],
  ['vendor decision email', cl('/systems/vendors'), ['All', 'Sample Crafts'], 'Sends the welcome from vendor@p31market.com'],
  ['event lineup', cl('/systems/events'), ['Lineup'], 'Sample Candle Co.'],
  ['market dates lineup', mk('/calendar'), [], 'Handmade crafts, baskets & gifts'],
  ['davinci paused', cl('/systems/pro-edit'), [], 'DaVinci is paused for now'],
  // Team members with one tool (like Anthony → DaVinci, Yanni → Content Studio).
  ['davinci member sees the pause note', at('collective', 'davinci')('/systems/pro-edit'), [], 'DaVinci is paused for now'],
  ['davinci member: a page she lacks goes to her dashboards', at('collective', 'davinci')('/systems/crm'), [], 'this login opens'],
  ['studio member lands in studio + walkthrough', at('collective', 'studio')('/portal'), [], 'Welcome to Content Studio'],
  ['studio walkthrough steps', cl('/studio'), ['Next', 'Next'], 'Planner: months ahead'],
  ['studio planner', cl('/studio/planner'), [], 'Plan this month with AI'], ['studio planner: open a post', cl('/studio/planner'), ['Two weeks until the Luncheon'], 'Draft hook, caption & hashtags'],
  ['studio auto-create', cl('/studio/autocreate'), [], 'Choose the mix'],
  ['studio auto-create: preview', cl('/studio/autocreate'), ['Preview the posts'], 'Save as drafts'],
  ['studio auto-create: library', cl('/studio/autocreate'), ['Library'], 'Add your own'],
  ['studio auto-create on a phone', cl('/studio/autocreate'), ['Preview the posts'], 'Schedule all', { phone: true }],
  ['studio design: the collection', cl('/studio/design'), [], 'Use in a post'],
  ['studio design: templates', cl('/studio/design'), ['Templates'], 'Bold quote'],
  ['studio design: brand styles', cl('/studio/design'), ['Styles'], 'Plum night'],
  ['studio design: add text', cl('/studio/design'), ['Add', 'Heading'], 'Shrink long text to fit'],
  ['studio design: music', cl('/studio/design'), ['Music'], 'Sunday Keys'],
  ['studio design: motion presets', cl('/studio/design'), ['Motion'], 'Lines rise out of the page'],
  ['studio design: saved designs', cl('/studio/design'), ['Saved'], 'Nothing saved yet'],
  ['studio design: batch', cl('/studio/design'), ['Batch'], 'Make the designs'],
  ['studio design on a phone', cl('/studio/design'), ['Styles'], 'Plum night', { phone: true }],
  ['studio email + send', cl('/studio/email'), ['Sample Applicant', 'Send reply', 'Yes, send it'], 'Sent to sample.applicant@example.com'],
  ['studio email: needs a person', cl('/studio/email'), ['Sample Vendor'], 'Needs a person: Refund request'],
  ['classroom walkthrough', st('/academy/business'), ['Next'], 'Home: what’s next'],
  // A vendor (curator) with an approved shop.
  ['curator storefront tab', at('market', 'curator')('/dashboard/storefront'), [], 'Lemon Pound Cake'],
  ['curator product templates', at('market', 'curator')('/dashboard/storefront'), ['Add Artifact'], 'Start from a template'],
  ['curator marketing', at('market', 'curator')('/dashboard/marketing'), [], 'Which product?'],
  ['curator marketing: write the kit', at('market', 'curator')('/dashboard/marketing'), ['Write the kit'], 'The cake that sells out first'],
  ['curator marketing: followers', at('market', 'curator')('/dashboard/marketing'), ['Followers & email'], 'Email your followers'],
  ['curator marketing: share kit', at('market', 'curator')('/dashboard/marketing'), ['Share kit'], 'Table sign for the market'],
  ['curator marketing: insights', at('market', 'curator')('/dashboard/marketing'), ['Insights'], 'What’s working'],
  ['curator setup list + walkthrough', at('market', 'curator')('/dashboard/identity'), ['Start the walkthrough', 'Next', 'Next'], 'Your banner and logo'],
  ['curator walkthrough reaches marketing', at('market', 'curator')('/dashboard/identity'), ['Start the walkthrough', 'Next', 'Next', 'Next', 'Next', 'Next', 'Next'], 'Get seen'],
  ['curator menu groups fold', at('market', 'curator')('/dashboard/identity'), ['Sell', 'Grow', 'Help & Guide'], 'Welcome to your studio'],
  ['storefront: badges, timer, follow box', mk('/sample-bakery'), [], 'Get updates from Sample Bakery Co.'],
  ['storefront: product sheet', mk('/sample-bakery?p=101'), [], 'Sale ends in'],
  // The vendor forms that replaced JotForm (word for word), and the Systems page that receives them.
  ['vendor forms hub', mk('/vendors'), [], 'Storefront Agreement'],
  ['storefront agreement', mk('/vendors/agreement'), [], 'Account Setup Timeline'],
  ['storefront agreement: form + signature', mk('/vendors/agreement'), ['I agree'], 'Submit Agreement'],
  ['market registration', mk('/vendors/register'), [], 'Vendor Setup & Arrival Policy'],
  ['market registration: pick the market', mk('/vendors/register'), ['Business and Leadership'], 'Upload your Business logo'],
  ['vendor feedback survey', mk('/vendors/feedback'), ['Excellent'], 'Are you interested in vending with P31 again?'],
  ['volunteer acknowledgment', mk('/volunteer'), [], 'I acknowledge and agree to the five statements above'],
  ['volunteer on a phone', mk('/volunteer'), [], 'In the case of an emergency, who should we contact for you?', { phone: true }],
  ['registration on a phone', mk('/vendors/register'), [], 'Vendor Child Policy', { phone: true }],
  ['partner → volunteer link', mk('/partner'), ['Volunteer'], 'Day-of-Event Acknowledgment'],
  ['curator checklist: agreement step', at('market', 'curator')('/dashboard/identity'), [], 'Sign the Storefront Agreement'],
  ['systems vendor forms: agreements', cl('/systems/forms'), [], 'Sample Candle Co.'],
  ['systems vendor forms: agreement detail', cl('/systems/forms'), ['Sample Candle Co.'], 'Pre-approve & email Sample the account link'],
  ['systems vendor forms: registrations', cl('/systems/forms?tab=registrations'), ['Sample Candle Co.'], 'Add to lineup'],
  ['systems vendor forms: feedback', cl('/systems/forms?tab=feedback'), [], 'September 2026'],
  ['systems vendor forms: feedback detail', cl('/systems/forms?tab=feedback'), ['Sample Crafts'], 'Invite into the lineup'],
  ['systems vendor forms: volunteers', cl('/systems/forms?tab=volunteers'), ['Sample Volunteer'], 'Sample Parent · (470) 555-0181'],
  ['systems vendor forms on a phone', cl('/systems/forms?tab=registrations'), [], 'Business and Leadership Luncheon', { phone: true }],
  // A market whose month is announced but not its day reads "December · date coming soon" (Eventbrite link says Get tickets).
  ['market home: month announced', mk('/'), [], '· date coming soon'],
  ['market dates: month announced + tickets', mk('/calendar'), [], 'Get tickets'],
  ['systems overview: vendor forms card', cl('/systems'), [], 'Vendor forms'],
  // Efficiency round: admins from the database, one-step approval into a market, My markets, monthly drafting.
  ['team access: site admins', cl('/systems/team'), [], 'proverbs31markets@gmail.com'],
  ['vendor approval: pick a market', cl('/systems/vendors'), ['All', 'Sample Crafts'], 'Add her to a market'],
  ['curator: my markets', at('market', 'curator')('/dashboard/identity'), [], 'Booth A4'],
  ['studio pre-posts: draft a month', cl('/studio/autocreate?tab=queue'), ['Draft the rest of'], 'posts drafted for'],
  ['systems showcase without 3D', at('collective', 'student')('/systems'), [], 'The engine behind'],
  // The Gathering: community messaging for vendors, students, mentors, the team and overseers.
  ['gathering: the room', cl('/gather/the-gathering'), [], 'Welcome to the family'],
  ['gathering: badges', cl('/gather/the-gathering'), [], 'Founder & CEO'],
  ['gathering: daily word discussion', cl('/gather/daily-word'), ['Join the discussion'], 'I needed that reminder before my launch'],
  ['gathering: members', cl('/gather/the-gathering'), ['Members'], 'Aaliyah Grant'],
  ['gathering: thread', cl('/gather/the-gathering'), ['1 reply'], 'So grateful to be here!'],
  ['gathering: prayer channel', cl('/gather/prayer'), [], 'Share what you are carrying'],
  ['gathering as a vendor', at('market', 'curator')('/gather'), [], 'Market talk'],
  ['gathering as a student', st('/gather/academy'), [], 'Academy lounge'],
  ['gathering on a phone', cl('/gather/the-gathering'), [], 'Welcome to the family', { phone: true }],
  ['curator studio opens the gathering', at('market', 'curator')('/dashboard/community'), [], 'Market talk'],
  ['today: the daily word', cl('/today'), [], 'Strength and honour are her clothing'],
  ['gathering: my card has notification switches', cl('/gather/the-gathering'), ['Melanie JC'], 'Email me if I have not read it'],
  // Team photos and the reworded pop-up.
  ['about: team photo and portraits', mk('/about'), [], 'Savannah Campbell'],
  ['pop-up opens from the footer', mk('/'), ['Subscribe to our newsletter'], 'You’re subscribed'],
  ['collective: melanie and the team', cl('/'), [], 'Melanie JC'],
  // Team dashboards (v41): the Team page, a team member's console, the shops page, curriculum and sessions editors, walkthroughs.
  ['team & dashboards: the directory', cl('/systems/team'), [], 'Savannah Campbell'],
  ['team & dashboards: chips per login', cl('/systems/team'), [], 'Social media manager'],
  ['team & dashboards: add a login', cl('/systems/team'), ['Shanay Prince'], 'suggested:'],
  ['team member: my dashboards', at('collective', 'team')('/systems'), [], 'this login opens'],
  ['team member: only her pages in the menu', at('collective', 'team')('/systems'), [], 'Vendor applications'],
  ['team member: a page she lacks goes home', at('collective', 'team')('/systems/orders'), [], 'this login opens'],
  ['team member: a page she has', at('collective', 'team')('/systems/vendors'), [], 'Sample Candle Co.'],
  ['team member: today shows her cards', at('collective', 'team')('/today'), [], 'Vendor forms'],
  ['team member: walkthroughs for her dashboards', at('collective', 'team')('/systems/walkthroughs'), [], 'Vendor applications'],
  ['emails dashboard opens the inbox only', at('collective', 'team')('/studio'), [], 'Sample Applicant'],
  ['shops dashboard: the shops page', at('collective', 'shops')('/systems/shops'), [], 'Sample Bakery Co.'],
  ['shops dashboard: no mentorship page', at('collective', 'shops')('/systems/academy'), [], 'this login opens'],
  ['curators & shops: open a shop', cl('/systems/shops'), ['Sample Bakery Co.'], 'Featured In The Directory'],
  ['curators & shops: products', cl('/systems/shops'), ['Sample Bakery Co.'], 'Lemon Pound Cake'],
  ['mentorship: curriculum & videos tab', cl('/systems/academy?tab=curriculum'), [], 'Add module'],
  ['mentorship: new lesson has a video upload', cl('/systems/academy?tab=curriculum'), ['Add lesson'], 'Or upload the video file'],
  ['mentorship: sessions & recordings tab', cl('/systems/academy?tab=sessions'), [], 'Schedule a session'],
  ['mentor console: curriculum video upload', cl('/academy/business/teach/curriculum'), ['Add lesson'], 'Or upload the video file'],
  ['walkthroughs hub', cl('/systems/walkthroughs'), [], 'Systems at a glance'],
  ['walkthroughs: play a chapter', cl('/systems/walkthroughs'), ['Play'], '1 OF 7'],
  ['walkthroughs: step by step', cl('/systems/walkthroughs'), ['Step by step', 'Next'], '2 OF 7'],
  ['walkthroughs: a link starts a chapter', cl('/systems/shops?tour=sys:shops'), [], 'Every shop on the marketplace'],
  ['walkthroughs: test runs', cl('/systems/walkthroughs?tab=tests'), [], 'Assign a dashboard and sign in as that person'],
  ['walkthroughs: test run steps', cl('/systems/walkthroughs?tab=tests'), ['Storefront agreement'], 'Agreements lists it'],
  ['today walkthrough', cl('/today?tour=today'), [], 'Today: your home'],
  ['mentor console walkthrough', cl('/academy/business/teach?tour=mentor-business'), [], 'The Business Mentorship console'],
  ['gathering walkthrough', cl('/gather/the-gathering?tour=gather'), [], 'Welcome to The Gathering'],
  ['studio email walkthrough', cl('/studio/email?tour=studio-email'), [], 'The shared inboxes'],
  ['portal: team sign-up wording', at('collective', 'off')('/portal'), [], 'On the P31 team? Create an account'],
  ['market sign-in: team link', mk('/login'), [], 'On the P31 team?'],
  ['about: headshots with names', mk('/about'), [], 'Shanay Prince'],
  ['team & dashboards on a phone', cl('/systems/team'), [], 'Savannah Campbell', { phone: true }],
  ['curators & shops on a phone', cl('/systems/shops'), ['Sample Bakery Co.'], 'Featured In The Directory', { phone: true }],
  // Operations (v42)
  ['health: database updates', cl('/systems/health'), [], 'Every script the site needs is in the database'],
  ['health: the watchdog', cl('/systems/health'), [], 'Run checks now'],
  ['vendor pages: vend at a market', mk('/apply'), [], 'Open a virtual storefront'],
  ['vendor pages: virtual storefront', mk('/storefront'), [], 'Vend at a P31 Market'],
  ['activity log', cl('/systems/activity'), [], 'Melanie JC changed shop'],
  ['activity log: one area', cl('/systems/activity'), ['Events'], 'Business and Leadership Luncheon'],
  ['settings: automatic emails', cl('/systems/settings'), [], 'Class reminders'],
  ['curators & shops: storefront billing', cl('/systems/shops'), [], 'Storefront billing'],
  ['curators & shops: billing terms', cl('/systems/shops'), ['Terms'], 'Save terms'],
  ['curators & shops: one shop’s plan', cl('/systems/shops'), ['Sample Bakery Co.'], 'Extend 30 Days'],
  ['curator: plan & billing', at('market', 'curator')('/dashboard/billing'), [], 'Set up my subscription'],
  ['curator: free period banner', at('market', 'curator')('/dashboard/identity'), [], 'left in your free period'],
  ['overview: ticket sales', cl('/systems'), [], 'tickets sold of 150'],
  ['markets & events: ticket sales', cl('/systems/events'), [], 'VIP table seat'],
  ['today: ticket sales', cl('/today'), [], 'tickets sold of 150'],
  ['gathering: @mention highlighted', cl('/gather/the-gathering'), [], '@Sample Curator'],
  ['gathering: search mentions of me', cl('/gather/the-gathering'), ['Search messages', 'Mentions of me'], '#The Gathering ·'],
  ['walkthroughs: activity chapter', cl('/systems/activity?tour=sys:activity'), [], 'Who changed what'],
  ['walkthroughs: billing test run', cl('/systems/walkthroughs?tab=tests'), [], 'A storefront free period and subscription'],
  // The P31 Podcast band on both home pages
  ['market home: podcast', mk('/'), [], 'Step into the'],
  ['collective home: podcast', cl('/'), [], 'Step into the'],
  ['collective home: podcast on a phone', cl('/'), [], 'Step into the', { phone: true }],
  // Signed in on the Collective: the account menu with Sign out
  ['collective header: account menu and sign out', cl('/'), ['Account menu'], 'Sign out'],
  ['collective header: team links in the menu', cl('/academy'), ['Account menu'], 'Today'],
  // Full admin control (v43): edit and delete in every room
  ['studio calendar: edit, duplicate, post now, delete', cl('/studio/calendar'), [], 'Post now'],
  ['studio calendar: the full post editor', cl('/studio/calendar'), ['Edit'], 'Post it now'],
  ['studio calendar: studio history actions', cl('/studio/calendar'), ['Studio history'], 'Duplicate'],
  ['studio email: delete a conversation', cl('/studio/email'), ['Sample Applicant'], 'Delete conversation'],
  ['join applications: edit and delete', cl('/systems/applications'), ['Jordan Ellis'], 'Edit details'],
  ['vendor applications: edit and delete', cl('/systems/vendors'), ['All', 'Sample Crafts'], 'Edit details'],
  ['vendor forms: delete an agreement', cl('/systems/forms'), ['Sample Candle Co.'], 'Delete'],
  ['vendor forms: edit a registration', cl('/systems/forms?tab=registrations'), ['Sample Candle Co.'], 'Edit details'],
  ['vendor forms: edit a volunteer', cl('/systems/forms?tab=volunteers'), ['Sample Volunteer'], 'Edit details'],
  ['orders: delete an order', cl('/systems/orders'), ['All'], 'Delete order'],
  ['people: delete a contact', cl('/systems/crm'), ['Danielle Brooks'], 'Delete'],
  ['markets & events: delete a market', cl('/systems/events'), ['Edit'], 'Delete market'],
  ['curators & shops: edit and delete products', cl('/systems/shops'), ['Sample Bakery Co.'], 'Delete product'],
  ['curators & shops: delete a shop (admins)', cl('/systems/shops'), ['Sample Bakery Co.'], 'Delete shop'],
  ['campaigns: subscribers', cl('/systems/campaigns'), [], 'Everyone on the newsletter list'],
  ['growth: delete a saved prospect', cl('/systems/growth'), ['Prospects'], 'Delete'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (page, text) => page.evaluate((t) => {
  const els = [...document.querySelectorAll('button, a, [role="tab"], [role="button"], summary')].filter((e) => e.offsetParent);
  const el = els.find((e) => e.textContent.trim() === t) || els.find((e) => e.getAttribute('aria-label') === t) || els.find((e) => e.textContent.trim().startsWith(t)) || els.find((e) => e.textContent.includes(t));
  if (!el) return false;
  el.click();
  return true;
}, text);

// Wait (up to ~5 s) for the page to show real text, then return it.
const settle = async (page) => {
  let text = '';
  for (let i = 0; i < 12; i++) {
    text = await page.evaluate(() => document.body.innerText);
    if (text.trim().length >= 40) break;
    await sleep(400);
  }
  return text;
};

if (!CHROME) { console.error('screen-test: Chrome not found (set CHROME_PATH)'); process.exit(1); }
// P31_ONLY="team|shops" runs just the screens whose names match (for a quick check while building).
const only = process.env.P31_ONLY ? new RegExp(process.env.P31_ONLY, 'i') : null;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const failures = [];
let n = 0;
for (const [name, url, clicks = [], expect, opts = {}] of SCREENS.filter((s) => !only || only.test(s[0]))) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    // A 5th element { phone: true } runs the screen at iPhone size.
    await page.setViewport(opts.phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('p31_subscribed', '1'); } catch { /* ignore */ } });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await sleep(2000); // walkthroughs open on their own after ~1 s
    await settle(page);
    for (const c of clicks) {
      // The dev server compiles a page's code on first visit, so a button can take a moment to appear.
      let hit = false;
      for (let i = 0; i < 10 && !hit; i++) { hit = await clickText(page, c); if (!hit) await sleep(400); }
      if (!hit) failures.push(`${name}: no "${c}" button`);
      await sleep(700);
    }
    const text = await settle(page);
    if (/Something went wrong/.test(text)) failures.push(`${name}: error screen: ${text.match(/team:\s*([^\n]+)/)?.[1] || ''}`);
    else if (text.trim().length < 40) failures.push(`${name}: blank page`);
    else if (expect && !text.includes(expect)) failures.push(`${name}: missing "${expect}"`);
    if (errors.length) failures.push(`${name}: page error: ${errors[0]}`);
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
  await page.close();
  n += 1;
}
await browser.close();
if (failures.length) {
  console.error(`screen-test: ${failures.length} problem(s) in ${n} screens\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`screen-test: ${n} screens, no crashes, errors or missing buttons`);
