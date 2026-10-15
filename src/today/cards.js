// What needs attention, per dashboard and per site. Each loader returns cards for
// AttentionCard; a card whose data this person can't read is left out. Shared by
// Today (the team's home) and the Systems overview.
import {
  ClipboardCheck, MessageCircle, PhoneCall, Video, UserPlus, Store, Receipt, Activity, Inbox, CalendarClock, Mail, Film, CheckCircle2, FileSignature, ShieldAlert,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { studio } from '../studio/api';

export const ago = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
export const when = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 864e5);
  const day = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === tomorrow.toDateString() ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

export async function mentorCards(slug) {
  const { data: prog } = await supabase.from('academy_programs').select('id').eq('slug', slug).maybeSingle();
  if (!prog) return [];
  const base = `/academy/${slug}/teach`;
  const horizon = new Date(Date.now() + 864e5);
  horizon.setHours(23, 59, 59, 0);
  const [review, subs, roster, inbox, calls, sessions] = await Promise.all([
    supabase.rpc('academy_awaiting_review', { p_program: prog.id }),
    supabase.from('academy_submissions').select('id, title, student_id, created_at').eq('program_id', prog.id).eq('status', 'submitted').order('created_at').limit(4),
    supabase.rpc('academy_roster', { p_program: prog.id }),
    supabase.rpc('academy_inbox', { p_program: prog.id }),
    supabase.from('academy_inquiries').select('id, full_name, preferred_times, created_at').eq('program_id', prog.id).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('academy_sessions').select('id, title, starts_at, student_id').eq('program_id', prog.id)
      .gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).lte('starts_at', horizon.toISOString()).order('starts_at').limit(4),
  ]);
  const names = Object.fromEntries((roster.data || []).map((r) => [r.user_id, r.full_name || r.email]));
  const unread = (inbox.data || []).filter((t) => t.unread > 0);
  return [
    !review.error && {
      key: 'grade', site: 'collective', Icon: ClipboardCheck, title: 'Work to grade', count: review.data || 0, to: `${base}/gradebook`, cta: 'Open the gradebook', empty: 'Nothing waiting for feedback.',
      items: (subs.data || []).map((s) => ({ key: s.id, title: s.title, sub: `${names[s.student_id] || 'A student'} · handed in ${ago(s.created_at)}` })),
    },
    !inbox.error && {
      key: 'messages', site: 'collective', Icon: MessageCircle, title: 'Student messages', count: unread.reduce((n, t) => n + t.unread, 0), to: `${base}/inbox`, cta: 'Open messages', empty: 'You’re all caught up.',
      items: unread.map((t) => ({ key: t.student_id, title: t.full_name || t.email, sub: t.last_body || 'New message', to: `${base}/inbox/${t.student_id}` })),
    },
    !calls.error && {
      key: 'calls', site: 'collective', Icon: PhoneCall, title: 'New intro calls', count: (calls.data || []).length, to: `${base}/calls`, cta: 'All requests', empty: 'No new requests.',
      items: (calls.data || []).map((c) => ({ key: c.id, title: c.full_name, sub: `${c.preferred_times || 'No times given'} · ${ago(c.created_at)}` })),
    },
    !sessions.error && {
      key: 'live', site: 'collective', Icon: Video, title: 'Classes today & tomorrow', count: (sessions.data || []).length, to: `${base}/sessions`, cta: 'Sessions & Go live', empty: 'Nothing scheduled. Go live anytime from Sessions.', tone: 'night',
      items: (sessions.data || []).map((s) => ({ key: s.id, title: s.title, sub: `${when(s.starts_at)} · ${s.student_id ? '1:1' : 'group class'}` })),
    },
  ].filter(Boolean);
}

/** p31market.com: orders, vendor applications, shops waiting for review, and the signed forms waiting on the team. */
export async function marketCards() {
  const [orders, vendors, curators, agreements, registrations, volunteers] = await Promise.all([
    supabase.from('orders').select('id, product_name, buyer_name, created_at', { count: 'exact' }).eq('fulfillment_status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('vendor_applications').select('id, full_name, business_name, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('curator_data').select('id, business_name, created_at', { count: 'exact' }).eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
    supabase.from('vendor_agreements').select('id, business_name, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('vendor_registrations').select('id, business_name, event_label, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('volunteer_signups').select('id, first_name, last_name, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
  ]);
  const forms = [agreements, registrations, volunteers].every((x) => !x.error) && {
    key: 'forms', site: 'market', Icon: FileSignature, title: 'Vendor forms', to: '/systems/forms', cta: 'Open vendor forms', empty: 'No new agreements, registrations or volunteers.',
    count: (agreements.count ?? 0) + (registrations.count ?? 0) + (volunteers.count ?? 0),
    items: [
      ...(agreements.data || []).map((a) => ({ key: a.id, title: a.business_name, sub: `Storefront agreement · ${ago(a.created_at)}`, to: '/systems/forms?tab=agreements', at: a.created_at })),
      ...(registrations.data || []).map((r) => ({ key: r.id, title: r.business_name, sub: `Registered for ${r.event_label} · ${ago(r.created_at)}`, to: '/systems/forms?tab=registrations', at: r.created_at })),
      ...(volunteers.data || []).map((v) => ({ key: v.id, title: `${v.first_name} ${v.last_name}`, sub: `Volunteer · ${ago(v.created_at)}`, to: '/systems/forms?tab=volunteers', at: v.created_at })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 4),
  };
  return [
    !orders.error && {
      key: 'orders', site: 'market', Icon: Receipt, title: 'New orders', count: orders.count ?? (orders.data || []).length, to: '/systems/orders', cta: 'Open orders', empty: 'No new orders.',
      items: (orders.data || []).map((o) => ({ key: o.id, title: o.product_name || 'Order', sub: `${o.buyer_name || 'A shopper'} · ${ago(o.created_at)}` })),
    },
    !vendors.error && {
      key: 'vendors', site: 'market', Icon: Store, title: 'Vendor applications', count: vendors.count ?? (vendors.data || []).length, to: '/systems/vendors', cta: 'Review vendors', empty: 'No new vendor applications.',
      items: (vendors.data || []).map((v) => ({ key: v.id, title: v.business_name, sub: `${v.full_name} · ${ago(v.created_at)}` })),
    },
    !curators.error && {
      key: 'curators', site: 'market', Icon: Store, title: 'Shops to review', count: curators.count ?? (curators.data || []).length, to: '/systems/shops', cta: 'Open Curators & shops', empty: 'No shops waiting for review.',
      items: (curators.data || []).map((c) => ({ key: c.id, title: c.business_name || 'New shop', sub: `Applied ${ago(c.created_at)}` })),
    },
    forms,
  ].filter(Boolean);
}

/** thep31collective.org: membership applications, plus the Studio inboxes when this person can read them. */
export async function collectiveCards() {
  const [apps, mail, inbox, posts] = await Promise.allSettled([
    supabase.from('collective_applications').select('id, full_name, city_state, created_at', { count: 'exact' }).eq('status', 'new').order('created_at', { ascending: false }).limit(4),
    supabase.from('email_threads').select('id, contact_name, contact_email, subject, needs_human, last_message_at', { count: 'exact' }).eq('status', 'needs_reply').order('last_message_at', { ascending: false }).limit(4),
    studio('inbox'),
    studio('posts'),
  ]);
  const out = [];
  if (apps.status === 'fulfilled' && !apps.value.error) {
    const a = apps.value;
    out.push({
      key: 'applications', site: 'collective', Icon: UserPlus, title: 'Join applications', count: a.count ?? (a.data || []).length, to: '/systems/applications', cta: 'Review applications', empty: 'No new applications.',
      items: (a.data || []).map((x) => ({ key: x.id, title: x.full_name, sub: `${x.city_state} · ${ago(x.created_at)}` })),
    });
  }
  if (mail.status === 'fulfilled' && !mail.value.error) {
    out.push({
      key: 'email', site: 'collective', Icon: Mail, title: 'Emails to answer', count: mail.value.count ?? (mail.value.data || []).length, to: '/studio/email', cta: 'Open Email', empty: 'No emails waiting. Carla drafts replies as they arrive.',
      items: (mail.value.data || []).map((m) => ({ key: m.id, title: `${m.needs_human ? '⚑ ' : ''}${m.contact_name || m.contact_email}`, sub: `${m.subject} · ${ago(m.last_message_at)}` })),
    });
  }
  if (inbox.status === 'fulfilled') {
    const unread = (inbox.value?.conversations || []).filter((c) => c.unread > 0);
    out.push({
      key: 'dms', site: 'collective', Icon: Inbox, title: 'Unread DMs', count: unread.reduce((n, c) => n + c.unread, 0), to: '/studio/inbox', cta: 'Open messages', empty: 'No unread DMs.',
      items: unread.map((c) => ({ key: c.id, title: c.name || c.username || 'Someone', sub: `${c.platform} · ${c.last || 'New message'}` })),
    });
  }
  if (posts.status === 'fulfilled') {
    const until = Date.now() + 2 * 864e5;
    const next = (posts.value?.scheduled || []).filter((p) => p.scheduledFor && new Date(p.scheduledFor) <= until)
      .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
    out.push({
      key: 'posts', site: 'collective', Icon: CalendarClock, title: 'Posts going out', count: next.length, to: '/studio/calendar', cta: 'Open the calendar', empty: 'Nothing scheduled for the next two days.',
      items: next.map((p) => ({ key: p.id, title: (p.content || p.title || 'Post').replace(/\s+/g, ' ').slice(0, 80), sub: when(p.scheduledFor) })),
    });
  }
  return out;
}

/** Both sites: errors visitors hit. */
export async function healthCards() {
  const [errors, alerts] = await Promise.all([
    supabase.from('app_errors').select('*', { count: 'exact' }).is('resolved_at', null).order('last_seen', { ascending: false }).limit(4),
    supabase.from('ops_alerts').select('*', { count: 'exact' }).is('resolved_at', null).order('severity').order('first_seen').limit(4),
  ]);
  // The watchdog's open alerts (v45): what needs a person, each with how to fix it.
  const watch = alerts.error ? [] : [{
    key: 'watchdog', site: 'both', Icon: ShieldAlert, title: 'System check', count: alerts.count ?? (alerts.data || []).length, to: '/systems/health', cta: 'Open the watchdog', empty: 'The hourly check found nothing wrong.', tone: 'alert',
    items: (alerts.data || []).map((a) => ({ key: a.id, title: a.title, sub: `${a.severity === 'fail' ? 'Needs attention' : 'Heads up'} · since ${ago(a.first_seen)}` })),
  }];
  if (errors.error) return watch;
  return [...watch, {
    key: 'errors', site: 'both', Icon: Activity, title: 'Site errors', count: errors.count ?? (errors.data || []).length, to: '/systems/health', cta: 'Open Health', empty: 'Both sites are running clean.', tone: 'alert',
    items: (errors.data || []).map((e) => ({ key: e.id, title: e.message, sub: `${e.path || 'unknown page'} · ${e.count}× · ${ago(e.last_seen)}` })),
  }];
}

/** Everything Systems reports on Today: market, then collective (minus the Studio inboxes, which the Studio section shows), then health. */
export async function systemsCards() {
  const [m, c, h] = await Promise.all([marketCards(), collectiveCards(), healthCards()]);
  return [...m, ...c.filter((x) => x.key === 'applications'), ...h];
}

/** A team member's Systems cards: only the ones her dashboards open (pages = her Systems paths). */
export async function teamCards(pages) {
  const [m, c] = await Promise.all([marketCards(), collectiveCards()]);
  return [...m, ...c.filter((x) => x.key === 'applications')].filter((x) => pages.some((p) => x.to.startsWith(p)));
}

export async function studioCards() {
  const c = await collectiveCards();
  return c.filter((x) => x.key !== 'applications');
}

export async function davinciCards() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [working, ready] = await Promise.all([
    supabase.from('pro_edit_jobs').select('id, title, status, error, created_at', { count: 'exact' }).in('status', ['queued', 'processing', 'failed']).order('created_at', { ascending: false }).limit(4),
    supabase.from('pro_edit_jobs').select('id, title, updated_at', { count: 'exact' }).eq('status', 'done').gte('updated_at', since).order('updated_at', { ascending: false }).limit(4),
  ]);
  const label = { queued: 'Waiting for Iris', processing: 'Editing in DaVinci', failed: 'Needs attention' };
  return [
    !working.error && {
      key: 'working', site: 'both', Icon: Film, title: 'In the DaVinci queue', count: working.count ?? (working.data || []).length, to: '/systems/pro-edit', cta: 'Open DaVinci', empty: 'Nothing waiting. Find clips in some new footage.',
      tone: (working.data || []).some((j) => j.status === 'failed') ? 'alert' : null,
      items: (working.data || []).map((j) => ({ key: j.id, title: j.title || 'Untitled edit', sub: `${label[j.status]} · ${ago(j.created_at)}` })),
    },
    !ready.error && {
      key: 'ready', site: 'both', Icon: CheckCircle2, title: 'Finished this week', count: ready.count ?? (ready.data || []).length, to: '/systems/pro-edit', cta: 'Download finished clips', empty: 'No finished edits this week yet.',
      items: (ready.data || []).map((j) => ({ key: j.id, title: j.title || 'Edit', sub: `Ready ${ago(j.updated_at)}` })),
    },
  ].filter(Boolean);
}
