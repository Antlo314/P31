// The Content Studio walkthrough: opens the first time someone signs in to the Studio.
const at = (to) => [`.ds-nav a[href="${to}"]`, `.ds-tabs a[href="${to}"]`, '.ds-tabs button.ds-tab'];

export const STUDIO_TOUR = [
  {
    title: 'Welcome to Content Studio',
    body: 'Everything for P31’s Instagram and Facebook in one place: plan posts, cut clips, and keep up with what people are saying. This walkthrough takes about a minute. Use Next, or the arrow keys.',
  },
  {
    to: '/studio', targets: at('/studio'),
    title: 'Overview: how the pages are doing',
    body: 'Followers, reach and engagement for the last 30 days, plus the best times to post (Eastern). Glance at it at the start of the week before you plan.',
  },
  {
    to: '/studio/planner', targets: at('/studio/planner'),
    title: 'Planner: months ahead',
    body: 'The social calendar. Tap “Plan this month with AI” for a month of ideas spread across the pillars, or add a day yourself. Each post gets a hook, caption and hashtags drafted for you; pick a trending track for reels; approve it, and “Schedule it” sends it to Instagram and Facebook for that day.',
  },
  {
    to: '/studio/autocreate', targets: at('/studio/autocreate'),
    title: 'Auto-create: a month in a minute',
    body: 'Choose the kinds of posts (Bible fill-in-the-blank, finish the sentence, this or that, quizzes, a Sunday word, invitations), the look, and how many days. The Studio drafts every card and caption from the library at the hours your followers are online. Look them over, swap or rewrite any, then save them to the Planner or schedule the whole run.',
  },
  {
    to: '/studio/calendar', targets: at('/studio/calendar'),
    title: 'Calendar: what’s going out',
    body: 'Every scheduled post in order, and how recent posts performed. Open a scheduled post to change or delete it before it goes out.',
  },
  {
    to: '/studio/compose', targets: at('/studio/compose'),
    title: 'Create post: write once, post to both',
    body: 'Pick Instagram, Facebook or both, write the caption, add photos or a video, then choose a time. The suggested times are when your audience is most active. Tap Schedule post and it’s queued.',
  },
  {
    to: '/studio/create', targets: at('/studio/create'),
    title: 'Creative tools: clip editing',
    body: 'Drop in raw phone footage and the clip editor cuts it into a captioned reel. Pick a look, add music and the P31 logo, then send the finished clip straight to Create post. Product photos can be styled here too.',
  },
  {
    to: '/studio/inbox', targets: at('/studio/inbox'),
    title: 'Messages: DMs from both apps',
    body: 'Instagram and Facebook direct messages, including the replies from Carla, P31’s DM assistant, who answers first. This view is read-only. When someone needs a person, reply from the Instagram or Facebook app.',
  },
  {
    to: '/studio/comments', targets: at('/studio/comments'),
    title: 'Comments: nothing slips by',
    body: 'Your recent posts with their comments, so you can see what people are saying in one place. Reply from the app.',
  },
  {
    to: '/studio/email', targets: at('/studio/email'),
    title: 'Email: Carla drafts, you send',
    body: 'Everything sent to members@ and vendor@ lands here with a reply Carla already drafted. Read it, edit anything, or ask her to rewrite it ("shorter", "mention the gala"), then tap Send. Nothing goes out without you. The orange flag means a person needs to answer it properly.',
  },
  {
    title: 'The fast-post routine',
    list: [
      'Film a short moment on your phone.',
      'Creative tools: cut it into a captioned clip with the P31 look.',
      'Send it to Create post, write the caption, pick a suggested time, schedule.',
      'Once a day, answer Email, then check Messages and Comments.',
    ],
    body: 'That’s it. Replay this walkthrough any time from the ? button at the top.',
  },
];

// The Email inbox walkthrough: for the Emails dashboard (and anyone, from Systems → Walkthroughs).
export const STUDIO_EMAIL_TOUR = [
  { title: 'The shared inboxes', body: 'members@thep31collective.org and vendor@p31market.com arrive here. Carla reads each email, sorts it and drafts a reply for you to approve.' },
  { to: '/studio/email', targets: at('/studio/email'), title: 'Threads to answer', body: 'Each thread shows who wrote, the subject, a summary and whether it needs a person. Open one to read the whole conversation.' },
  { to: '/studio/email', targets: ['.ds-main form', '.ds-main textarea', '.ds-main'], title: 'Approve the draft', body: 'Edit the drafted reply as you like, then Send reply. Nothing goes out until you confirm. Replies come from the mailbox the email was sent to.' },
  { to: '/studio/email', targets: at('/studio/email'), title: 'Needs a person', body: 'Refunds, complaints and anything delicate are flagged “needs a person” and never answered by themselves.' },
];
