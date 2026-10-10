// The classroom walkthrough for students: opens the first time they step into their classroom.
const at = (to) => [`.ds-nav a[href="${to}"]`, `.ds-tabs a[href="${to}"]`, '.ds-tabs button.ds-tab'];

const classroomTour = (slug) => {
  const base = `/academy/${slug}`;
  const faith = slug === 'faith';
  return [
    {
      title: `Welcome to your ${faith ? 'Faith-Based' : 'Business'} Mentorship classroom`,
      body: 'This is your private space with Melanie JC: lessons, live sessions, your work and a direct line to your mentor. Here’s a one-minute tour.',
    },
    {
      to: base, targets: at(base),
      title: 'Home: what’s next',
      body: 'Announcements from your mentor, your next session, and anything due soon. Start here each time you sign in.',
    },
    {
      to: `${base}/learn`, targets: at(`${base}/learn`),
      title: 'Lessons, at your pace',
      body: 'Modules with video, notes and downloads, released by your mentor. Mark each lesson complete as you go.',
    },
    {
      to: `${base}/assignments`, targets: at(`${base}/assignments`),
      title: 'Assignments',
      body: 'See exactly what’s asked and how it’s graded, hand in your work, and read your mentor’s written feedback.',
    },
    {
      to: `${base}/sessions`, targets: at(`${base}/sessions`),
      title: 'Sessions: join live',
      body: 'Group sessions and one-on-ones open right here in the classroom. Nothing to install. Join when it’s time.',
    },
    {
      to: `${base}/messages`, targets: at(`${base}/messages`),
      title: faith ? 'A private line to your mentor' : 'Your member line',
      body: 'Questions, wins and prayer requests between sessions, with files and photos. Only you and your mentor see it.',
    },
    faith
      ? { to: `${base}/journal`, targets: at(`${base}/journal`), title: 'Your journal', body: 'Prayers, gratitude and reflections, kept private to you. Your tasks from each session live under My tasks.' }
      : { to: `${base}/goals`, targets: at(`${base}/goals`), title: 'Goals and action plans', body: 'Set the goals you’re working toward. After each session your mentor writes an action plan with clear next steps.' },
    {
      to: `${base}/progress`, targets: at(`${base}/progress`),
      title: 'Progress and your certificate',
      body: 'Track lessons, assignments and sessions. Meet the requirements and your certificate of completion appears here.',
    },
    {
      title: 'You’re all set',
      body: 'Replay this walkthrough any time from the ? button at the top. Welcome. We’re glad you’re here.',
    },
  ];
};

// Built once, so the walkthrough keeps the same steps from render to render.
export const CLASSROOM_TOURS = { business: classroomTour('business'), faith: classroomTour('faith') };
