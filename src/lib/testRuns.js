// Test runs: short scripts that prove each function works on the live sites. Shown in
// Systems → Walkthroughs (with a checklist) and written to docs/TEST-WALKTHROUGHS.md by
// scripts/test-walkthroughs.mjs. Plain data only: this file is read by Node too.
//
//   who: visitor | vendor | student | team | admin     site: market | collective | both
//   tour: a walkthrough chapter that shows the screen (optional)

export const TEST_RUNS = [
  {
    id: 'vendor-apply', title: 'Vendor application', site: 'market', who: 'visitor', minutes: 4, tour: 'sys:vendors',
    steps: [
      'Open p31market.com/apply in a private window.',
      'Fill in every field with TEST in the business name (for example “TEST Candle Co.”) and a real email you can read.',
      'Tap the agreement box and submit.',
    ],
    expect: [
      'A thank-you screen appears at once.',
      'Within a minute the market team mailbox (vendor@p31market.com) gets “New vendor application: TEST Candle Co.”.',
      'In Systems → Vendor applications the application is listed as New; Today and the morning email count it.',
    ],
    cleanup: 'Decline it in Systems → Vendor applications (choose not to send the email), or leave it as a sample.',
  },
  {
    id: 'storefront-agreement', title: 'Storefront agreement', site: 'market', who: 'visitor', minutes: 4, tour: 'sys:forms',
    steps: [
      'Open p31market.com/vendors/agreement.',
      'Fill in the business and contact (TEST in the name), tick “I agree”, sign with your mouse or finger, and submit.',
    ],
    expect: [
      'A confirmation screen; the signer gets her copy by email with the terms.',
      'The team gets “Storefront agreement signed: TEST…”.',
      'Systems → Vendor forms → Agreements lists it, with “Pre-approve & email the account link”.',
    ],
    cleanup: 'Leave it, or remove the row from Systems → Vendor forms.',
  },
  {
    id: 'market-registration', title: 'Market registration into a lineup', site: 'market', who: 'admin', minutes: 5, tour: 'sys:forms',
    steps: [
      'Open p31market.com/vendors/register, pick a market, fill in TEST details, upload any small logo, sign and submit.',
      'In Systems → Vendor forms → Registrations open the TEST registration and tap “Add to lineup”.',
      'Open Systems → Markets & events → that market → Lineup.',
    ],
    expect: [
      'The registrant gets “We received your registration”; the team gets the registration email.',
      'The lineup now lists TEST with her logo; the market page on p31market.com/calendar shows her in the lineup when it is public.',
    ],
    cleanup: 'Remove TEST from the lineup in Markets & events.',
  },
  {
    id: 'feedback-survey', title: 'Feedback survey and the next-market invite', site: 'market', who: 'admin', minutes: 5, tour: 'sys:events',
    steps: [
      'Open p31market.com/vendors/feedback, rate the market, choose “I’m in for the next market!”, enter an email, submit.',
      'In Systems → Markets & events create a market with Has vendors on and Date public on (a TEST date).',
    ],
    expect: [
      'Systems → Vendor forms → Feedback shows the survey.',
      'The new market’s lineup contains the surveyed business as Invited, and she gets the invitation email with the registration link.',
    ],
    cleanup: 'Delete the TEST market (its lineup goes with it).',
  },
  {
    id: 'volunteer', title: 'Volunteer acknowledgment', site: 'market', who: 'visitor', minutes: 3,
    steps: ['Open p31market.com/volunteer, fill it in with TEST, sign, submit.'],
    expect: ['A thank-you screen; outreach@p31market.com gets the acknowledgment and the volunteer gets a copy.', 'Systems → Vendor forms → Volunteers lists it with the emergency contact.'],
    cleanup: 'Leave it, or remove the row from Vendor forms.',
  },
  {
    id: 'newsletter-popup', title: 'Marketplace pop-up (Follow the P31 Movement)', site: 'market', who: 'visitor', minutes: 2,
    steps: ['Open p31market.com in a private window; wait for the pop-up or tap “Subscribe to our newsletter” in the footer.', 'Enter a first name and a real email, subscribe.'],
    expect: ['“You’re subscribed” shows; the email is in Systems → People as a subscriber.', 'The pop-up does not return on that device.'],
    cleanup: 'Unsubscribe from the link in any campaign, or leave it.',
  },
  {
    id: 'join-collective', title: 'Join P31 Collective application', site: 'collective', who: 'visitor', minutes: 4, tour: 'sys:applications',
    steps: ['Open thep31collective.org/join, fill it in (TEST in the name), agree and submit.'],
    expect: ['A thank-you screen.', 'members@thep31collective.org gets “New P31 Collective application: TEST…” and the row lands in the Google Sheet when it is connected.', 'Systems → Join applications and Today show it as New.'],
    cleanup: 'Mark it reviewed, or delete the row from Join applications.',
  },
  {
    id: 'intro-call', title: 'Mentorship intro call request', site: 'collective', who: 'visitor', minutes: 3, tour: 'sys:academy',
    steps: ['Open thep31collective.org/mentorship/business and request an intro call with TEST details.'],
    expect: ['Systems → Mentorship → Intro calls lists it as New; the mentor console shows it under Intro calls and on Today.'],
    cleanup: 'Set its status to Closed.',
  },
  {
    id: 'team-dashboards', title: 'Assign a dashboard and sign in as that person', site: 'both', who: 'admin', minutes: 6, tour: 'sys:team',
    steps: [
      'In Systems → Team & dashboards, on a team member’s login switch on one dashboard only (for example Orders).',
      'Tap “Sign-up steps” and send them to her, or follow them yourself with that mailbox: create the account at thep31collective.org/portal, confirm the email, sign in.',
      'Open thep31collective.org/systems as her.',
    ],
    expect: [
      'She lands on My dashboards with that one dashboard; the menu shows only Orders and Walkthroughs; typing /systems/vendors in the address bar sends her back to My dashboards.',
      'Today shows only the cards for her dashboard. The Gathering lists her with her role badge (Executive Assistant, Marketing Strategist…).',
      'Switching the dashboard off in Team & dashboards removes it the next time she opens Systems.',
    ],
    cleanup: 'Set her dashboards back to the ones she should have.',
  },
  {
    id: 'shop-controls', title: 'Pause, feature and note a shop', site: 'market', who: 'admin', minutes: 4, tour: 'sys:shops',
    steps: [
      'In Systems → Curators & shops open a shop and set its status to Paused.',
      'Open p31market.com/directory and the shop’s own link in a private window.',
      'Set it back to Approved, switch Featured on, add a badge (Handmade) and a note, save.',
      'Hide one product with the eye button, then show it again.',
    ],
    expect: [
      'While paused the shop is missing from the directory and its link shows the shop as unavailable; the vendor still opens her studio and sees your note.',
      'Featured puts it at the top of the directory; the badge shows on the shop; the product disappears and returns on the storefront.',
    ],
    cleanup: 'Leave the shop Approved and remove any test badge or note.',
  },
  {
    id: 'lesson-video', title: 'Lesson with an uploaded video', site: 'collective', who: 'admin', minutes: 5, tour: 'sys:academy',
    steps: [
      'In Systems → Mentorship → Curriculum & videos, pick a program, add a module “TEST module”, then a lesson with a short MP4 uploaded, and tick Published.',
      'Open the student classroom (Mentor console → Student view, or sign in as a student) → Lessons → the new lesson.',
    ],
    expect: ['The lesson lists “Video”; opening it plays the uploaded file in the page.', 'Unpublishing hides it from students at once.'],
    cleanup: 'Delete the TEST module (its lessons and the video go with it).',
  },
  {
    id: 'session-recording', title: 'Schedule a session and attach the recording', site: 'collective', who: 'admin', minutes: 5, tour: 'sys:academy',
    steps: [
      'In Systems → Mentorship → Sessions & recordings schedule a TEST group session (paste a link).',
      'After its time, open it and upload a recording file, save.',
      'Check the student’s Sessions page.',
    ],
    expect: ['Students see the session with “Add to calendar”; afterwards “Watch the recording” opens the uploaded file.'],
    cleanup: 'Delete the TEST session.',
  },
  {
    id: 'order-flow', title: 'An order from a shop to Systems', site: 'market', who: 'vendor', minutes: 6, tour: 'sys:orders',
    steps: [
      'From a test shop’s storefront, order a product as a shopper (a request order, or a card payment in test mode).',
      'Open Systems → Orders.',
      'Confirm the order, then mark it fulfilled.',
    ],
    expect: ['The order appears as New with the buyer and product; the vendor sees it in her studio.', 'Each status change shows in both places; the buyer gets the status emails.'],
    cleanup: 'Cancel the test order.',
  },
  {
    id: 'email-inbox', title: 'A reply from the shared inbox', site: 'collective', who: 'team', minutes: 3, tour: 'studio-email',
    steps: ['Send a short email to members@thep31collective.org from a personal address.', 'Open Content Studio → Email, open the thread, review the drafted reply, edit a word, Send reply, confirm.'],
    expect: ['The thread shows a drafted reply within a minute of arrival.', 'Your personal address receives the reply from members@.'],
    cleanup: 'None.',
  },
  {
    id: 'schedule-post', title: 'Schedule a post', site: 'collective', who: 'team', minutes: 4, tour: 'studio',
    steps: ['In Content Studio → Create post, write a caption, add a photo, pick a time later today, choose Instagram and Facebook, schedule.', 'Open Systems → Social.'],
    expect: ['The post is listed as scheduled in Social and on the Studio calendar; it publishes at the time chosen.'],
    cleanup: 'Cancel the scheduled post before it goes out if it was only a test.',
  },
  {
    id: 'campaign', title: 'Send a campaign test', site: 'market', who: 'admin', minutes: 3, tour: 'sys:campaigns',
    steps: ['In Systems → Campaigns start a campaign, write a subject and body (or draft one), and use “Send me a test”.'],
    expect: ['Your admin mailbox receives the test with the P31 template and an unsubscribe link.'],
    cleanup: 'Leave it as a draft, or delete it.',
  },
  {
    id: 'gathering', title: 'The Gathering: post, thread, direct message, alert', site: 'both', who: 'team', minutes: 5, tour: 'gather',
    steps: [
      'Open The Gathering, post in The Gathering channel, react to a message, reply in its thread, attach a photo.',
      'Open Members, pick someone, Message, send her a direct message, then close the tab without her reading it.',
    ],
    expect: [
      'Everything appears for other members without a refresh.',
      'If she does not read the DM within a few minutes she gets one email with the message and a link back; with The Gathering open she gets a device notification instead.',
    ],
    cleanup: 'Delete the test messages (the ⋯ menu on your own message).',
  },
  {
    id: 'walkthroughs', title: 'Walkthroughs play on every dashboard', site: 'both', who: 'team', minutes: 3, tour: 'sys:walkthroughs',
    steps: ['In Systems → Walkthroughs press Play on “Systems at a glance”; let it run, then open one from Other dashboards (Content Studio).'],
    expect: ['The pointer glides to each item and taps it, the card explains it, and the progress bar advances by itself; hovering the card pauses it.', 'Content Studio opens with its own walkthrough running.'],
    cleanup: 'None.',
  },
  {
    id: 'links-forms-scan', title: 'Automated screen, link and form check', site: 'both', who: 'admin', minutes: 2,
    steps: ['On the computer with the project: `npm run dev` in one terminal, then `node scripts/screen-test.mjs` and `node scripts/link-test.mjs` in another.'],
    expect: ['screen-test reports every screen opened with no crashes or missing buttons; link-test reports no broken internal links or images across both sites.'],
    cleanup: 'None (the tests use sample data, never the live database).',
  },
];

export const WHO = { visitor: 'As a visitor', vendor: 'As a vendor', student: 'As a student', team: 'As a team member', admin: 'As an admin' };
