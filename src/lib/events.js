import { supabase } from './supabase';

// Each market's real date/time only appears publicly once the team turns on
// "Date announced" for it in Systems → Events (market_events.date_public).
// Until then the site says "Coming soon".
export const showDate = (ev) => !!ev?.date_public;

// Today's date as YYYY-MM-DD in the visitor's local time zone.
const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// market_events.event_date is a plain DATE ('2026-12-27'). new Date() would
// read that as UTC midnight and show the previous day in US time zones, so
// build it as a local date instead.
export const parseEventDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatEventDate = (iso, options = { month: 'long', day: 'numeric', year: 'numeric' }) =>
  parseEventDate(iso).toLocaleDateString('en-US', options);

// Active markets dated today or later, soonest first.
export const fetchUpcomingEvents = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('market_events')
    .select('*')
    .eq('is_active', true)
    .gte('event_date', todayISO())
    .order('event_date', { ascending: true });
  if (error) {
    console.warn('Market events fetch error:', error.message);
    return [];
  }
  return data || [];
};
