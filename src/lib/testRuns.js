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
      'Open p31market.com/storefront (the virtual storefront page; /vendors/agreement opens the same page).',
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
    id: 'edit-scheduled-post', title: 'Change a scheduled post completely', site: 'collective', who: 'team', minutes: 4, tour: 'studio',
    steps: [
      'Content Studio → Create post: schedule a TEST post for tomorrow with one photo, on Instagram and Facebook.',
      'Calendar → the TEST post → Edit. Swap the photo for another, change the caption, tick “Different caption for Facebook” and write one, change the time, Save changes.',
      'Back on the Calendar, press Duplicate on it, change the caption, and schedule the copy for the day after.',
      'Delete both TEST posts.',
    ],
    expect: [
      'The calendar shows the new photo, caption and time; Zernio shows the same post with the Facebook caption on Facebook only.',
      'The copy is a separate post; deleting removes each from the calendar and from Zernio, and nothing goes out.',
    ],
    cleanup: 'None, once both are deleted.',
  },
  {
    id: 'edit-delete-rooms', title: 'Edit and delete in every Systems room', site: 'both', who: 'admin', minutes: 6,
    steps: [
      'Submit a TEST vendor application and a TEST Join application (use your own email).',
      'In Systems → Vendor applications open the TEST one → Edit details, change the phone, Save. Then Delete.',
      'Do the same in Join applications, then in Vendor forms (an agreement, a registration, a volunteer), People (a TEST contact), and Campaigns → Subscribers (add, unsubscribe, delete a TEST address).',
      'In Curators & shops open a shop → Edit product on one product, change its price, Save; then change it back.',
      'Sign in as a team login that has only the Vendors dashboard and try the same in Vendor applications.',
    ],
    expect: [
      'Every change shows at once and appears in Systems → Activity; each Delete asks first and the row is gone after.',
      'The Vendors login can edit and delete in Vendor applications and Vendor forms, but rooms it does not have stay closed.',
      'If a change is refused, the room says so (“This login may not have that permission”) instead of looking saved.',
    ],
    cleanup: 'Delete the TEST rows (that is the test).',
  },
  {
    id: 'form-pdf-copies', title: 'Every form: CEO email and a PDF copy', site: 'both', who: 'visitor', minutes: 5,
    steps: [
      'Run the v43 database update and deploy join-notify (see the guide).',
      'Submit a TEST entry on each: p31market.com/apply, /vendors/agreement, /vendors/register, /vendors/feedback (with an email), /volunteer, thep31collective.org/join, and an intro-call request on thep31collective.org/mentorship.',
      'Check the inbox you used, and ceo@p31market.com.',
    ],
    expect: [
      'Within a minute each person gets a confirmation email with a PDF of exactly what they sent (signed forms include the drawn signature).',
      'ceo@p31market.com receives every team notification, with the same PDF attached; the usual team mailboxes still receive theirs.',
      'Each entry is in Systems (applications, vendor forms) or the mentor console (intro calls).',
    ],
    cleanup: 'Delete the TEST rows in Systems.',
  },
  {
    id: 'design-studio', title: 'Design a post, and a reel with music', site: 'both', who: 'team', minutes: 6, tour: 'studio',
    steps: [
      'Open Content Studio → Design. The Collection shows the 48 quote cards on the calendar; open one.',
      'Click the big words on the page and change them; drag them a little; open Styles and pick another colour style.',
      'Open Motion and try Editorial, Gentle and Word by word (each plays as you pick it). Put one word in *asterisks*, pick Marker in its settings, and play again.',
      'Open Music, play two tracks, pick one, then press Play at the top to watch and hear the reel.',
      'Download → Reel 9:16 with music, and Download → Image (PNG). Then Save.',
      'Use in a post → As a reel with music. On Create post, set a time a week out and schedule it, then delete it from the Calendar.',
    ],
    expect: [
      'The words, colours and position change on the page as you edit; Undo puts them back.',
      'The MP4 is 9:16: the topo lines draw themselves in, the words arrive the way the Motion choice says, the highlighted word gets its marker after it lands, the camera eases in, and the music sits underneath; the PNG matches the page.',
      'Saved lists the design (for the whole team once v44 has run; in this browser before that).',
      'Create post opens with the reel attached, its cover (the finished card) and the caption filled in; the scheduled post shows on the Calendar with that cover.',
      'Trending Instagram tracks list under Pick a trending track once the Instagram account is connected to Zernio through Facebook Login; before that the Studio says so.',
    ],
    cleanup: 'Delete the TEST post from the Calendar and the design from Saved.',
  },
  {
    id: 'watchdog', title: 'The watchdog catches a problem and clears it', site: 'both', who: 'admin', minutes: 3,
    steps: [
      'Open Systems → Health. The Watchdog panel at the top says when it last checked; press Run checks now.',
      'If something is listed, read its Fix line and open it. Try Snooze a day on one alert.',
      'Submit a TEST vendor application and, after a few minutes, run the checks again.',
    ],
    expect: [
      'The panel answers “Everything is running” or lists each problem with how to fix it, and Today shows the same in its System check card.',
      'A snoozed alert is greyed out and no longer emailed; it still clears itself once the check passes.',
      'A brand-new failure (for example a post that keeps failing) is emailed to the alert list within the hour; anything still open is summarized at 8 AM.',
    ],
    cleanup: 'Delete the TEST application.',
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
    id: 'gathering-search', title: 'The Gathering: @mention and search', site: 'both', who: 'team', minutes: 4, tour: 'gather',
    steps: [
      'Open The Gathering on two devices (or two browsers) signed in as two team members. On the second, switch on “Notify me on this device” from her own card.',
      'On the first, in The Gathering channel type @ and the first letters of her name, pick her from the list, finish the message and send.',
      'On the second, stay in another room. Then open the magnifying glass, search a word from the message, and tap “Mentions of me”.',
    ],
    expect: [
      'Her name is gold in the message for her (purple for everyone else) and the message has a gold edge.',
      'The room shows an @ marker in her channel list and her device shows “… mentioned you”.',
      'Search lists the message with the word marked; tapping it jumps to it (or opens its thread).',
    ],
    cleanup: 'Delete the test message.',
  },
  {
    id: 'db-status', title: 'Database updates land', site: 'both', who: 'admin', minutes: 3, tour: 'sys:health',
    steps: [
      'Open Systems → Health. Any waiting script shows Copy script.',
      'Tap Copy script, open the SQL editor, press Ctrl+A then Ctrl+V, and Run with nothing highlighted (confirm “Run this query” if asked).',
      'Back in Health, tap Check again.',
    ],
    expect: [
      'The editor shows the one result row printed under the script (for v42: versions_ok true … jobs 8).',
      'The script turns into a tick with today’s date; the Overview banner disappears once nothing is waiting.',
    ],
    cleanup: 'None.',
  },
  {
    id: 'storefront-billing', title: 'A storefront free period and subscription', site: 'market', who: 'admin', minutes: 6, tour: 'sys:shops',
    steps: [
      'In Systems → Curators & shops open a test shop whose studio you can sign in to, and tap “Start free period”.',
      'Sign in to that shop’s studio (p31market.com/dashboard) → Plan & billing.',
      'Tap “Set up my subscription”, look over the Stripe page, then go back without paying.',
      'In Systems, tap “Extend 30 days”, then “Complimentary”.',
    ],
    expect: [
      'The shop shows “Free period · N days left”; the studio shows the same countdown and the button names the price.',
      'Stripe Checkout shows “P31 Marketplace storefront” at the monthly price, with the first charge after the free period; going back lands on Plan & billing with “No changes were made”.',
      'Extend 30 days moves the end date; Complimentary turns the studio card into “Your storefront is complimentary”. Systems → Activity lists each change.',
    ],
    cleanup: 'Tap “Take out of billing” on the test shop (or leave it complimentary).',
  },
  {
    id: 'class-reminders', title: 'Class reminder emails', site: 'collective', who: 'admin', minutes: 3, tour: 'sys:academy',
    steps: [
      'In the Mentor console → Sessions, schedule a TEST session about 50 minutes from now for a program where your own email is an enrolled student (or invite yourself), with “Email reminders” on.',
      'Wait for the next quarter hour.',
    ],
    expect: ['You get “Starting at <time>: TEST…” with how to join; a session a day out gets “Coming up: TEST…” instead. Each reminder goes once.'],
    cleanup: 'Delete the TEST session.',
  },
  {
    id: 'welcome-series', title: 'Welcome emails for a new subscriber', site: 'market', who: 'visitor', minutes: 3,
    steps: ['In a private window on p31market.com, subscribe through the pop-up or the footer with an email you can read.', 'Wait up to an hour.'],
    expect: [
      'Email 1 (welcome and Melanie JC’s story) arrives within the hour; email 2 (what is coming up) about three days later; email 3 (ways to be part of it) about four days after that.',
      'Each has an unsubscribe link; using it stops the rest. Systems → Settings → Automatic emails switches the series off for everyone.',
    ],
    cleanup: 'Unsubscribe the test address.',
  },
  {
    id: 'activity-log', title: 'The activity log', site: 'both', who: 'admin', minutes: 2, tour: 'sys:activity',
    steps: ['Make any change in Systems (feature a shop, switch a team dashboard, edit a market).', 'Open Systems → Activity.'],
    expect: ['The change is at the top in plain words with your name, the time and the before and after; the area chips and search narrow the list.'],
    cleanup: 'Undo the test change (that is logged too).',
  },
  {
    id: 'ticket-sales', title: 'Eventbrite ticket sales', site: 'market', who: 'admin', minutes: 3, tour: 'sys:events',
    steps: [
      'Add the Supabase secret EVENTBRITE_TOKEN (Eventbrite → Account settings → Developer links → API keys → private token) and deploy eventbrite-stats.',
      'Make sure the Luncheon in Systems → Markets & events has its Eventbrite link as the ticket link.',
      'Open Systems → Overview, then Markets & events, then Today.',
    ],
    expect: ['A ticket card shows tickets sold of the total, days to go and each ticket type; tapping it opens the Eventbrite page. Without the token, Markets & events explains how to add it.'],
    cleanup: 'None.',
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
