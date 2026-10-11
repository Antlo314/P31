// The Gathering walkthrough: plays from Systems → Walkthroughs (?tour=gather) or the ? button.
export const GATHER_TOUR = [
  {
    title: 'Welcome to The Gathering',
    body: 'P31’s community space: vendors, mentorship students and alumnae, mentors, the team and the overseers, in one place. A one-minute tour.',
  },
  { targets: ['.gt-side__list', '.gt-side'], title: 'Channels by who they are for', body: 'Everyone: Welcome, Daily Word, The Gathering, Prayer requests, Wins & celebrations. Vendors and the team: Market talk and Market day. Students and mentors: Academy lounge. The team: Team room. Each person sees only the rooms that are hers.' },
  { targets: ['.gt-side__list a[href="/gather/daily-word"]', '.gt-side__list'], title: 'The Daily Word', body: 'Every morning a verse appears with a question. It pops up the first time you open The Gathering that day; “Join the discussion” opens its thread and “Amen” adds a 🙏🏾.' },
  { targets: ['.gt-list'], title: 'Messages, threads, reactions', body: 'Reply under any message to start a thread, react with the P31 set, pin what matters (team), edit or remove your own. Photos and videos are shared privately; only members see them.' },
  { targets: ['.gt-composer'], title: 'Write here', body: 'Type, attach up to six photos or videos, and send. Rooms marked “announcements” take replies in threads only.' },
  { targets: ['.gt-head .gt-icon[aria-label="Members"]', '.gt-head'], title: 'Members and badges', body: 'The members list groups everyone by who they are: Founder & CEO and other titles, Overseer, P31 Team, Mentor, Business or Faith student, Alumna, Vendor with a link to her shop. Open anyone’s card to message her.' },
  { targets: ['.gt-head .gt-icon[aria-label="Members"]', '.gt-head'], title: 'Direct messages and alerts', body: 'Message starts a private conversation. A DM that goes unread for a few minutes becomes one email with a link back; with The Gathering open you get a device notification instead. Both switches are on your own card.' },
];
