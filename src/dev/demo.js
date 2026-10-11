// DEVELOPMENT ONLY — never part of a production build (see src/lib/supabase.js).
// A stand-in database for walkthrough screenshots: ?demo=admin | student | faith | davinci | studio | curator (?demo=off to stop).
// curator signs in as a vendor with an approved shop (Sample Bakery Co.).
// davinci and studio sign in as team members with only that tool (like Anthony and Yanni).
// Students, classes and grades are illustrative SAMPLE data. Content Studio numbers come from a
// real read-only Zernio snapshot (src/dev/demo-studio.json, not committed); DMs and comments are samples.
// The Studio snapshot holds real account numbers, so it stays out of git (see .gitignore);
// without it the Studio screens just show empty states.
const snapshot = Object.values(import.meta.glob('./demo-studio.json', { eager: true, import: 'default' }))[0];
const studio = snapshot || { overview: { accounts: [], igInsights: null, fbInsights: null, bestTime: null }, posts: { scheduled: [], recent: [], published: [] } };

let now = 0; // set when the demo client starts, so nothing runs at import time
const iso = (mins) => new Date(now + mins * 60000).toISOString();
const day = (d, h = 19, m = 0) => { const x = new Date(now + d * 864e5); x.setHours(h, m, 0, 0); return x.toISOString(); };
const BUS = 'p-bus';
const FAI = 'p-fai';

const PEOPLE = {
  'u-mel': { name: 'Melanie JC', email: 'melanie@example.com' },
  'u-s1': { name: 'Danielle Brooks', email: 'danielle@example.com', program: BUS },
  'u-s2': { name: 'Aaliyah Grant', email: 'aaliyah@example.com', program: BUS },
  'u-s3': { name: 'Keisha Monroe', email: 'keisha@example.com', program: BUS },
  'u-s4': { name: 'Tanya Ellis', email: 'tanya@example.com', program: BUS },
  'u-s5': { name: 'Simone Carter', email: 'simone@example.com', program: FAI },
  'u-s6': { name: 'Renee Lawson', email: 'renee@example.com', program: FAI },
  'u-dv': { name: 'Sample DaVinci Editor', email: 'davinci@example.com' },
  'u-st': { name: 'Sample Studio Seat', email: 'studio@example.com' },
  'u-cu': { name: 'Sample Curator', email: 'curator@example.com' },
};
const userFor = (mode) => {
  const id = mode === 'student' ? 'u-s1' : mode === 'faith' ? 'u-s5' : mode === 'davinci' ? 'u-dv' : mode === 'studio' ? 'u-st' : mode === 'curator' ? 'u-cu' : 'u-mel';
  return { id, email: PEOPLE[id].email, user_metadata: { full_name: PEOPLE[id].name }, app_metadata: {}, aud: 'authenticated' };
};

const roster = (program) => Object.entries(PEOPLE).filter(([, p]) => p.program === program).map(([id, p], i) => ({
  user_id: id, full_name: p.name, email: p.email, status: i === 3 ? 'past_due' : 'active', source: 'stripe',
  plan_label: 'Monthly', access_until: null, started_at: day(-60 + i * 9), lessons_done: [4, 6, 2, 1][i] ?? 3, unread: [1, 0, 2, 0][i] ?? 0,
}));

let db = null;
const makeDb = () => ({
  academy_programs: [
    { id: BUS, slug: 'business', title: 'Business Mentorship', is_active: true, sort_order: 1 },
    { id: FAI, slug: 'faith', title: 'Faith-Based Mentorship', is_active: true, sort_order: 2 },
  ],
  academy_plans: [
    { id: 'pl1', program_id: BUS, billing: 'month', label: 'Monthly', price_cents: null, is_active: true },
    { id: 'pl2', program_id: BUS, billing: 'six_months', label: 'Every 6 months', price_cents: null, is_active: true },
    { id: 'pl3', program_id: FAI, billing: 'month', label: 'Monthly', price_cents: null, is_active: true },
  ],
  academy_mentors: [
    { user_id: 'u-mel', program_id: BUS, display_name: 'Melanie JC', title: 'Lead mentor', created_at: day(-90) },
    { user_id: 'u-mel', program_id: FAI, display_name: 'Melanie JC', title: 'Mentor', created_at: day(-90) },
  ],
  studio_members: [
    { user_id: 'u-mel', full_name: 'Melanie JC', email: 'melanie@example.com', created_at: day(-30) },
  ],
  system_operators: [{ user_id: 'u-mel', username: 'Melanie', display_name: 'Melanie', role: 'owner' }],
  profiles: Object.entries(PEOPLE).map(([id, p]) => ({ id, full_name: p.name, avatar_url: null, created_at: day(-60) })),
  academy_enrollments: Object.entries(PEOPLE).filter(([, p]) => p.program).map(([id, p]) => ({ id: `e-${id}`, user_id: id, program_id: p.program, status: 'active', source: 'stripe', plan_id: p.program === BUS ? 'pl1' : 'pl3', started_at: day(-45), access_until: null, plan: { label: 'Monthly', billing: 'month', price_cents: null } })),
  academy_modules: [
    { id: 'm1', program_id: BUS, title: 'Clarifying your vision', summary: 'Purpose, calling and the business behind it.', position: 1, is_published: true },
    { id: 'm2', program_id: BUS, title: 'Offers that serve', summary: 'Products and services aligned with your gifts.', position: 2, is_published: true },
    { id: 'm3', program_id: BUS, title: 'Brand, message & audience', summary: '', position: 3, is_published: true },
    { id: 'm4', program_id: FAI, title: 'Identity in Christ', summary: '', position: 1, is_published: true },
  ],
  academy_lessons: [
    ['l1', 'm1', 'Your why, written down', true], ['l2', 'm1', 'Vision vs. goals', true], ['l3', 'm1', 'Stewarding your season', true],
    ['l4', 'm2', 'What do you actually sell?', true], ['l5', 'm2', 'Pricing with confidence', true],
    ['l6', 'm3', 'Your brand voice', true], ['l7', 'm3', 'Finding your first 100', false],
  ].map(([id, module_id, title, pub], i) => ({ id, module_id, program_id: BUS, title, position: i, is_published: pub, video_url: i % 2 ? 'https://youtu.be/dQw4w9WgXcQ' : null, body: '# Welcome\nWork through this lesson, then complete the reflection.', reflection_prompt: 'What is one step you will take this week?' }))
    .concat([{ id: 'l8', module_id: 'm4', program_id: FAI, title: 'Fearfully and wonderfully made', position: 0, is_published: true, body: 'Read Psalm 139.' }]),
  academy_progress: ['l1', 'l2', 'l3', 'l4'].map((l) => ({ lesson_id: l, user_id: 'u-s1', program_id: BUS })),
  academy_resources: [
    { id: 'r1', program_id: BUS, title: 'One-page business plan template', file_name: 'business-plan.pdf', size_bytes: 482000, file_path: 'x', created_at: day(-20) },
    { id: 'r2', program_id: BUS, title: 'Pricing worksheet', file_name: 'pricing.pdf', size_bytes: 210000, file_path: 'x', created_at: day(-12) },
    { id: 'r3', program_id: FAI, title: '30-day prayer guide', file_name: 'prayer-guide.pdf', size_bytes: 330000, file_path: 'x', created_at: day(-9) },
  ],
  academy_student_files: [
    { id: 'f1', program_id: BUS, student_id: 'u-s1', title: 'Feedback on your brand deck', note: 'Read before Thursday', file_name: 'danielle-brand-notes.pdf', size_bytes: 186000, file_path: 'x', created_at: day(-2) },
    { id: 'f2', program_id: BUS, student_id: 'u-s1', title: 'Launch checklist — just for you', note: null, file_name: 'launch-checklist.pdf', size_bytes: 92000, file_path: 'x', created_at: day(-6) },
  ],
  academy_announcements: [
    { id: 'an1', program_id: BUS, title: 'Group session moved to 7 PM', body: 'Same link — see you there!', is_pinned: true, created_at: day(-1) },
    { id: 'an2', program_id: BUS, title: 'Welcome, new members', body: 'Introduce yourself in Discussions.', is_pinned: false, created_at: day(-8) },
    { id: 'an3', program_id: FAI, title: 'This week: Psalm 139', body: 'Journal one verse each day.', is_pinned: true, created_at: day(-2) },
  ],
  academy_sessions: [
    { id: 's1', program_id: BUS, title: 'Monday Strategy Session', description: 'Q4 planning together.', starts_at: day(1, 19), duration_minutes: 60, provider: 'daily', daily_room: 'demo', join_url: 'https://example.daily.co/demo', student_id: null, invitees: null },
    { id: 's2', program_id: BUS, title: '1:1 Mentorship Session', starts_at: day(2, 12), duration_minutes: 60, provider: 'daily', daily_room: 'demo2', join_url: 'https://example.daily.co/demo2', student_id: 'u-s1', invitees: null },
    { id: 's3', program_id: BUS, title: 'Offer workshop', starts_at: day(-6, 19), duration_minutes: 60, provider: 'daily', daily_room: 'demo3', join_url: 'https://example.daily.co/demo3', student_id: null, invitees: null, started_at: day(-6, 19), ended_at: day(-6, 20), has_recording: true, notes: 'Great work today — homework: draft your signature offer.' },
    { id: 's4', program_id: FAI, title: 'Prayer & reflection circle', starts_at: day(3, 18), duration_minutes: 45, provider: 'daily', daily_room: 'demo4', join_url: 'https://example.daily.co/demo4', student_id: null, invitees: null },
  ],
  academy_assignments: [
    { id: 'a1', program_id: BUS, title: 'Write your one-page business plan', instructions: '# The brief\n- Mission and vision\n- Your signature offer\n- Who you serve\n\nUse the template in the Library.', due_at: day(4, 23, 59), submission_type: 'any', pass_pct: 70, is_published: true, assigned_to: null, file_name: 'business-plan.pdf', file_path: 'x', size_bytes: 482000, position: 1, criteria: [{ max_points: 20 }, { max_points: 20 }, { max_points: 10 }] },
    { id: 'a2', program_id: BUS, title: 'Price your signature offer', instructions: 'Complete the pricing worksheet and explain your number.', due_at: day(-3, 23, 59), submission_type: 'file', pass_pct: 70, is_published: true, assigned_to: null, position: 2, criteria: [{ max_points: 25 }, { max_points: 25 }] },
    { id: 'a3', program_id: BUS, title: 'Redo your Instagram bio', instructions: 'A task just for you, Danielle — three versions, then pick one.', due_at: day(2, 17), submission_type: 'text', pass_pct: 70, is_published: true, assigned_to: ['u-s1'], position: 3, criteria: [{ max_points: 10 }] },
  ],
  academy_criteria: [
    { id: 'c1', assignment_id: 'a1', program_id: BUS, title: 'Clear mission & vision', description: 'Specific, faith-rooted, memorable.', max_points: 20, position: 0 },
    { id: 'c2', assignment_id: 'a1', program_id: BUS, title: 'A defined signature offer', description: 'What it is, who it serves, the outcome.', max_points: 20, position: 1 },
    { id: 'c3', assignment_id: 'a1', program_id: BUS, title: 'Polish', description: 'Readable and on one page.', max_points: 10, position: 2 },
    { id: 'c4', assignment_id: 'a2', program_id: BUS, title: 'Costs covered', max_points: 25, position: 0 },
    { id: 'c5', assignment_id: 'a2', program_id: BUS, title: 'Value explained', max_points: 25, position: 1 },
    { id: 'c6', assignment_id: 'a3', program_id: BUS, title: 'Clarity', max_points: 10, position: 0 },
  ],
  academy_submissions: [
    { id: 'sub1', program_id: BUS, assignment_id: 'a2', student_id: 'u-s1', title: 'Price your signature offer', status: 'reviewed', score: 46, max_score: 50, feedback: 'Beautiful reasoning on value — raise the VIP tier by 15%.', file_name: 'danielle-pricing.pdf', file_path: 'x', created_at: day(-4), reviewed_at: day(-2) },
    { id: 'sub2', program_id: BUS, assignment_id: 'a2', student_id: 'u-s2', title: 'Price your signature offer', status: 'submitted', file_name: 'aaliyah-pricing.pdf', file_path: 'x', created_at: day(-1) },
    { id: 'sub3', program_id: BUS, assignment_id: 'a2', student_id: 'u-s3', title: 'Price your signature offer', status: 'revise', feedback: 'Close! Add your material costs.', created_at: day(-3) },
    { id: 'sub4', program_id: BUS, assignment_id: 'a1', student_id: 'u-s4', title: 'Write your one-page business plan', status: 'submitted', body: 'Mission: to help women in Gwinnett…', created_at: iso(-90) },
  ],
  academy_scores: [{ submission_id: 'sub1', criterion_id: 'c4', program_id: BUS, points: 24, comment: 'Thorough.' }, { submission_id: 'sub1', criterion_id: 'c5', program_id: BUS, points: 22, comment: null }],
  academy_quizzes: [
    { id: 'q1', program_id: BUS, title: 'Module 1 check-in', description: 'Five quick questions on vision.', pass_pct: 70, max_attempts: 3, is_published: true, position: 1, questions: [1, 2, 3, 4, 5].map((n) => ({ id: `qq${n}` })) },
    { id: 'q2', program_id: BUS, title: 'Pricing basics', description: null, pass_pct: 80, max_attempts: null, is_published: true, position: 2, questions: [1, 2, 3].map((n) => ({ id: `qp${n}` })) },
  ],
  academy_quiz_questions: [
    { id: 'qq1', quiz_id: 'q1', program_id: BUS, prompt: 'A vision statement describes…', kind: 'single', options: ['Where you are headed', 'Your monthly revenue', 'Your logo colors'], points: 1, position: 0 },
    { id: 'qq2', quiz_id: 'q1', program_id: BUS, prompt: 'Which are signs of a clear offer? (choose all)', kind: 'multi', options: ['A defined outcome', 'A specific audience', 'As many features as possible'], points: 2, position: 1 },
    { id: 'qq3', quiz_id: 'q1', program_id: BUS, prompt: 'In one sentence, what is your why?', kind: 'text', options: [], points: 1, position: 2 },
  ],
  academy_quiz_attempts: [
    { id: 'at1', quiz_id: 'q1', program_id: BUS, user_id: 'u-s1', score_pct: 80, passed: true, needs_review: true, created_at: day(-5), answers: {}, results: {} },
    { id: 'at2', quiz_id: 'q1', program_id: BUS, user_id: 'u-s2', score_pct: 60, passed: false, created_at: day(-4), answers: {}, results: {} },
    { id: 'at3', quiz_id: 'q2', program_id: BUS, user_id: 'u-s3', score_pct: 100, passed: true, created_at: day(-2), answers: {}, results: {} },
  ],
  academy_threads: [
    { id: 't1', program_id: BUS, author_id: 'u-s2', author_name: 'Aaliyah Grant', author_role: 'student', title: 'How did you price your first product?', body: 'I keep second-guessing myself…', is_pinned: false, is_locked: false, reply_count: 4, last_activity_at: iso(-50), created_at: day(-2) },
    { id: 't2', program_id: BUS, author_id: 'u-mel', author_name: 'Melanie JC', author_role: 'mentor', title: 'Introduce yourself 👋', body: 'Tell us your name, your business and one goal for this season.', is_pinned: true, is_locked: false, reply_count: 9, last_activity_at: day(-1), created_at: day(-30) },
    { id: 't3', program_id: BUS, author_id: 'u-s1', author_name: 'Danielle Brooks', author_role: 'student', title: 'Wins this week 🎉', body: 'I booked my first two clients!', is_pinned: false, is_locked: false, reply_count: 6, last_activity_at: iso(-200), created_at: day(-3) },
  ],
  academy_posts: [
    { id: 'po1', thread_id: 't1', program_id: BUS, author_id: 'u-s1', author_name: 'Danielle Brooks', author_role: 'student', body: 'I started with my costs, then added what the result is worth to the client.', created_at: day(-1) },
    { id: 'po2', thread_id: 't1', program_id: BUS, author_id: 'u-mel', author_name: 'Melanie JC', author_role: 'mentor', body: 'Yes! Price the transformation, not your time. We’ll practice this Monday.', created_at: iso(-50) },
  ],
  academy_messages: [
    { id: 'mg1', program_id: BUS, student_id: 'u-s1', sender_id: 'u-s1', body: 'Hi Melanie! I uploaded my pricing worksheet — would love your thoughts.', created_at: day(-4, 10), read_at: day(-4, 11) },
    { id: 'mg2', program_id: BUS, student_id: 'u-s1', sender_id: 'u-mel', body: 'So proud of you. Feedback is on the assignment — and I shared a brand checklist in your Library.', created_at: day(-2, 9), read_at: day(-2, 12) },
    { id: 'mg3', program_id: BUS, student_id: 'u-s1', sender_id: 'u-s1', body: 'Thank you!! See you Monday at 7.', created_at: iso(-120), read_at: null },
  ],
  academy_notifications: [
    { id: 'n1', user_id: 'u-s1', program_id: BUS, kind: 'file', title: 'Your mentor shared a file: Feedback on your brand deck', body: 'Read before Thursday', link: '/academy/business/library', read_at: null, created_at: day(-2) },
    { id: 'n2', user_id: 'u-s1', program_id: BUS, kind: 'assignment', title: 'A task just for you: Redo your Instagram bio', body: null, link: '/academy/business/assignments/a3', read_at: null, created_at: day(-1) },
    { id: 'n3', user_id: 'u-s1', program_id: BUS, kind: 'feedback', title: 'Feedback on “Price your signature offer”', link: '/academy/business/assignments/a2', read_at: day(-2), created_at: day(-2) },
    { id: 'n4', user_id: 'u-mel', program_id: BUS, kind: 'submission', title: 'Tanya Ellis submitted work', body: 'Write your one-page business plan', link: '/academy/business/teach/gradebook', read_at: null, created_at: iso(-90) },
    { id: 'n5', user_id: 'u-mel', program_id: BUS, kind: 'message', title: 'New message from Danielle Brooks', body: 'Thank you!! See you Monday at 7.', link: '/academy/business/teach/inbox/u-s1', read_at: null, created_at: iso(-120) },
  ],
  academy_action_plans: [{ id: 'ap1', program_id: BUS, student_id: 'u-s1', title: 'Action plan — after our pricing session', summary: 'We set your VIP tier and launch date.', created_at: day(-6), items: [
    { id: 'ai1', text: 'Update the VIP price on your site', due_date: day(1).slice(0, 10), is_done: false, position: 0 },
    { id: 'ai2', text: 'Draft three Instagram bios', due_date: day(2).slice(0, 10), is_done: false, position: 1 },
    { id: 'ai3', text: 'Email your first five past clients', due_date: null, is_done: true, position: 2 },
  ] }],
  academy_action_items: [
    { id: 'ai1', program_id: BUS, student_id: 'u-s1', text: 'Update the VIP price on your site', due_date: day(1).slice(0, 10), is_done: false },
    { id: 'ai2', program_id: BUS, student_id: 'u-s1', text: 'Draft three Instagram bios', due_date: day(2).slice(0, 10), is_done: false },
  ],
  academy_goals: [
    { id: 'g1', program_id: BUS, user_id: 'u-s1', title: 'Launch my coaching offer', target: '10 clients', due_date: day(60).slice(0, 10), is_done: false },
    { id: 'g2', program_id: BUS, user_id: 'u-s1', title: 'Grow Instagram to 1,000', due_date: day(90).slice(0, 10), is_done: false },
  ],
  academy_journal: [
    { id: 'j1', program_id: FAI, user_id: 'u-s5', kind: 'prayer', title: 'For courage', body: 'Lord, help me step into what You’ve called me to.', created_at: day(-1) },
    { id: 'j2', program_id: FAI, user_id: 'u-s5', kind: 'gratitude', title: null, body: 'Grateful for my circle this week.', created_at: day(-3) },
  ],
  academy_requirements: [
    { id: 'rq1', program_id: BUS, title: 'Finish every lesson', kind: 'lessons', target: null, position: 0 },
    { id: 'rq2', program_id: BUS, title: 'Pass two assignments', kind: 'assignments', target: 2, position: 1 },
    { id: 'rq3', program_id: BUS, title: 'Attend 4 sessions', kind: 'sessions', target: 4, position: 2 },
    { id: 'rq4', program_id: BUS, title: 'Present your launch plan', kind: 'custom', target: null, position: 3 },
  ],
  academy_certificates: [{ id: 'ce1', program_id: BUS, user_id: 'u-s3', title: 'Certificate of Completion', recipient_name: 'Keisha Monroe', serial: '7F3A9C21B4', issued_at: day(-10) }],
  academy_inquiries: [
    { id: 'iq1', program_id: BUS, full_name: 'Jasmine Wright', email: 'jasmine@example.com', phone: '(470) 555-0142', preferred_times: 'Weekday evenings', message: 'I run a candle business and want structure.', status: 'new', created_at: iso(-300) },
    { id: 'iq2', program_id: BUS, full_name: 'Monique Hayes', email: 'monique@example.com', preferred_times: 'Saturday mornings', status: 'scheduled', created_at: day(-2) },
    { id: 'iq3', program_id: FAI, full_name: 'Grace Okafor', email: 'grace@example.com', message: 'Looking for a mentor in this season.', status: 'new', created_at: day(-1) },
  ],
  academy_invites: [{ id: 'iv1', program_id: BUS, email: 'monique@example.com', full_name: 'Monique Hayes', token: 'demo', created_at: day(-1), expires_at: day(13), used_at: null, plan: { label: 'Monthly', billing: 'month', price_cents: null } }],
  academy_attendance: [{ session_id: 's3', user_id: 'u-s1', program_id: BUS, status: 'present' }, { session_id: 's3', user_id: 'u-s2', program_id: BUS, status: 'late' }],
  academy_student_notes: [{ id: 'sn1', program_id: BUS, student_id: 'u-s1', author_id: 'u-mel', body: 'Launching in November. Pray with her about confidence on camera.', created_at: day(-6) }],
  crm_contacts: [
    ['Danielle Brooks', 'member', ['enrollment', 'calendly', 'classroom']], ['Jasmine Wright', 'prospect', ['mentorship form', 'calendly']],
    ['Monique Hayes', 'prospect', ['calendly']], ['Aaliyah Grant', 'member', ['enrollment']], ['Keisha Monroe', 'alumni', ['enrollment', 'classroom']],
    ['Brittany Cole', 'lead', ['popup']], ['Harmony Events Co.', 'partner', ['partner page']], ['Grace Okafor', 'prospect', ['mentorship form']],
  ].map(([name, stage, sources], i) => ({ id: `ct${i}`, full_name: name, email: `${name.split(' ')[0].toLowerCase()}@example.com`, phone: i % 3 ? null : '(470) 555-01' + (20 + i), stage, sources, tags: i === 0 ? ['VIP', 'launching Nov'] : [], notes: null, created_at: day(-40 + i * 3), last_activity_at: iso(-60 * (i + 1) * 7) })),
  crm_activities: [
    ['calendly_intro', 2], ['intro_request', 3], ['session_joined', 1], ['live_class', 1], ['subscribed', 9], ['calendly_connect', 4], ['enrolled', 12],
  ].map(([kind, d], i) => ({ id: `ca${i}`, kind, occurred_at: day(-d) })),
  social_posts: studio.posts.scheduled.slice(0, 6).map((p) => ({
    id: p.id, caption: p.content, platforms: p.platforms.map((x) => x.platform), media_urls: [], scheduled_for: p.scheduledFor, status: 'scheduled', notes: null, created_at: day(-3),
  })),
  social_prospects: [
    ['Atlanta Women in Business', 'facebook', 'group', 18400, 'new'], ['Gwinnett Makers Market', 'facebook', 'group', 5200, 'contacted'],
    ['#atlantasmallbusiness', 'instagram', 'hashtag', 92000, 'new'], ['Faith & Hustle Collective', 'instagram', 'creator', 12700, 'new'],
  ].map(([name, platform, kind, audience_size, status], i) => ({ id: `sp${i}`, name, platform, kind, audience_size, status, url: '#', description: 'Sample prospect', source_query: 'women entrepreneurs Atlanta', created_at: day(-i) })),
  collective_applications: [
    ['Jordan Ellis', 'Glow & Grace Skincare', 'Snellville, GA', 'new', ['Marketing', 'Networking', 'Faith/Obedience', 'Business Development'], ['P31 Marketplace virtual storefront'], 'Social Media', 0],
    ['Brianna Hughes', 'Rooted Ministries', 'Decatur, GA', 'new', ['Leadership', 'Public Speaking', 'Accountability'], ['Private Faith-Based Mentorship'], 'P31 Panelist', 1],
    ['Kayla Simmons', null, 'Duluth, GA', 'reviewing', ['Personal Growth/Purpose', 'Healthy Lifestyle'], ['Healthy Lifestyle Coaching'], 'P31 Vendor', 3],
    ['Nia Freeman', 'Freeman Events', 'Atlanta, GA', 'approved', ['Business Development', 'Marketing'], ['Marketing Strategy Coaching'], 'P31 Collective Member', 9],
  ].map(([full_name, business_name, city_state, status, growth_areas, interests, heard_from, ago], i) => ({
    id: `ca-${i}`, full_name, business_name, email: `${full_name.split(' ')[0].toLowerCase()}@example.com`, phone: '(470) 555-01' + (40 + i), city_state,
    birthday: ['March 14', 'July 2', 'November 21', 'May 9'][i], socials: business_name ? '@' + business_name.toLowerCase().replace(/[^a-z]/g, '') : null,
    heard_from, business_description: business_name ? `Sample business: ${business_name}.` : null, inspiration: 'Sample answer: I want a community of women who build with faith.',
    growth_areas, interests, agreed: true, status, notes: null, created_at: day(-ago), reviewed_at: status === 'new' ? null : day(-ago + 1),
  })),
  app_errors: [
    { id: 'er1', fingerprint: 'a', kind: 'render', message: "Cannot read properties of undefined (reading 'map')", path: '/academy/business/teach/gradebook', site: 'collective', release: 'b3ca818', count: 7, users: 3, first_seen: day(-2), last_seen: iso(-45), resolved_at: null, stack: "TypeError: Cannot read properties of undefined (reading 'map')\n    at Gradebook (teach.jsx:812)", user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' },
    { id: 'er2', fingerprint: 'b', kind: 'chunk', message: 'Failed to fetch dynamically imported module: /assets/Shop-x1y2.js', path: '/shop', site: 'market', release: '75b16c0', count: 2, users: 2, first_seen: day(-1), last_seen: iso(-300), resolved_at: null, stack: null, user_agent: 'Mozilla/5.0 (Windows NT 10.0)' },
    { id: 'er3', fingerprint: 'c', kind: 'promise', message: 'Load failed', path: '/join', site: 'collective', release: '75b16c0', count: 1, users: 1, first_seen: day(-4), last_seen: day(-4), resolved_at: day(-3), stack: null, user_agent: 'Mozilla/5.0 (Macintosh)' },
  ],
  orders: [
    { id: 'or1', product_name: 'Sample Candle Trio', buyer_name: 'Sample Shopper', buyer_email: 'shopper@example.com', quantity: 1, amount_total: 4200, amount_subtotal: 4200, order_type: 'request', fulfillment_method: 'pickup', fulfillment_status: 'new', payment_status: 'unpaid', created_at: iso(-95) },
    { id: 'or2', product_name: 'Sample Tote Bag', buyer_name: 'Sample Buyer', buyer_email: 'buyer@example.com', quantity: 2, amount_total: 5000, amount_subtotal: 5000, order_type: 'request', fulfillment_method: 'shipping', fulfillment_status: 'fulfilled', payment_status: 'paid', created_at: day(-3) },
  ],
  team_access: [
    { email: 'davinci@example.com', full_name: 'Sample DaVinci Editor', tools: ['davinci'], note: 'Sample', created_at: day(-2) },
    { email: 'studio@example.com', full_name: 'Sample Studio Seat', tools: ['studio'], note: 'Sample', created_at: day(-1) },
  ],
  email_threads: [
    { id: 'et-1', mailbox: 'collective', subject: 'Question about joining', contact_email: 'sample.applicant@example.com', contact_name: 'Sample Applicant', status: 'needs_reply', category: 'applicant', summary: 'Applied last week; asks when she will hear back and whether she can attend the next meetup.', needs_human: false, human_reason: null,
      draft: `Hi there,

Thank you so much for applying to join the P31 Collective. Our team reviews every application personally, and you will receive the final step by email once yours has been reviewed.

In the meantime, you are always welcome to follow along at https://www.thep31collective.org.

Warmly,
Carla
The P31 Collective`, draft_at: iso(-30), last_message_at: iso(-35), last_from_contact: true, created_at: iso(-35) },
    { id: 'et-2', mailbox: 'market', subject: 'Refund for my booth?', contact_email: 'sample.vendor@example.com', contact_name: 'Sample Vendor', status: 'needs_reply', category: 'vendor', summary: 'Vendor asking about a booth refund after missing the last market.', needs_human: true, human_reason: 'Refund request',
      draft: `Hi there,

Thank you for reaching out, and I am sorry you could not make it. I have passed your note to our team, and someone will follow up with you personally about your booth.

Warmly,
Carla
Proverbs 31 Marketplace`, draft_at: iso(-100), last_message_at: iso(-110), last_from_contact: true, created_at: iso(-110) },
    { id: 'et-3', mailbox: 'collective', subject: 'Re: Welcome!', contact_email: 'sample.member@example.com', contact_name: 'Sample Member', status: 'sent', category: 'member', summary: 'Member saying thank you.', needs_human: false, draft: null, last_message_at: day(-1), last_from_contact: false, created_at: day(-2) },
  ],
  email_messages: [
    { id: 'em-1', thread_id: 'et-1', direction: 'in', from_email: 'sample.applicant@example.com', from_name: 'Sample Applicant', subject: 'Question about joining', body_text: `Hello! I applied to join last week. When will I hear back, and can I come to the next meetup?

Thank you,
Sample`, attachments: [], created_at: iso(-35) },
    { id: 'em-2', thread_id: 'et-2', direction: 'in', from_email: 'sample.vendor@example.com', from_name: 'Sample Vendor', subject: 'Refund for my booth?', body_text: 'Hi, I missed the last market because I was sick. Can I get my booth fee back or move it to the next one?', attachments: [{ filename: 'receipt.pdf' }], created_at: iso(-110) },
    { id: 'em-3', thread_id: 'et-3', direction: 'in', from_email: 'sample.member@example.com', from_name: 'Sample Member', subject: 'Welcome!', body_text: 'Thank you so much for the warm welcome!', attachments: [], created_at: day(-2) },
    { id: 'em-4', thread_id: 'et-3', direction: 'out', from_email: 'members@thep31collective.org', from_name: 'The P31 Collective', subject: 'Re: Welcome!', body_text: `We are so glad you are here!

Warmly,
Carla
The P31 Collective`, attachments: [], created_at: day(-1) },
  ],
  content_plan: [
    { id: 'cp-1', post_date: day(2).slice(0, 10), post_time: '18:00:00', platforms: ['instagram', 'facebook'], kind: 'reel', pillar: 'Market countdown', theme: 'Setting up the Business and Leadership Luncheon', hook: 'Two weeks until the Luncheon', caption: 'Sample caption: the room is almost ready.', hashtags: '#p31market #atlantamarkets', first_comment: null, media: [], audio_id: null, audio_title: null, status: 'draft', notes: null, created_at: day(-1) },
    { id: 'cp-2', post_date: day(5).slice(0, 10), post_time: '12:00:00', platforms: ['instagram'], kind: 'photo', pillar: 'Curator spotlight', theme: 'Sample curator spotlight', hook: 'Meet the maker', caption: 'Sample caption about a candle maker.', hashtags: '#womenowned #handmade', first_comment: 'Shop her storefront: link in bio', media: [], audio_id: null, audio_title: null, status: 'approved', notes: null, created_at: day(-1) },
    { id: 'cp-3', post_date: day(9).slice(0, 10), post_time: '19:00:00', platforms: ['instagram', 'facebook'], kind: 'reel', pillar: 'Faith & encouragement', theme: 'Monday encouragement', hook: 'She is clothed with strength', caption: 'Sample caption with Proverbs 31:25.', hashtags: '#proverbs31', first_comment: null, media: [], audio_id: 'demo-audio-1', audio_title: 'Sample Track · Sample Artist', status: 'scheduled', notes: null, scheduled_for: day(9, 19), created_at: day(-2) },
  ],
  sound_board: [
    { id: 'sb-1', audio_id: 'demo-audio-1', title: 'Sample Track', artist: 'Sample Artist', audio_type: 'music', duration_ms: 31000, artwork_url: null, mood: 'uplifting', note: 'Good for countdowns', trending_seen_at: day(-1), used_count: 2, created_at: day(-3) },
  ],
  vendor_applications: [
    { id: 'va-1', serious: 'Yes', full_name: 'Sample Vendor', business_name: 'Sample Candle Co.', email: 'vendor1@example.com', phone: '(470) 555-0161', website_social: '@samplecandles', referred_by: null, categories: ['Candles & Home fragrance'], notes: 'Sample application.', agreed: true, status: 'new', review_notes: null, created_at: iso(-200) },
    { id: 'va-2', serious: 'Yes', full_name: 'Sample Maker', business_name: 'Sample Crafts', email: 'vendor2@example.com', phone: '(470) 555-0162', website_social: 'samplecrafts.com', referred_by: 'Sample Vendor', categories: ['Handmade crafts, baskets & gifts', 'Art, Painting, Photography'], notes: null, agreed: true, status: 'approved', review_notes: 'Booth 4', created_at: day(-6) },
  ],
  pro_edit_jobs: [
    { id: 41, requested_by: 'u-mel', kind: 'clip', batch_id: 'b1', clip_index: 1, clip_count: 3, title: 'Sample Gala · 1', style: 'Cinematic Teal', aspect: '9:16', source_paths: ['u-mel/davinci/b1/clip-01.mp4'], music_path: 'u-mel/music/1700000000000-Sample_Track.mp3', source_name: 'gala-raw.mov', clip_start: 312, clip_end: 342, status: 'processing', iris_package: 'pkg_demo', created_at: iso(-50), updated_at: iso(-20) },
    { id: 42, requested_by: 'u-mel', kind: 'clip', batch_id: 'b1', clip_index: 2, clip_count: 3, title: 'Sample Gala · 2', style: 'Warm Documentary', aspect: '9:16', source_paths: ['u-mel/davinci/b1/clip-02.mp4'], music_path: null, source_name: 'gala-raw.mov', clip_start: 1204, clip_end: 1234, status: 'queued', created_at: iso(-50), updated_at: iso(-50) },
    { id: 40, requested_by: 'u-mel', kind: 'edit', title: 'Sample recap', style: 'Social Clean', aspect: '9:16', source_paths: ['u-mel/pro-edit/1/01-a.mp4'], status: 'done', result_path: 'u-mel/pro-edit/results/40-recap.mp4', created_at: day(-3), updated_at: day(-2) },
  ],
  curator_data: [
    { id: 'cu1', business_name: 'Sample Pending Shop', slug: 'sample-pending', status: 'pending', created_at: day(-1), profiles: { full_name: 'Sample Applicant' } },
    { id: 'u-cu', business_name: 'Sample Bakery Co.', slug: 'sample-bakery', is_paid: true, plan: 'free', tagline: 'Small-batch treats, baked with love', bio: 'Sample bio: a home bakery in Gwinnett making pound cakes and cookies for markets and gifts.', status: 'approved', is_published: true, public_email: 'curator@example.com', location: 'Gwinnett, GA', instagram: 'samplebakery', store_design: { template: 'boutique' }, logo_url: null, banner_url: null, agreement_signed_at: day(-100), agreement_id: 'ag-2', created_at: day(-120), profiles: { full_name: 'Sample Curator' } },
  ],
  products: [
    { id: 101, curator_id: 'u-cu', name: 'Lemon Pound Cake', description: 'Sample: a dense, buttery pound cake with a bright lemon glaze.', price: 28, compare_at_price: 34, sale_ends_at: day(4), badge: 'Bestseller', is_featured: true, category: 'Wellness', stock_status: 'in_stock', inventory: 6, image_url: null, image_urls: [], tags: ['cake', 'gift'], variants: [{ name: 'Size', options: ['Loaf', 'Bundt'] }], is_active: true, sort_order: 0, created_at: day(-40) },
    { id: 102, curator_id: 'u-cu', name: 'Brown Butter Cookies (dozen)', description: 'Sample: chewy brown-butter cookies with flaky salt.', price: 18, compare_at_price: null, badge: 'New', is_featured: false, category: 'Wellness', stock_status: 'in_stock', inventory: null, image_url: null, image_urls: [], tags: ['cookies'], variants: [], is_active: true, sort_order: 1, created_at: day(-10) },
    { id: 103, curator_id: 'u-cu', name: 'Market Gift Box', description: 'Sample: a cake slice, six cookies and a handwritten card.', price: 45, compare_at_price: null, badge: 'Market exclusive', is_featured: false, category: 'Collection', stock_status: 'limited_edition', inventory: 3, image_url: null, image_urls: [], tags: ['gift', 'box'], variants: [], is_active: true, sort_order: 2, created_at: day(-5) },
  ],
  shop_subscribers: [
    { id: 1, curator_id: 'u-cu', email: 'sample.fan@example.com', name: 'Sample Fan', source: 'storefront', unsubscribed: false, created_at: day(-12) },
    { id: 2, curator_id: 'u-cu', email: 'another.shopper@example.com', name: null, source: 'storefront', unsubscribed: false, created_at: day(-6) },
    { id: 3, curator_id: 'u-cu', email: 'market.guest@example.com', name: 'Market Guest', source: 'market', unsubscribed: false, created_at: day(-1) },
  ],
  shop_campaigns: [
    { id: 1, curator_id: 'u-cu', subject: 'Lemon pound cake is back', body: 'Sample email body.', product_id: 101, status: 'sent', sent_count: 2, error: null, sent_at: day(-9), created_at: day(-9) },
  ],
  curator_analytics: [
    { id: 1, curator_id: 'u-cu', product_id: 101, event_type: 'product_click', created_at: day(-1) },
    { id: 2, curator_id: 'u-cu', product_id: 101, event_type: 'payment_click', created_at: day(-1) },
    { id: 3, curator_id: 'u-cu', product_id: 102, event_type: 'product_click', created_at: day(-2) },
  ],
  testimonials: [],
  discount_codes: [],
  site_admins: [
    { email: 'info@lumenlabsatl.com', full_name: 'Lumen Labs', added_by: null, created_at: day(-200) },
    { email: 'proverbs31markets@gmail.com', full_name: 'Proverbs 31 Marketplace', added_by: null, created_at: day(-200) },
  ],
  campaigns: [{ id: 'cm1', subject: 'The Business and Leadership Luncheon is coming', body: 'Save the date…', audience: 'subscribers', status: 'draft', created_at: day(-1) }],
  market_events: [{ id: 'ev1', title: 'Business and Leadership Luncheon', event_date: day(70).slice(0, 10), date_public: false, month_public: true, is_active: true, venue: 'The Four Event Center', address: '8599 Roswell Rd, Suite B, Atlanta, GA 30350', rsvp_url: 'https://www.eventbrite.com/e/proverbs-31-business-leadership-luncheon-tickets-2002850002272', capacity: 150, lineup_public: true }],
  event_vendors: [
    { id: 'evv-1', event_id: 'ev1', application_id: 'va-2', business_name: 'Sample Crafts', contact_name: 'Sample Maker', email: 'vendor2@example.com', website_social: 'samplecrafts.com', categories: ['Handmade crafts, baskets & gifts'], booth: 'A4', status: 'paid', is_public: true, notes: null, logo_url: null, created_at: day(-3) },
    { id: 'evv-2', event_id: 'ev1', application_id: null, business_name: 'Sample Candle Co.', contact_name: 'Sample Vendor', email: 'vendor1@example.com', website_social: '@samplecandles', categories: ['Candles & Home fragrance'], booth: 'B2', status: 'confirmed', is_public: true, notes: null, logo_url: null, created_at: day(-2) },
  ],
  // The four vendor forms that replaced JotForm (v37).
  vendor_agreements: [
    { id: 'ag-1', business_name: 'Sample Candle Co.', first_name: 'Sample', last_name: 'Vendor', email: 'vendor1@example.com', phone: '(470) 555-0161', address: { street: '12 Market Street', line2: '', city: 'Duluth', state: 'GA', zip: '30097', country: 'United States' }, agreed: true, signature: null, signed_name: 'Sample Vendor', signed_on: day(-1).slice(0, 10), terms_version: '2026-10', status: 'new', curator_id: null, review_notes: null, reviewed_at: null, created_at: iso(-95) },
    { id: 'ag-2', business_name: 'Sample Bakery Co.', first_name: 'Sample', last_name: 'Curator', email: 'curator@example.com', phone: '(470) 555-0170', address: { street: '400 Peachtree Industrial Blvd', line2: 'Suite 4', city: 'Suwanee', state: 'GA', zip: '30024', country: 'United States' }, agreed: true, signature: null, signed_name: 'Sample Curator', signed_on: day(-100).slice(0, 10), terms_version: '2026-10', status: 'active', curator_id: 'u-cu', review_notes: null, reviewed_at: day(-99), created_at: day(-100) },
  ],
  vendor_registrations: [
    { id: 'rg-1', event_id: 'ev1', event_label: 'Business and Leadership Luncheon · December 2026', business_name: 'Sample Candle Co.', first_name: 'Sample', last_name: 'Vendor', email: 'vendor1@example.com', phone: '(470) 555-0161', website: null, social: '@samplecandles', products: 'Hand-poured soy candles, wax melts and room sprays.', logo_url: null, agreed: true, signature: null, signed_name: 'Sample Vendor', signed_on: day(-1).slice(0, 10), status: 'new', lineup_id: null, application_id: 'va-1', review_notes: null, reviewed_at: null, created_at: iso(-70) },
    { id: 'rg-2', event_id: 'ev1', event_label: 'Business and Leadership Luncheon · December 2026', business_name: 'Sample Crafts', first_name: 'Sample', last_name: 'Maker', email: 'vendor2@example.com', phone: '(470) 555-0162', website: 'https://samplecrafts.com', social: '@samplecrafts', products: 'Woven baskets, ornaments and gift sets.', logo_url: null, agreed: true, signature: null, signed_name: 'Sample Maker', signed_on: day(-4).slice(0, 10), status: 'confirmed', lineup_id: 'evv-1', application_id: 'va-2', review_notes: 'Booth A4', reviewed_at: day(-3), created_at: day(-4) },
  ],
  vendor_feedback: [
    { id: 'fb-1', event_id: null, market_label: 'September 2026', business_name: 'Sample Crafts', email: 'vendor2@example.com', overall: 5, venue: 4, dj: 5, organization: 5, sales: 'Good', again: 'in', enjoyed: 'The community and the steady traffic all afternoon.', improve: 'More signage at the hotel entrance.', comments: null, lineup_id: null, created_at: day(-20) },
    { id: 'fb-2', event_id: null, market_label: 'September 2026', business_name: 'Sample Candle Co.', email: null, overall: 4, venue: 5, dj: null, organization: 4, sales: 'Below my expectations', again: 'waitlist', enjoyed: 'The venue and the DJ.', improve: 'Start the marketing earlier.', comments: 'Thank you for having us!', lineup_id: null, created_at: day(-19) },
  ],
  volunteer_signups: [
    { id: 'vo-1', event_id: 'ev1', first_name: 'Sample', last_name: 'Volunteer', phone: '(470) 555-0180', email: 'volunteer@example.com', emergency_contact: 'Sample Parent · (470) 555-0181', acknowledged: true, signature: null, signed_name: 'Sample Volunteer', signed_on: day(-1).slice(0, 10), status: 'new', review_notes: null, reviewed_at: null, created_at: iso(-30) },
  ],
});

const rpc = {
  shop_follower_count: () => 3,
  shop_subscribe: () => true,
  shop_unsubscribe: () => true,
  my_product_stats: () => [{ product_id: 101, opens: 14, buys: 5, shares: 3 }, { product_id: 102, opens: 6, buys: 1, shares: 0 }],
  my_roles: (_a, mode) => (mode === 'student'
    ? { signed_in: true, admin: false, operator: false, curator: false, studio: false, mentor: [], student: [{ program: 'business', title: 'Business Mentorship', status: 'active', has_access: true }] }
    : mode === 'faith'
      ? { signed_in: true, admin: false, operator: false, curator: false, studio: false, mentor: [], student: [{ program: 'faith', title: 'Faith-Based Mentorship', status: 'active', has_access: true }] }
      : mode === 'davinci'
        ? { signed_in: true, admin: false, operator: false, curator: false, studio: false, tools: ['davinci'], mentor: [], student: [] }
        : mode === 'studio'
          ? { signed_in: true, admin: false, operator: false, curator: false, studio: true, tools: ['studio'], mentor: [], student: [] }
        : mode === 'curator'
          ? { signed_in: true, admin: false, operator: false, curator: true, studio: false, tools: [], mentor: [], student: [] }
          : { signed_in: true, admin: true, operator: true, curator: false, studio: true, tools: ['studio', 'davinci'], mentor: ['business', 'faith'], student: [] }),
  team_access_status: () => [
    { email: 'davinci@example.com', has_account: true, confirmed: true, last_sign_in: day(-1) },
    { email: 'studio@example.com', has_account: false, confirmed: false, last_sign_in: null },
  ],
  academy_roster: (a) => roster(a.p_program),
  academy_inbox: (a) => roster(a.p_program).slice(0, 3).map((r, i) => ({
    student_id: r.user_id, full_name: r.full_name, email: r.email, unread: [1, 0, 2][i],
    last_body: ['Thank you!! See you Monday at 7.', 'Got it — working on it tonight.', 'Can we move our 1:1 to Friday?'][i], last_at: iso(-120 - i * 300), last_from_student: i !== 1,
  })),
  academy_awaiting_review: () => 2,
  event_lineup: () => [
    { business_name: 'Sample Crafts', website_social: 'samplecrafts.com', categories: ['Handmade crafts, baskets & gifts'], booth: 'A4', logo_url: null },
    { business_name: 'Sample Candle Co.', website_social: '@samplecandles', categories: ['Candles & Home fragrance'], booth: 'B2', logo_url: null },
  ],
  lineup_add_application: () => 'evv-new',
  submit_form: () => 'demo-form',
  is_admin: (_a, mode) => mode === 'admin',
  my_markets: () => ({
    events: [
      { id: 'ev1', title: 'Business and Leadership Luncheon', event_date: day(70).slice(0, 10), date_public: false, month_public: true, start_time: '1:30 PM', venue: 'The Four Event Center', load_in: null, has_vendors: true },
      { id: 'ev2', title: 'Spring Market', event_date: day(150).slice(0, 10), date_public: false, month_public: false, start_time: null, venue: null, load_in: '3:15 PM', has_vendors: true },
    ],
    lineup: [{ event_id: 'ev1', status: 'paid', booth: 'A4', checked_in: false }],
    registrations: [{ id: 'rg-9', event_id: 'ev1', event_label: 'Business and Leadership Luncheon · December 2026', status: 'confirmed', in_lineup: true, created_at: day(-4) }],
  }),
  agreement_preapprove: () => ({ has_account: false, curator_id: null, preapproved: true }),
  registration_to_lineup: () => 'evv-new',
  feedback_to_lineup: () => 'evv-new',
  academy_progress_summary: (a) => ({ lessons_done: 4, lessons_total: 6, assignments_passed: 2, assignments_total: a.p_user && a.p_user !== 'u-s1' ? 2 : 3, quizzes_passed: 1, quizzes_total: 2, sessions_attended: 4, sessions_total: 4, custom_checked: [] }),
  academy_call_report: () => [
    { user_id: 'u-s1', full_name: 'Danielle Brooks', email: 'danielle@example.com', joins: 1, first_join: day(-6, 19, 1), last_leave: day(-6, 20), minutes: 59, attendance: 'present' },
    { user_id: 'u-s2', full_name: 'Aaliyah Grant', email: 'aaliyah@example.com', joins: 2, first_join: day(-6, 19, 12), last_leave: day(-6, 20), minutes: 44.5, attendance: 'late' },
    { user_id: 'u-s3', full_name: 'Keisha Monroe', email: 'keisha@example.com', joins: 1, first_join: day(-6, 19, 3), last_leave: day(-6, 19, 50), minutes: 47, attendance: 'present' },
  ],
  crm_timeline: () => [
    { id: 'x1', kind: 'live_class', title: 'Attended “Offer workshop” live · 59 min', source: 'live class', occurred_at: day(-6, 20) },
    { id: 'x2', kind: 'calendly_session', title: 'Booked a private mentorship session', source: 'calendly', occurred_at: day(-8) },
    { id: 'x3', kind: 'enrolled', title: 'Enrolled in the Business Mentorship', source: 'enrollment', occurred_at: day(-45) },
    { id: 'x4', kind: 'calendly_intro', title: 'Booked a mentorship intro call', source: 'calendly', occurred_at: day(-52) },
    { id: 'x5', kind: 'subscribed', title: 'Joined the collective list', source: 'popup', occurred_at: day(-70) },
  ],
  academy_verify_certificate: () => [{ recipient_name: 'Keisha Monroe', title: 'Certificate of Completion', program_title: 'Business Mentorship', issued_at: day(-10) }],
};

const fns = {
  'studio-zernio': (b) => {
    if (b.action === 'overview') return studio.overview;
    if (b.action === 'posts') return studio.posts;
    if (b.action === 'inbox') return { conversations: [
      { id: 'cv1', accountId: 'ig', platform: 'instagram', name: 'Sample Follower', username: 'sample.follower', last: 'When is the next market? 😍', updatedAt: iso(-30), unread: 1 },
      { id: 'cv2', accountId: 'fb', platform: 'facebook', name: 'Sample Vendor', last: 'How do I become a curator?', updatedAt: iso(-200), unread: 0 },
    ] };
    if (b.action === 'thread') return { messages: [
      { id: 'tm1', text: 'When is the next market? 😍', direction: 'incoming', at: iso(-31), attachments: [] },
      { id: 'tm2', text: 'Hey there! Our Business and Leadership Luncheon date is coming soon — you can get notified at p31market.com/calendar. — Carla', direction: 'outgoing', at: iso(-30), attachments: [] },
    ] };
    if (b.action === 'comments') return { posts: (studio.posts.published[0]?.posts || []).slice(0, 5).map((p, i) => ({ id: p.id, accountId: 'ig', platform: 'instagram', text: p.message, picture: p.picture, comments: [3, 1, 4, 2, 0][i], at: p.createdTime, permalink: p.permalink })) };
    if (b.action === 'postComments') return { comments: [{ id: 'cm1', text: 'Can’t wait! 🤍', from: 'sample.follower', at: iso(-60), likes: 2, replies: 1 }] };
    if (b.action === 'audio') return { trending: !b.q, audio: [
      { id: 'demo-audio-1', title: 'Sample Track', artist: 'Sample Artist', type: 'music', durationMs: 31000, artwork: null, preview: null },
      { id: 'demo-audio-2', title: 'Another Sample', artist: 'Sample Band', type: 'music', durationMs: 28000, artwork: null, preview: null },
    ] };
    if (b.action === 'limit') return { used: 3, total: 100, windowSeconds: 86400 };
    if (b.action === 'create') return { post: { id: 'demo-post', scheduledFor: b.scheduledFor, status: 'scheduled', platforms: (b.platforms || []).map((p) => ({ platform: p, status: 'scheduled' })) } };
    return {};
  },
  'ai-assist': (b) => {
    if (b.task === 'post_pack') return { options: [JSON.stringify({ hooks: ['Two weeks until the Luncheon', 'The room is almost ready', 'You have to see this'], captions: ['Sample caption one.', 'Sample caption two.', 'Sample caption three.'], hashtags: ['#p31market', '#atlantamarkets', '#womenowned'], first_comment: 'Save your spot: link in bio', best_time: 'Evenings midweek tend to do best (sample).' })] };
    if (b.task === 'product_promo') return { options: [JSON.stringify({ hooks: ['The cake that sells out first', 'Lemon, butter, Sunday', 'Gift it before it is gone'], captions: ['Sample caption one about the cake.', 'Sample caption two.', 'Sample caption three.'], story: 'Back this week: lemon pound cake', hashtags: ['#poundcake', '#gwinnettbakery', '#womenowned', '#p31market', '#handmadegifts'], email_subject: 'Lemon pound cake is back', email_body: 'Sample email body from the maker.', sms: 'Lemon pound cake is back this week. Grab yours:', best_time: 'Sunday afternoon and weekday evenings (sample).' })] };
    if (b.task === 'shop_email') return { options: ['Lemon pound cake is back\nSample email body, paragraph one.\n\nParagraph two with a call to action.'] };
    if (b.task === 'month_plan') return { options: [JSON.stringify([{ day: 3, kind: 'reel', pillar: 'Market countdown', theme: 'Sample idea', hook: 'Sample hook', caption: 'Sample caption', hashtags: '#sample' }, { day: 10, kind: 'photo', pillar: 'Curator spotlight', theme: 'Sample idea two', hook: 'Sample hook two', caption: 'Sample caption two', hashtags: '#sample' }])] };
    return { options: ['Sample draft one.', 'Sample draft two.'] };
  },
  'daily-room': () => ({ error: 'Demo mode — live rooms open on the real site.' }),
  'shop-broadcast': (b) => ({ ok: true, sent: b.test ? 1 : 3, test: !!b.test }),
  'studio-autocreate': (b) => ({ ok: true, drafted: 18, month: b.month, start: `${b.month}-12` }),
  'email-send': (b) => (b.action === 'redraft'
    ? { ok: true, draft: { reply: `Hi there,

(Demo) Carla rewrote this${b.instruction ? `: ${b.instruction}` : ''}.

Warmly,
Carla`, category: 'general', summary: 'Demo', needs_human: false, reason: '' } }
    : { ok: true }),
};

// ── A tiny query builder that answers like Supabase ─────────
class Query {
  constructor(table, mode) { this.table = table; this.mode = mode; this.filters = []; this.sorts = []; this.max = null; this.one = 0; this.head = false; this.op = 'select'; }
  select(_c, opts) { if (opts?.head) this.head = true; return this; }
  eq(c, v) { this.filters.push((r) => r[c] === undefined || r[c] === v); return this; }
  neq(c, v) { this.filters.push((r) => r[c] !== v); return this; }
  in(c, vs) { this.filters.push((r) => r[c] === undefined || vs.includes(r[c])); return this; }
  is(c, v) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  not(c, op, v) { if (op === 'is' && v === null) this.filters.push((r) => r[c] != null); return this; }
  gte(c, v) { this.filters.push((r) => r[c] === undefined || r[c] >= v); return this; }
  gt(c, v) { this.filters.push((r) => r[c] === undefined || r[c] > v); return this; }
  lte(c, v) { this.filters.push((r) => r[c] === undefined || r[c] <= v); return this; }
  lt(c, v) { this.filters.push((r) => r[c] === undefined || r[c] < v); return this; }
  contains(c, arr) { this.filters.push((r) => Array.isArray(r[c]) && arr.every((x) => r[c].includes(x))); return this; }
  match(obj) { Object.entries(obj).forEach(([c, v]) => this.eq(c, v)); return this; }
  filter() { return this; } or() { return this; } ilike() { return this; } like() { return this; } range() { return this; } textSearch() { return this; }
  order(c, o = {}) { this.sorts.push([c, o.ascending !== false]); return this; }
  limit(n) { this.max = n; return this; }
  single() { this.one = 1; return this; }
  maybeSingle() { this.one = 2; return this; }
  insert(rows) { this.op = 'insert'; this.rows = rows; return this; }
  upsert(rows) { this.op = 'insert'; this.rows = rows; return this; }
  update() { this.op = 'update'; return this; }
  delete() { this.op = 'delete'; return this; }
  run() {
    if (this.op !== 'select') {
      const row = { id: `demo-${Math.random().toString(36).slice(2, 8)}`, ...(Array.isArray(this.rows) ? this.rows[0] : this.rows) };
      return { data: this.one ? row : [row], error: null };
    }
    let rows = (db[this.table] || []).filter((r) => this.filters.every((f) => f(r)));
    for (const [c, asc] of [...this.sorts].reverse()) rows = [...rows].sort((a, b) => ((a[c] ?? '') > (b[c] ?? '') ? 1 : (a[c] ?? '') < (b[c] ?? '') ? -1 : 0) * (asc ? 1 : -1));
    if (this.max) rows = rows.slice(0, this.max);
    if (this.head) return { data: null, count: rows.length, error: null };
    if (this.one) return { data: rows[0] || null, error: rows[0] || this.one === 2 ? null : { code: 'PGRST116', message: 'No rows' } };
    return { data: rows, count: rows.length, error: null };
  }
  then(ok, fail) { return Promise.resolve(this.run()).then(ok, fail); }
}

export function demoClient(mode) {
  now = Date.now();
  db = makeDb();
  const user = userFor(mode);
  const session = { user, access_token: 'demo', token_type: 'bearer' };
  const sub = { data: { subscription: { unsubscribe() {} } } };
  return {
    from: (t) => new Query(t, mode),
    rpc: (name, args = {}) => Promise.resolve({ data: rpc[name] ? rpc[name](args, mode) : null, error: null }),
    functions: { invoke: (name, opts = {}) => Promise.resolve(fns[name] ? (fns[name](opts.body || {})?.error ? { data: null, error: { message: fns[name](opts.body || {}).error, context: { json: async () => ({ error: fns[name](opts.body || {}).error }) } } } : { data: fns[name](opts.body || {}), error: null }) : { data: {}, error: null }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session }, error: null }),
      getUser: () => Promise.resolve({ data: { user }, error: null }),
      onAuthStateChange: (cb) => { setTimeout(() => cb('SIGNED_IN', session), 0); return sub; },
      signInWithPassword: () => Promise.resolve({ data: { session }, error: null }),
      signUp: () => Promise.resolve({ data: { session }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      resetPasswordForEmail: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
    },
    channel: () => { const ch = { on: () => ch, subscribe: () => ch }; return ch; },
    removeChannel: () => {},
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }),
      list: async (folder = '') => ({ data: folder.endsWith('/music') ? [{ name: '1700000000000-Sample_Track.mp3' }] : [], error: null }), createSignedUrl: async () => ({ data: { signedUrl: '#' }, error: null }), getPublicUrl: () => ({ data: { publicUrl: '#' } }) }) },
  };
}
