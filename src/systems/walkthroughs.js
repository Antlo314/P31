// Every walkthrough chapter, in one place. Systems chapters play inside the console
// (SystemsTour.jsx); the others open the dashboard they describe with ?tour=<id>, which starts
// that dashboard's own walkthrough. The Walkthroughs page lists them all; a chapter's `dash`
// is the dashboard it belongs to ('admin' = admins only, 'team' = everyone on the team).

const nav = (to) => [`.sys-side__link[href="${to}"]`, `.sys-tabbar__link[href="${to}"]`, `.sys-more__link[href="${to}"]`];
const head = ['.sys-page__head'];
const card = (n = 1) => [`.sys-page > .sys-card:nth-of-type(${n})`, '.sys-page .sys-card'];
const tour = (name) => [`[data-tour="${name}"]`];

const intro = (title, body) => ({ title, body });

export const SYSTEMS_CHAPTERS = {
  'sys:overview': {
    title: 'Systems at a glance', group: 'Start here', site: 'both', minutes: 2, dash: 'team',
    steps: [
      intro('Welcome to Systems', 'The console behind both sites. This two-minute walkthrough shows how it is laid out. Use Next, the arrow keys, or press play to let it run.'),
      { to: '/systems', targets: ['.sys-side__nav', '.sys-tabbar'], title: 'One menu, sorted by site', body: 'Market rooms run p31market.com (orders, vendors, forms, markets, shops, campaigns). Collective rooms run thep31collective.org (applications, mentorship, people, Content Studio, email, The Gathering). Create and Team serve both.' },
      { to: '/systems', targets: ['.sys-needs', '.sys-stats'], title: 'What needs you, first', body: 'The chips at the top count everything waiting: orders, applications, agreements, registrations, emails. Tap one to jump straight there.' },
      { to: '/systems', targets: ['.sys-sitesec--market'], title: 'The Market, in numbers', body: 'Open orders, what was paid this month, shops live and the next market with its lineup, then the cards that need a hand.' },
      { to: '/systems', targets: ['.sys-sitesec--collective'], title: 'The Collective, in numbers', body: 'New join applications, active students, emails waiting and posts scheduled, with the Collective rooms underneath.' },
      { to: '/systems', targets: ['.sys-crumb'], title: 'Where you are', body: 'The crumb line always names the site and the room you are in. Phones get the same rooms in the bottom bar and the More sheet.' },
      { to: '/systems', targets: ['.sys-side__actions', '.sys-side__me'], title: 'Today and sign out', body: 'The sun opens Today, the team home that gathers every dashboard you run. Replay any walkthrough from Team → Walkthroughs.' },
    ],
  },
  'sys:orders': {
    title: 'Orders', group: 'Market', site: 'market', minutes: 2, dash: 'orders',
    steps: [
      { to: '/systems/orders', targets: nav('/systems/orders'), title: 'Every order, live', body: 'Orders from every shop on p31market.com arrive here as they happen, newest first.' },
      { to: '/systems/orders', targets: head, title: 'Filter and search', body: 'Switch between new, confirmed, fulfilled and cancelled, or search by product, buyer or shop.' },
      { to: '/systems/orders', targets: card(1), title: 'Confirm, fulfil, cancel', body: 'Open an order to see the buyer, the product, payment and fulfilment (pickup or shipping). Move it along with one tap; the vendor sees the same status in her studio.' },
      { to: '/systems/orders', targets: head, title: 'Export', body: 'Export the list for bookkeeping or a market-day pickup sheet.' },
    ],
  },
  'sys:vendors': {
    title: 'Vendor applications', group: 'Market', site: 'market', minutes: 3, dash: 'vendors',
    steps: [
      { to: '/systems/vendors', targets: nav('/systems/vendors'), title: 'Applications from p31market.com/apply', body: 'Every vendor application lands here with everything she entered: business, categories, socials, referral and notes.' },
      { to: '/systems/vendors', targets: ['.sys-chips', ...head], title: 'New, approved, declined', body: 'Filter by status. New applications also show on Today and in the morning email.' },
      { to: '/systems/vendors', targets: card(1), title: 'Approve into a market', body: 'Open an application and approve it. Choose a market while approving and she is placed in that lineup; her welcome email names the market and walks her through confirming, registering, creating her account and signing the storefront agreement.' },
      { to: '/systems/vendors', targets: card(1), title: 'Decline kindly', body: 'Declining sends a warm email you can edit first. Nothing goes out until you confirm.' },
    ],
  },
  'sys:forms': {
    title: 'Vendor forms', group: 'Market', site: 'market', minutes: 3, dash: 'vendors',
    steps: [
      { to: '/systems/forms', targets: nav('/systems/forms'), title: 'The forms vendors sign on the site', body: 'Storefront agreements, market registrations, feedback surveys and volunteer sign-ups, each signed on p31market.com and emailed to the team the moment it arrives.' },
      { to: '/systems/forms?tab=agreements', targets: ['.sys-chips'], title: 'Agreements', body: 'Each signed agreement shows the business, contact and signature date. Pre-approve and email her the link to create her account, or link an existing curator.' },
      { to: '/systems/forms?tab=registrations', targets: ['.sys-chips'], title: 'Registrations', body: 'Registrations for a market: confirm one and add her to that market’s lineup in one step.' },
      { to: '/systems/forms?tab=feedback', targets: ['.sys-chips'], title: 'Feedback surveys', body: 'How each market went, vendor by vendor. Anyone who said “I’m in for the next market” can be invited into the next lineup, and is, automatically, when a market announces its date.' },
      { to: '/systems/forms?tab=volunteers', targets: ['.sys-chips'], title: 'Volunteers', body: 'Signed day-of-event acknowledgments with emergency contacts, ready for the run sheet.' },
    ],
  },
  'sys:events': {
    title: 'Markets & events', group: 'Market', site: 'market', minutes: 3, dash: 'events',
    steps: [
      { to: '/systems/events', targets: nav('/systems/events'), title: 'Every market and event', body: 'Dates, venues, tickets, RSVPs and vendor lineups, upcoming first.' },
      { to: '/systems/events', targets: card(1), title: 'Add or edit a date', body: 'Title, date, venue, start time, capacity and the ticket link. “Month public” shows “December · date coming soon” on the site until the day is set; “Date public” announces it.' },
      { to: '/systems/events', targets: card(1), title: 'Has vendors, and load-in', body: 'Switch “Has vendors” off for events without booths (the luncheon). For markets, set the vendor check-in time; it goes into confirmation emails and the vendor’s studio.' },
      { to: '/systems/events', targets: card(1), title: 'Lineup, booths and check-in', body: 'Open the lineup to see every vendor, assign booths, mark paid, and check vendors in on the day. Announcing a date invites last market’s “I’m in” vendors automatically.' },
    ],
  },
  'sys:shops': {
    title: 'Curators & shops', group: 'Market', site: 'market', minutes: 3, dash: 'shops',
    steps: [
      { to: '/systems/shops', targets: nav('/systems/shops'), title: 'Every shop on the marketplace', body: 'All curators, with status, products, orders and when they joined. Search by shop, owner or email.' },
      { to: '/systems/shops', targets: tour('shops-filters'), title: 'Pending, approved, paused', body: 'New shops wait as pending until approved. Pausing hides a shop from the site without touching her products; approving again brings it back.' },
      { to: '/systems/shops', targets: tour('shops-list'), title: 'Open a shop', body: 'Tap a row to open it: status, switches, details, the agreement, payouts and every product.' },
      { to: '/systems/shops', targets: ['[data-tour="shops-detail"]', '[data-tour="shops-list"]'], title: 'Feature, badges and a note', body: 'Feature a curator at the top of the directory, give badges like Handmade or Organic, and leave her a note she sees in her studio. Products can be hidden or featured one by one.' },
      { to: '/systems/shops', targets: ['[data-tour="shops-detail"]', '[data-tour="shops-list"]'], title: 'Open the shop, or message her', body: '“Open shop” shows the live storefront; “Message” starts a private conversation in The Gathering.' },
    ],
  },
  'sys:campaigns': {
    title: 'Campaigns', group: 'Market', site: 'market', minutes: 2, dash: 'emails',
    steps: [
      { to: '/systems/campaigns', targets: nav('/systems/campaigns'), title: 'Email shoppers and curators', body: 'One email to the people who follow P31, with a drafted subject and body you can edit.' },
      { to: '/systems/campaigns', targets: card(1), title: 'Audience, draft, send', body: 'Pick the audience (subscribers, curators, members), write or ask for a draft, send yourself a test, then send. Sent campaigns stay listed with their counts.' },
    ],
  },
  'sys:applications': {
    title: 'Join applications', group: 'Collective', site: 'collective', minutes: 2, dash: 'people',
    steps: [
      { to: '/systems/applications', targets: nav('/systems/applications'), title: 'Join P31 Collective', body: 'Membership applications from thep31collective.org/join, with everything she wrote.' },
      { to: '/systems/applications', targets: card(1), title: 'Review and reply', body: 'Open one, mark it reviewed or welcomed, and reply from the shared inbox. She becomes a person in People with her history.' },
    ],
  },
  'sys:academy': {
    title: 'Mentorship: prices, curriculum, videos, sessions', group: 'Collective', site: 'collective', minutes: 4, dash: 'classroom',
    steps: [
      { to: '/systems/academy', targets: nav('/systems/academy'), title: 'The mentorships', body: 'Business and Faith-Based Mentorship: their private prices, mentors, members, Studio seats and intro calls, and now each program’s curriculum, videos and sessions.' },
      { to: '/systems/academy', targets: tour('tab-plans'), title: 'Plans and prices', body: 'Prices are never public. A plan with a price is offered on the private enrollment link a mentor sends after an intro call.' },
      { to: '/systems/academy', targets: tour('tab-curriculum'), act: 'click', title: 'Curriculum & videos', body: 'Build modules and lessons for a program. Each lesson can carry a video link (YouTube, Vimeo, Loom) or an uploaded video file that students stream inside the lesson. Publish when ready.' },
      { to: '/systems/academy', targets: tour('academy-editor'), title: 'Modules, lessons, downloads', body: 'Add a module, add lessons under it, reorder, publish or unpublish, and attach worksheets and slides to the library.' },
      { to: '/systems/academy', targets: tour('tab-sessions'), act: 'click', title: 'Sessions & recordings', body: 'Schedule group sessions (live room, Zoom or a pasted link), add notes afterwards, and attach the recording as a link or an uploaded file.' },
      { to: '/systems/academy', targets: tour('tab-mentors'), act: 'click', title: 'Mentors and members', body: 'Add a mentor by email, enroll someone manually, end access, and see every intro-call request. Anyone with the Classroom dashboard is a mentor of every program.' },
    ],
  },
  'sys:crm': {
    title: 'People', group: 'Collective', site: 'collective', minutes: 2, dash: 'people',
    steps: [
      { to: '/systems/crm', targets: nav('/systems/crm'), title: 'Everyone who has reached P31', body: 'From a first form to alumni: subscribers, applicants, vendors, students, with every touch in one timeline.' },
      { to: '/systems/crm', targets: card(1), title: 'Open a person', body: 'Search, open a person, and see her forms, calls, enrollments, sessions and emails in order. Add a note or follow-up.' },
    ],
  },
  'sys:social': {
    title: 'Social', group: 'Create', site: 'both', minutes: 2, dash: 'social',
    steps: [
      { to: '/systems/social', targets: nav('/systems/social'), title: 'Posts across every platform', body: 'Drafts, scheduled posts and history for Instagram and Facebook, both accounts, in one list.' },
      { to: '/systems/social', targets: card(1), title: 'Schedule, edit, reschedule', body: 'Open a post to edit it, move its time, or cancel it. New posts are written in Content Studio, where the planner and auto-create live.' },
    ],
  },
  'sys:growth': {
    title: 'Growth', group: 'Create', site: 'both', minutes: 2, dash: 'social',
    steps: [
      { to: '/systems/growth', targets: nav('/systems/growth'), title: 'Find the people who fit P31', body: 'Search groups, creators and events that match P31’s audience, and keep the outreach in one place.' },
      { to: '/systems/growth', targets: card(1), title: 'Track each prospect', body: 'Save a prospect, note what was sent, and move it along from found to contacted to joined.' },
    ],
  },
  'sys:photos': {
    title: 'Photo Studio', group: 'Create', site: 'both', minutes: 2, dash: 'studio',
    steps: [
      { to: '/systems/photos', targets: nav('/systems/photos'), title: 'Product photos, made presentable', body: 'Remove a background, stage a product on a clean scene, and apply a look. Works on a phone.' },
      { to: '/systems/photos', targets: card(1), title: 'Upload, pick a look, download', body: 'Drop in a photo, choose the scene or look, and download the result for a post or a shop listing.' },
    ],
  },
  'sys:clips': {
    title: 'Clip Studio', group: 'Create', site: 'both', minutes: 2, dash: 'studio',
    steps: [
      { to: '/systems/clips', targets: nav('/systems/clips'), title: 'Raw footage in, a captioned reel out', body: 'Trim, caption and brand a clip for Instagram or Facebook. It edits video on the device, so it needs a computer.' },
      { to: '/systems/clips', targets: card(1), title: 'Trim, caption, export', body: 'Pick the footage, set the in and out points, add captions and the P31 look, then export and schedule it from Content Studio.' },
    ],
  },
  'sys:davinci': {
    title: 'DaVinci', group: 'Create', site: 'both', minutes: 1, dash: 'davinci',
    steps: [
      { to: '/systems/pro-edit', targets: nav('/systems/pro-edit'), title: 'Long footage, finished clips', body: 'Send long footage to Iris in DaVinci Resolve and get finished clips back, each with its own look and music. Paused for now; access is kept for when it returns.' },
    ],
  },
  'sys:team': {
    title: 'Team & dashboards', group: 'Team', site: 'both', minutes: 3, dash: 'admin',
    steps: [
      { to: '/systems/team', targets: nav('/systems/team'), title: 'Who runs what', body: 'Every team member with her mailboxes. Each mailbox is its own login, and each login opens exactly the dashboards you switch on.' },
      { to: '/systems/team', targets: tour('team-people'), title: 'The team, login by login', body: 'A card per person from the directory: her photo, role and each mailbox with whether she has made her account yet. @p31market.com logins belong to the Market side, @thep31collective.org to the Collective.' },
      { to: '/systems/team', targets: tour('team-dashboards'), title: 'Switch dashboards on and off', body: 'Content creator, Social media manager, Emails, Classroom, People, Vendors, Events, Orders, Shops, DaVinci. Tap a chip to give or take a dashboard; it applies the next time she opens Systems.' },
      { to: '/systems/team', targets: tour('team-people'), title: 'Sign-up steps', body: '“Sign-up steps” copies a short message for her: where to create the account, which email to use, and which dashboards she will find. Access starts once she confirms that email.' },
      { to: '/systems/team', targets: tour('team-add'), title: 'Add a login', body: 'Pick a name from the directory or type a new one, enter the mailbox and role, and choose dashboards; suggestions appear from the role and the mailbox.' },
      { to: '/systems/team', targets: tour('team-admins'), title: 'Site admins', body: 'Admins open everything and can change this page. Melanie JC is an admin on both of her mailboxes; add or remove others here. The site always keeps at least one.' },
    ],
  },
  'sys:health': {
    title: 'Health', group: 'Team', site: 'both', minutes: 1, dash: 'admin',
    steps: [
      { to: '/systems/health', targets: nav('/systems/health'), title: 'Errors visitors hit', body: 'Anything that breaks on either site shows here as it happens, with the page and how often. Mark it resolved once fixed.' },
    ],
  },
  'sys:settings': {
    title: 'Settings', group: 'Team', site: 'both', minutes: 1, dash: 'admin',
    steps: [
      { to: '/systems/settings', targets: nav('/systems/settings'), title: 'Your password and connected services', body: 'Change your Systems password, see the team, and check the services the sites talk to.' },
    ],
  },
  'sys:walkthroughs': {
    title: 'Walkthroughs and test runs', group: 'Team', site: 'both', minutes: 1, dash: 'team',
    steps: [
      { to: '/systems/walkthroughs', targets: nav('/systems/walkthroughs'), title: 'Learn any function in a minute', body: 'Every dashboard has an animated walkthrough. Press play to watch it run, or step through at your own pace.' },
      { to: '/systems/walkthroughs', targets: tour('wk-tabs'), title: 'Test runs', body: 'Each test run is a short script: what to do, what should happen, and how to clean up. Tick steps as you go; the checklist is kept on this device, and the page prints as a test sheet.' },
    ],
  },
};

/** Chapters that open another dashboard with its own walkthrough. */
export const OTHER_CHAPTERS = [
  { id: 'today', title: 'Today: the team home', group: 'Start here', site: 'both', minutes: 1, dash: 'team', href: '/today?tour=today', blurb: 'What needs you across every dashboard you run, the Daily Word, and quick actions.' },
  { id: 'studio', title: 'Content Studio', group: 'Other dashboards', site: 'collective', minutes: 3, dash: 'studio', href: '/studio?tour=studio', blurb: 'Plan the month, auto-create, write and schedule posts, answer DMs and comments.' },
  { id: 'studio-email', title: 'Email inbox', group: 'Other dashboards', site: 'collective', minutes: 2, dash: 'emails', href: '/studio/email?tour=studio-email', blurb: 'members@ and vendor@, with drafted replies you approve and send.' },
  { id: 'mentor-business', title: 'Mentor console: Business Mentorship', group: 'Other dashboards', site: 'collective', minutes: 3, dash: 'classroom', href: '/academy/business/teach?tour=mentor-business', blurb: 'Students, inbox, gradebook, assignments, quizzes, curriculum, sessions, intro calls, invites.' },
  { id: 'mentor-faith', title: 'Mentor console: Faith Mentorship', group: 'Other dashboards', site: 'collective', minutes: 3, dash: 'classroom', href: '/academy/faith/teach?tour=mentor-faith', blurb: 'The same console for the Faith-Based Mentorship.' },
  { id: 'classroom-business', title: 'A student’s classroom', group: 'Other dashboards', site: 'collective', minutes: 2, dash: 'classroom', href: '/academy/business?tour=classroom-business', blurb: 'What a student sees: lessons, assignments, sessions, the member line, progress.' },
  { id: 'gather', title: 'The Gathering', group: 'Other dashboards', site: 'both', minutes: 2, dash: 'team', href: '/gather/the-gathering?tour=gather', blurb: 'Channels by audience, the Daily Word, threads, reactions, members and direct messages.' },
  { id: 'curator-studio', title: 'Curator Studio: what a vendor sees', group: 'Other dashboards', site: 'market', minutes: 3, dash: 'shops', href: '/dashboard/identity?tour=curator-studio', blurb: 'The vendor’s own studio: shop setup, products, orders, marketing and the community.' },
];

export const CHAPTER_GROUPS = ['Start here', 'Market', 'Collective', 'Create', 'Team', 'Other dashboards'];
export const allChapters = () => [
  ...Object.entries(SYSTEMS_CHAPTERS).map(([id, c]) => ({ id, ...c, steps: c.steps })),
  ...OTHER_CHAPTERS,
];
