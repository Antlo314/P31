import { LayoutGrid, Megaphone, Radar, Clapperboard, ImagePlus, Film, Settings, CalendarDays, Mail, Receipt, GraduationCap, Users, UserPlus, Activity, Sparkles, Store } from 'lucide-react';

export const SYSTEMS_HOME = { to: '/systems', label: 'Overview', Icon: LayoutGrid, end: true };

// The console in four rooms. `away` items open another dashboard (Content Studio here on
// the Collective, curator review on p31market.com) rather than a Systems page.
export const SYSTEMS_GROUPS = [
  {
    id: 'people', label: 'People', items: [
      { to: '/systems/crm', label: 'CRM', Icon: Users },
      { to: '/systems/applications', label: 'Applications', Icon: UserPlus },
      { to: '/systems/academy', label: 'Academy', Icon: GraduationCap },
    ],
  },
  {
    id: 'content', label: 'Content', items: [
      { to: '/studio', label: 'Content Studio', Icon: Sparkles, away: true },
      { to: '/systems/social', label: 'Social', Icon: Megaphone },
      { to: '/systems/clips', label: 'Clips', Icon: Clapperboard },
      { to: '/systems/photos', label: 'Photos', Icon: ImagePlus },
      { to: '/systems/pro-edit', label: 'Pro Edit', Icon: Film },
    ],
  },
  {
    id: 'market', label: 'Market', items: [
      { to: '/systems/events', label: 'Events', Icon: CalendarDays },
      { to: '/systems/orders', label: 'Orders', Icon: Receipt },
      { to: '/dashboard', label: 'Curators', Icon: Store, away: true },
      { to: '/systems/campaigns', label: 'Campaigns', Icon: Mail },
      { to: '/systems/growth', label: 'Growth', Icon: Radar },
    ],
  },
  {
    id: 'admin', label: 'Settings & Health', items: [
      { to: '/systems/health', label: 'Health', Icon: Activity },
      { to: '/systems/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

/** Every Systems page (Overview first), without the links out to other dashboards. */
export const SYSTEMS_NAV = [SYSTEMS_HOME, ...SYSTEMS_GROUPS.flatMap((g) => g.items.filter((n) => !n.away))];
