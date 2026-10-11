import {
  LayoutGrid, Megaphone, Radar, Clapperboard, ImagePlus, Film, Settings, CalendarDays, Mail, Receipt, GraduationCap, Users, UserPlus,
  Activity, Sparkles, Store, KeyRound, ClipboardList, Inbox, FileSignature, MessagesSquare, Compass,
} from 'lucide-react';
import { DAVINCI_ON } from '../lib/features';

// The two sites the team runs, and the console's rooms, sorted by site.
export const SITES = {
  market: { id: 'market', label: 'Market', title: 'Proverbs 31 Marketplace', host: 'p31market.com', url: 'https://www.p31market.com', blurb: 'The shops, their orders, the vendors and the market days.' },
  collective: { id: 'collective', label: 'Collective', title: 'The P31 Collective', host: 'thep31collective.org', url: 'https://www.thep31collective.org', blurb: 'Membership, mentorship, the people who reach P31 and its voice online.' },
  both: { id: 'both', label: 'Both sites', title: 'Shared', host: 'both sites', url: '', blurb: '' },
};

export const SYSTEMS_HOME = { to: '/systems', label: 'Overview', short: 'Home', Icon: LayoutGrid, end: true, site: 'both', blurb: 'Everything at a glance, by site.' };

// `dash` is the dashboard (src/lib/dashboards.js) that unlocks the item for a team member;
// 'admin' items are for site admins and Systems operators; 'team' items are for every team member.
// `away` items open another dashboard (Content Studio here on the Collective, the curator
// studio on p31market.com). `desktop` items need a computer; phones get an explanation instead.
export const SYSTEMS_GROUPS = [
  {
    id: 'market', site: 'market', label: 'Market', sub: 'p31market.com', items: [
      { to: '/systems/orders', label: 'Orders', Icon: Receipt, site: 'market', dash: 'orders', blurb: 'Every order across the marketplace, live: confirm, fulfil, cancel, export.' },
      { to: '/systems/vendors', label: 'Vendor applications', short: 'Vendors', Icon: ClipboardList, site: 'market', dash: 'vendors', blurb: 'Applications from p31market.com/apply: approve, email, and her studio unlocks.' },
      { to: '/systems/forms', label: 'Vendor forms', short: 'Forms', Icon: FileSignature, site: 'market', dash: 'vendors', blurb: 'Storefront agreements, market registrations, feedback surveys and volunteer sign-ups, signed on the site.' },
      { to: '/systems/events', label: 'Markets & events', short: 'Events', Icon: CalendarDays, site: 'market', dash: 'events', blurb: 'Market dates, RSVPs, vendor lineups, booths and check-in on the day.' },
      { to: '/systems/shops', label: 'Curators & shops', short: 'Shops', Icon: Store, site: 'market', dash: 'shops', blurb: 'Every shop: approve or pause, feature, badges, the vendor note, products and the signed agreement.' },
      { to: '/systems/campaigns', label: 'Campaigns', Icon: Mail, site: 'market', dash: 'emails', blurb: 'Email shoppers and curators, with AI drafts.' },
    ],
  },
  {
    id: 'collective', site: 'collective', label: 'Collective', sub: 'thep31collective.org', items: [
      { to: '/systems/applications', label: 'Join applications', short: 'Join', Icon: UserPlus, site: 'collective', dash: 'people', blurb: '“Join P31 Collective” membership applications: review and reply.' },
      { to: '/systems/academy', label: 'Mentorship', Icon: GraduationCap, site: 'collective', dash: 'classroom', blurb: 'Programs, prices, mentors, members, and each program’s curriculum, videos and sessions.' },
      { to: '/systems/crm', label: 'People', Icon: Users, site: 'collective', dash: 'people', blurb: 'Everyone who has reached P31, first form to alumni, with their history.' },
      { to: '/studio', label: 'Content Studio', Icon: Sparkles, away: true, site: 'collective', dash: 'studio', blurb: 'Instagram & Facebook: plan the month, create, schedule, answer DMs.' },
      { to: '/studio/email', label: 'Email inbox', Icon: Inbox, away: true, site: 'collective', dash: 'emails', blurb: 'members@ and vendor@, with Carla’s drafted replies.' },
      { to: '/gather', label: 'The Gathering', Icon: MessagesSquare, away: true, site: 'collective', dash: 'team', blurb: 'Community chat for vendors, students, mentors and the team, with the Daily Word.' },
    ],
  },
  {
    id: 'create', site: 'both', label: 'Create', sub: 'for both sites', items: [
      { to: '/systems/social', label: 'Social', Icon: Megaphone, site: 'both', dash: 'social', blurb: 'Drafts, scheduled posts and history across every platform.' },
      { to: '/systems/growth', label: 'Growth', Icon: Radar, site: 'both', dash: 'social', blurb: 'Find groups, creators and events that fit P31, and track the outreach.' },
      { to: '/systems/photos', label: 'Photo Studio', Icon: ImagePlus, site: 'both', dash: 'studio', blurb: 'Remove backgrounds, stage products, apply looks. Works on a phone.' },
      { to: '/systems/clips', label: 'Clip Studio', Icon: Clapperboard, site: 'both', dash: 'studio', desktop: true, blurb: 'Raw footage in, a captioned reel out.' },
      { to: '/systems/pro-edit', label: 'DaVinci', Icon: Film, site: 'both', dash: 'davinci', desktop: true, paused: !DAVINCI_ON, blurb: DAVINCI_ON ? 'Long footage in, finished clips out, built by Iris in DaVinci Resolve.' : 'Paused for now. Long footage in, finished clips out, once the DaVinci bridge is on.' },
    ],
  },
  {
    id: 'team', site: 'both', label: 'Team', sub: 'people, help & health', items: [
      { to: '/systems/team', label: 'Team & dashboards', short: 'Team', Icon: KeyRound, site: 'both', dash: 'admin', blurb: 'Who is on the team, which dashboards each login opens, and the site admins.' },
      { to: '/systems/walkthroughs', label: 'Walkthroughs', short: 'Learn', Icon: Compass, site: 'both', dash: 'team', blurb: 'Animated walkthroughs of every function, and the test runs that prove each one works.' },
      { to: '/systems/health', label: 'Health', Icon: Activity, site: 'both', dash: 'admin', blurb: 'Errors visitors hit on either site, as they happen.' },
      { to: '/systems/settings', label: 'Settings', Icon: Settings, site: 'both', dash: 'admin', blurb: 'Your password, the team, and connected services.' },
    ],
  },
];

/** Every Systems page (Overview first), without the links out to other dashboards. */
export const SYSTEMS_NAV = [SYSTEMS_HOME, ...SYSTEMS_GROUPS.flatMap((g) => g.items.filter((n) => !n.away))];

// Phones get the pages an admin reaches for on the go in the bottom bar; "More" has the rest.
export const MOBILE_TABS = ['/systems', '/systems/orders', '/systems/vendors', '/systems/applications'];

/** Can a team member with these dashboards open this item? (Admins can open everything.) */
export const itemAllowed = (n, dashboards, admin) => admin || n.dash === 'team' || (n.dash && n.dash !== 'admin' && dashboards.includes(n.dash));

/** The group and item for a path (null on the overview). */
export const navFor = (pathname) => {
  const path = pathname.replace(/\/+$/, '') || '/';
  let best = null;
  for (const group of SYSTEMS_GROUPS) {
    for (const item of group.items) {
      if (!item.away && (path === item.to || path.startsWith(`${item.to}/`)) && (!best || item.to.length > best.item.to.length)) best = { group, item };
    }
  }
  return best;
};
