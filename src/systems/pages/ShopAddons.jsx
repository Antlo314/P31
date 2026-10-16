import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Megaphone, Package, Settings2, Save, Check, CalendarRange } from 'lucide-react';
import { supabase } from '../../lib/supabase';

// Storefront add-ons in Systems > Curators & shops (v53): the CEO pick of the month, the shops on a
// Featured plan and the posts they are owed, product slot packs, and the add-on prices.
const monthOf = (offset = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  d.setDate(1); d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const monthName = (m) => new Date(`${m}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const dollars = (c) => `$${(Number(c || 0) / 100).toFixed(Number(c || 0) % 100 ? 2 : 0)}`;
const POST = { waiting: 'Waiting for her photos', submitted: 'In the planner, ready for review', scheduled: 'Scheduled', posted: 'Posted', skipped: 'Skipped' };

const ShopAddons = ({ shops, admin }) => {
  const [addons, setAddons] = useState(null);
  const [posts, setPosts] = useState([]);
  const [picks, setPicks] = useState({});
  const [terms, setTerms] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [pickMonth, setPickMonth] = useState(monthOf(0));
  const [pickShop, setPickShop] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [a, p, k, t] = await Promise.all([
      supabase.from('shop_addons').select('*').in('status', ['active', 'past_due']).order('created_at'),
      supabase.from('featured_posts').select('*').gte('month', monthOf(-2)).order('month').order('created_at'),
      supabase.from('featured_picks').select('*').in('month', [monthOf(0), monthOf(1)]),
      supabase.from('app_settings').select('value').eq('key', 'addons').maybeSingle(),
    ]);
    if (a.error && /does not exist|schema cache|Could not find/i.test(a.error.message)) { setAddons(false); return; }
    setAddons(a.data || []);
    setPosts(p.data || []);
    setPicks(Object.fromEntries((k.data || []).map((x) => [x.month, x])));
    setTerms(t.data?.value || null);
  };
  useEffect(() => { Promise.resolve().then(load); }, []);

  const name = (id) => shops.find((s) => s.id === id)?.business_name || 'A shop';
  const approved = shops.filter((s) => s.status === 'approved').sort((a, b) => (a.business_name || '').localeCompare(b.business_name || ''));

  const savePick = async (e) => {
    e.preventDefault();
    if (!pickShop) return;
    setError(''); setMsg('');
    const { data: me } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('featured_picks').upsert({ month: pickMonth, curator_id: pickShop, created_by: me.user?.id || null });
    if (err) return setError(err.message);
    setMsg(`${name(pickShop)} is the CEO pick for ${monthName(pickMonth)}.`);
    setPickShop('');
    load();
  };
  const saveTerms = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const cents = (k) => Math.round(Number(f.get(k)) * 100);
    const value = {
      ...terms,
      included_products: Number(f.get('included')) || 10,
      product_packs: (terms.product_packs || []).map((p) => ({ ...p, cents: cents(`pack_${p.key}`) || p.cents })),
      featured_plans: (terms.featured_plans || []).map((p) => ({ ...p, cents: cents(`plan_${p.key}`) || p.cents })),
      featured_cap: Number(f.get('cap')) || 10,
    };
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'addons', value, updated_at: new Date().toISOString() });
    if (err) return setError(err.message);
    setTerms(value); setShowTerms(false); setMsg('Add-on prices saved. New purchases use them; current subscriptions keep their price.');
  };

  if (addons === false) return <section className="sys-card"><p className="sys-alert">Run storefront_v53_shop_addons.sql in Supabase to switch on add-ons and Featured (Systems → Health has the command).</p></section>;
  if (addons === null) return null;
  const featured = addons.filter((a) => a.kind === 'featured');
  const packs = addons.filter((a) => a.kind === 'products');
  const open = posts.filter((p) => !['posted', 'skipped'].includes(p.status));

  return (
    <section className="sys-card sh-addons" data-tour="shops-addons">
      <div className="sh-billing__row">
        <div>
          <h2><Megaphone size={18} /> Featured &amp; add-ons</h2>
          <p className="sys-muted" style={{ margin: 0 }}>
            {terms ? <>Plan includes {terms.included_products} products · slots {(terms.product_packs || []).map((p) => `${p.slots} for ${dollars(p.cents)}`).join(', ')} a month · Featured {(terms.featured_plans || []).map((p) => `${p.posts} posts for ${dollars(p.cents)}`).join(', ')} a month · up to {terms.featured_cap} paid Featured shops.</> : 'Loading…'}
          </p>
        </div>
        <span className="sh-billing__actions">
          <Link className="sys-btn sys-btn--ghost sys-btn--sm" to="/studio/planner"><CalendarRange size={14} /> Studio planner</Link>
          {admin && terms && <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setShowTerms(!showTerms)}><Settings2 size={14} /> Prices</button>}
        </span>
      </div>
      {error && <p className="sys-alert" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      {showTerms && admin && terms && (
        <form className="sys-form sh-terms" onSubmit={saveTerms}>
          <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10 }}>
            <label className="sys-field"><span>Products included</span><input name="included" type="number" min="1" max="500" defaultValue={terms.included_products} /></label>
            {(terms.product_packs || []).map((p) => <label className="sys-field" key={p.key}><span>+{p.slots} slot{p.slots === 1 ? '' : 's'} ($/mo)</span><input name={`pack_${p.key}`} inputMode="decimal" defaultValue={(p.cents / 100).toFixed(2)} /></label>)}
            {(terms.featured_plans || []).map((p) => <label className="sys-field" key={p.key}><span>Featured {p.posts} posts ($/mo)</span><input name={`plan_${p.key}`} inputMode="decimal" defaultValue={(p.cents / 100).toFixed(2)} /></label>)}
            <label className="sys-field"><span>Paid Featured cap</span><input name="cap" type="number" min="1" max="100" defaultValue={terms.featured_cap} /></label>
          </div>
          <button className="sys-btn sys-btn--gold sys-btn--sm" style={{ justifySelf: 'start' }}><Save size={14} /> Save prices</button>
        </form>
      )}

      <div className="sh-addons__grid">
        <div>
          <h3><Crown size={15} /> CEO pick</h3>
          {[monthOf(0), monthOf(1)].map((m) => <p key={m} className="sys-muted" style={{ margin: '2px 0' }}>{monthName(m)}: <b>{picks[m] ? name(picks[m].curator_id) : 'not chosen yet'}</b></p>)}
          <form className="sys-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }} onSubmit={savePick}>
            <select value={pickMonth} onChange={(e) => setPickMonth(e.target.value)} aria-label="Month">
              {[monthOf(0), monthOf(1)].map((m) => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
            <select value={pickShop} onChange={(e) => setPickShop(e.target.value)} aria-label="Shop">
              <option value="">Choose a shop…</option>
              {approved.map((s) => <option key={s.id} value={s.id}>{s.business_name}</option>)}
            </select>
            <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={!pickShop}><Crown size={14} /> Make CEO pick</button>
          </form>
          <p className="sys-muted" style={{ fontSize: '0.8rem' }}>Free, one post. The shop gets the CEO Selected badge and a spot on the Featured shelf that month.</p>
        </div>
        <div>
          <h3><Megaphone size={15} /> Paid Featured · {featured.length}/{terms?.featured_cap || 10}</h3>
          {featured.length ? (
            <ul className="sh-addons__list">
              {featured.map((a) => {
                const mine = open.filter((p) => p.addon_id === a.id);
                return <li key={a.id}><b>{name(a.curator_id)}</b> · {a.posts} posts/mo{a.status === 'past_due' ? ' · payment failed' : ''}{a.cancel_at_period_end ? ' · ending' : ''}{mine.length ? ` · ${mine.length} open` : ''}</li>;
              })}
            </ul>
          ) : <p className="sys-muted">No paid Featured shops yet.</p>}
          <h3 style={{ marginTop: 10 }}><Package size={15} /> Product slot packs · {packs.length}</h3>
          {packs.length ? <ul className="sh-addons__list">{packs.map((a) => <li key={a.id}><b>{name(a.curator_id)}</b> · +{a.slots}</li>)}</ul> : <p className="sys-muted">None yet.</p>}
        </div>
      </div>

      {open.length > 0 && (
        <>
          <h3>Featured posts owed</h3>
          <ul className="sh-addons__list">
            {open.map((p) => <li key={p.id}><b>{name(p.curator_id)}</b> · {p.source === 'ceo' ? 'CEO pick' : 'paid'} · {monthName(p.month)} · {POST[p.status]}</li>)}
          </ul>
          <p className="sys-muted" style={{ fontSize: '0.8rem' }}>When a shop sends photos and a caption, the post appears in the Studio planner as Ready for review, with her shop link and Instagram in the notes. Approve and schedule it there; this list follows along.</p>
        </>
      )}
    </section>
  );
};

export default ShopAddons;
