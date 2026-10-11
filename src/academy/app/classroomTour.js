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

// The mentor console walkthrough (mentors, admins and the Classroom dashboard).
const mentorTour = (slug) => {
  const t = `/academy/${slug}/teach`;
  const name = slug === 'faith' ? 'Faith-Based Mentorship' : 'Business Mentorship';
  return [
    { title: `The ${name} console`, body: 'Everything for running the program: students, their work, the curriculum and videos, sessions, intro calls and enrollment. A two-minute tour.' },
    { to: t, targets: at(t), title: 'Overview', body: 'Active students, new intro-call requests, unread messages and work waiting for feedback, with what is coming up. “Go live now” opens a live room at once.' },
    { to: `${t}/students`, targets: at(`${t}/students`), title: 'Students', body: 'Each student’s page: messages, personal tasks, files, 1:1 sessions, action plans, progress, submitted work and private notes. “See their dashboard” shows her classroom exactly as she sees it.' },
    { to: `${t}/gradebook`, targets: at(`${t}/gradebook`), title: 'Gradebook', body: 'Work handed in, graded against the rubric you set on each assignment, with written feedback she reads in her classroom.' },
    { to: `${t}/curriculum`, targets: at(`${t}/curriculum`), title: 'Curriculum & videos', body: 'Modules and lessons, each with notes, a video link or an uploaded video, a reflection question and downloads. Publish when ready; students see it at once.' },
    { to: `${t}/sessions`, targets: at(`${t}/sessions`), title: 'Sessions & recordings', body: 'Group sessions in the live room, on Zoom, or any link. Afterwards add notes, attendance and the recording (a link or an uploaded file).' },
    { to: `${t}/calls`, targets: at(`${t}/calls`), title: 'Intro calls and invites', body: 'Requests from the mentorship page. After the call, send a private enrollment link with the plan and price only she sees.' },
    { to: `${t}/announcements`, targets: at(`${t}/announcements`), title: 'Announcements', body: 'News, reminders and encouragement for everyone in the program, pinned when they matter.' },
    { title: 'That is the console', body: 'Replay this any time from the ? button. Admins can also edit the curriculum, videos and sessions from Systems → Mentorship.' },
  ];
};
export const MENTOR_TOURS = { business: mentorTour('business'), faith: mentorTour('faith') };
