// The mentorship programs, one list for the classroom, the mentor consoles, the portal, Today,
// The Gathering badges and the walkthroughs. Slugs match academy_programs.slug.
//
// Names and classroom features only: this file ships in the public site, so never prices, savings
// or plan details here (those stay in the database and on the private enrollment link).
// The public program pages (/mentorship/:slug) are separate: src/academy/content.js.
//
// features:
//   goals   Goals, Action plans and the "Next steps" card on the classroom home (business style)
//   work    Submit work for feedback
//   journal Private journal (prayer, reflection, gratitude); session tasks are "My tasks"
//   verse   Today's verse card on the classroom home
export const PROGRAMS = {
  business: { name: 'Business Mentorship', short: 'Business', features: ['goals', 'work'] },
  faith: { name: 'Faith-Based Mentorship', short: 'Faith', features: ['journal', 'verse'] },
  // Faith-style classroom for now; Melanie confirms journal or goals for couples.
  couples: { name: 'Couples Private Mentorship', short: 'Couples', features: ['journal', 'verse'] },
};

export const PROGRAM_SLUGS = Object.keys(PROGRAMS);

/** A program the site knows by slug (it may not have its database row yet). */
export const isProgram = (slug) => Object.prototype.hasOwnProperty.call(PROGRAMS, slug);

/** "Couples Private Mentorship"; an unknown slug falls back to the given title, then the slug. */
export const programName = (slug, fallback) => (isProgram(slug) ? PROGRAMS[slug].name : fallback || slug);

/** "Couples", for tabs, badges and console labels. */
export const programShort = (slug, fallback) => (isProgram(slug) ? PROGRAMS[slug].short : fallback || slug);

/** Does this program's classroom have a feature (goals, work, journal, verse)? */
export const hasFeature = (slug, feature) => isProgram(slug) && PROGRAMS[slug].features.includes(feature);
