// The dashboards a team member can be given, and what each one opens. One list for the
// Systems menu, the Team page, the member portal, Today and the walkthroughs.
//
// Admins (site admins and Systems operators) always have every dashboard. Everyone else gets
// exactly the ones an admin switches on for the email they sign in with (team_access.tools).
import { Clapperboard, Megaphone, Mail, GraduationCap, Users, ClipboardList, CalendarDays, Receipt, Store, Film } from 'lucide-react';
import { DAVINCI_ON } from './features';

export const DASHBOARDS = [
  {
    id: 'studio', label: 'Content creator', short: 'Content', site: 'both', Icon: Clapperboard,
    blurb: 'Content Studio: plan the month, auto-create posts, write and schedule reels and photos, cut clips, stage product photos.',
    opens: [{ to: '/studio', label: 'Content Studio' }], systems: ['/systems/photos', '/systems/clips'], tour: 'studio',
  },
  {
    id: 'social', label: 'Social media manager', short: 'Social', site: 'both', Icon: Megaphone,
    blurb: 'Scheduled posts and history on every platform, the Instagram and Facebook messages and comments, and growth outreach.',
    opens: [{ to: '/studio/inbox', label: 'Messages & comments' }], systems: ['/systems/social', '/systems/growth'], tour: 'social',
  },
  {
    id: 'emails', label: 'Emails', short: 'Emails', site: 'both', Icon: Mail,
    blurb: 'The shared inboxes (members@ and vendor@) with drafted replies, and email campaigns to shoppers, curators and members.',
    opens: [{ to: '/studio/email', label: 'Email inbox' }], systems: ['/systems/campaigns'], tour: 'emails',
  },
  {
    id: 'classroom', label: 'Classroom', short: 'Classroom', site: 'collective', Icon: GraduationCap,
    blurb: 'The mentorship consoles: students, lessons and videos, sessions and recordings, grading, intro calls and enrollment invites.',
    opens: [{ to: '/academy/business/teach', label: 'Business Mentorship console' }, { to: '/academy/faith/teach', label: 'Faith Mentorship console' }],
    systems: ['/systems/academy'], tour: 'classroom',
  },
  {
    id: 'people', label: 'People & applications', short: 'People', site: 'collective', Icon: Users,
    blurb: 'Join applications for The P31 Collective, and everyone who has reached P31 with their history.',
    opens: [], systems: ['/systems/applications', '/systems/crm'], tour: 'people',
  },
  {
    id: 'vendors', label: 'Vendors & forms', short: 'Vendors', site: 'market', Icon: ClipboardList,
    blurb: 'Vendor applications, storefront agreements, market registrations, feedback surveys and volunteer sign-ups.',
    opens: [], systems: ['/systems/vendors', '/systems/forms'], tour: 'vendors',
  },
  {
    id: 'events', label: 'Markets & events', short: 'Events', site: 'market', Icon: CalendarDays,
    blurb: 'Market dates, RSVPs, vendor lineups, booths and check-in on the day.',
    opens: [], systems: ['/systems/events'], tour: 'events',
  },
  {
    id: 'orders', label: 'Orders', short: 'Orders', site: 'market', Icon: Receipt,
    blurb: 'Every marketplace order: confirm, fulfil, cancel, export.',
    opens: [], systems: ['/systems/orders'], tour: 'orders',
  },
  {
    id: 'shops', label: 'Curators & shops', short: 'Shops', site: 'market', Icon: Store,
    blurb: 'Every shop on p31market.com: approve or pause, feature, badges, the vendor note, products and the signed agreement.',
    opens: [], systems: ['/systems/shops'], tour: 'shops',
  },
  {
    id: 'davinci', label: 'DaVinci', short: 'DaVinci', site: 'both', Icon: Film,
    blurb: DAVINCI_ON ? 'Long footage in, finished clips out, edited by Iris in DaVinci Resolve.' : 'Long footage in, finished clips out (paused for now; access is kept for when it returns).',
    opens: [], systems: ['/systems/pro-edit'], tour: 'davinci', paused: !DAVINCI_ON,
  },
];

export const DASH = Object.fromEntries(DASHBOARDS.map((d) => [d.id, d]));
export const ALL_DASHBOARD_IDS = DASHBOARDS.map((d) => d.id);

/** The dashboards this person has (admins and Systems operators: all of them). */
export const dashboardsOf = (roles) => (roles?.admin || roles?.operator ? ALL_DASHBOARD_IDS : (roles?.tools || []).filter((t) => DASH[t]));
export const hasDash = (roles, id) => dashboardsOf(roles).includes(id);
export const hasAnyDash = (roles, ids) => ids.some((id) => hasDash(roles, id));

/** The Systems pages a set of dashboards unlocks. */
export const systemsPagesFor = (ids) => [...new Set(ids.flatMap((id) => DASH[id]?.systems || []))];

/** Which site a login belongs to, from the mailbox it uses. */
export const siteOfEmail = (email = '') => (/@p31market\.com$/i.test(email) ? 'market' : /@thep31collective\.org$/i.test(email) ? 'collective' : 'both');

/** Suggested dashboards for a login, from the role on the team directory and the mailbox's site. */
export const suggestDashboards = (roleTitle = '', email = '') => {
  const site = siteOfEmail(email);
  const r = roleTitle.toLowerCase();
  const market = site !== 'collective';
  const collective = site !== 'market';
  if (/founder|ceo|owner/.test(r)) return ALL_DASHBOARD_IDS;
  if (/marketing|content|social/.test(r)) return ['studio', 'social'];
  if (/tech|support|troubleshoot/.test(r) && market) return ['shops', 'vendors', 'orders', 'davinci'];
  if (/assistant|secretary|admin/.test(r)) return [...(collective ? ['people', 'emails', 'classroom'] : []), ...(market ? ['vendors', 'events', 'orders', 'emails'] : [])];
  if (/liaison|member|community|event/.test(r)) return [...(collective ? ['people', 'emails'] : []), ...(market ? ['events', 'vendors'] : [])];
  if (/coordinator|grant|partner|operations/.test(r)) return [...(collective ? ['people'] : []), ...(market ? ['vendors', 'events', 'orders'] : [])];
  if (/mentor|teacher|coach/.test(r)) return ['classroom'];
  return [];
};
