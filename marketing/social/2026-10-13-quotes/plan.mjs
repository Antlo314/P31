// The "Push me God" collection: 48 quote cards in the CEO's Canva look (src/studio/design/collection.js),
// two a day from Tue Oct 13 to Thu Nov 5, 2026, at open best times (Eastern). Each day already
// has one post from the October calendars; these slots keep at least two and a half hours clear
// of it where the day allows. Curator and mentorship invitations land about every fourth post.
import { COLLECTION, captionsFor } from '../../../src/studio/design/collection.js';

export const CALENDAR = '2026-10-13-quotes';
export const TIMEZONE = 'America/New_York';
export const ACCOUNTS = { instagram: '6ac6716d90b16e751447d7fe', facebook: '6ac67950507b603704a87454' };

const SLOTS = [
  ['2026-10-13', '16:00'], ['2026-10-13', '20:00'],
  ['2026-10-14', '15:00'], ['2026-10-14', '19:30'],
  ['2026-10-15', '12:30'], ['2026-10-15', '19:30'],
  ['2026-10-16', '15:30'], ['2026-10-16', '19:30'],
  ['2026-10-17', '13:00'], ['2026-10-17', '20:30'],
  ['2026-10-18', '13:00'], ['2026-10-18', '21:00'],
  ['2026-10-19', '12:30'], ['2026-10-19', '21:00'],
  ['2026-10-20', '12:30'], ['2026-10-20', '19:30'],
  ['2026-10-21', '12:30'], ['2026-10-21', '17:30'],
  ['2026-10-22', '15:30'], ['2026-10-22', '19:30'],
  ['2026-10-23', '12:30'], ['2026-10-23', '17:30'],
  ['2026-10-24', '13:00'], ['2026-10-24', '20:30'],
  ['2026-10-25', '16:00'], ['2026-10-25', '19:30'],
  ['2026-10-26', '12:30'], ['2026-10-26', '21:00'],
  ['2026-10-27', '12:30'], ['2026-10-27', '17:30'],
  ['2026-10-28', '15:00'], ['2026-10-28', '19:30'],
  ['2026-10-29', '12:30'], ['2026-10-29', '17:30'],
  ['2026-10-30', '15:30'], ['2026-10-30', '19:30'],
  ['2026-10-31', '13:00'], ['2026-10-31', '20:30'],
  ['2026-11-01', '16:00'], ['2026-11-01', '19:30'],
  ['2026-11-02', '12:30'], ['2026-11-02', '21:00'],
  ['2026-11-03', '12:30'], ['2026-11-03', '17:30'],
  ['2026-11-04', '15:00'], ['2026-11-04', '19:30'],
  ['2026-11-05', '12:30'], ['2026-11-05', '17:30'],
];

const alt = (p) => {
  const w = p.words;
  switch (p.template) {
    case 'scripture': return `${w.verse} ${w.reference}, King James Version. @Proverbs31Market`;
    case 'prayer': return `${w.intro} ${w.headline} @Proverbs31Market`;
    case 'invite': return `${w.eyebrow}. ${w.headline} ${w.body} ${w.button}.`;
    case 'blank': return `${w.eyebrow}: ${w.headline} blank. ${w.ask}.`;
    default: return `@Proverbs31Market: ${w.headline}`;
  }
};

const label = (day, time) => new Date(`${day}T${time}:00`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const POSTS = COLLECTION.map((p, i) => {
  const [day, time] = SLOTS[i];
  return { ...p, when: `${day}T${time}:00`, label: label(day, time), alt: alt(p), ...captionsFor(p) };
});
