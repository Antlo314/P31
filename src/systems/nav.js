import { LayoutGrid, Megaphone, Radar, Clapperboard, ImagePlus, Film, Settings, CalendarDays, Mail, Receipt, GraduationCap, Users } from 'lucide-react';

export const SYSTEMS_NAV = [
  { to: '/systems', label: 'Overview', Icon: LayoutGrid, end: true },
  { to: '/systems/crm', label: 'CRM', Icon: Users },
  { to: '/systems/social', label: 'Social', Icon: Megaphone },
  { to: '/systems/growth', label: 'Growth', Icon: Radar },
  { to: '/systems/events', label: 'Events', Icon: CalendarDays },
  { to: '/systems/campaigns', label: 'Campaigns', Icon: Mail },
  { to: '/systems/orders', label: 'Orders', Icon: Receipt },
  { to: '/systems/academy', label: 'Academy', Icon: GraduationCap },
  { to: '/systems/clips', label: 'Clips', Icon: Clapperboard },
  { to: '/systems/photos', label: 'Photos', Icon: ImagePlus },
  { to: '/systems/pro-edit', label: 'Pro Edit', Icon: Film },
  { to: '/systems/settings', label: 'Settings', Icon: Settings },
];
