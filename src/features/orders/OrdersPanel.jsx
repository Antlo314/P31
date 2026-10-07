import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Download, Mail, Phone, Truck, Check, X, CreditCard, Send, MapPin, Package, StickyNote } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './Orders.css';

const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;
const ref = (o) => String(o.id).slice(0, 8).toUpperCase();
const METHOD = { ship: 'Ship', pickup: 'Local pickup', market: 'Market pickup' };
const FILTERS = [['open', 'Open'], ['new', 'New'], ['confirmed', 'Confirmed'], ['fulfilled', 'Fulfilled'], ['cancelled', 'Cancelled'], ['all', 'All']];

const lines = (o) => (Array.isArray(o.items) && o.items.length
  ? o.items
  : [{ name: o.product_name || 'Item', quantity: o.quantity || 1, price_cents: o.amount_subtotal && o.quantity ? Math.round(o.amount_subtotal / o.quantity) : null }]);

// Money you can count: paid card orders + confirmed/fulfilled requests.
const counts = (o) => (o.order_type === 'request'
  ? ['confirmed', 'fulfilled'].includes(o.fulfillment_status)
  : o.payment_status === 'paid') && o.fulfillment_status !== 'cancelled';

const address = (a) => {
  const x = a?.address || a;
  if (!x?.line1) return null;
  return [a?.name, x.line1, x.line2, `${x.city || ''}, ${x.state || ''} ${x.postal_code || ''}`].filter(Boolean).join(' · ');
};

const toCsv = (rows) => {
  const cols = ['ref', 'created_at', 'order_type', 'payment_status', 'fulfillment_status', 'buyer_name', 'buyer_email', 'buyer_phone', 'items', 'discount_code', 'total', 'method', 'tracking_number'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((o) => [
    ref(o), o.created_at, o.order_type, o.payment_status, o.fulfillment_status, o.buyer_name, o.buyer_email, o.buyer_phone,
    lines(o).map((l) => `${l.quantity}× ${l.name}${l.options && Object.keys(l.options).length ? ` (${Object.values(l.options).join('/')})` : ''}`).join('; '),
    o.discount_code, ((o.amount_total || 0) / 100).toFixed(2), METHOD[o.fulfillment_method] || '', o.tracking_number,
  ].map(esc).join(','))].join('\n');
};

/** Orders for one curator (default) — confirm, fulfil, track, export. */
const OrdersPanel = ({ curatorId }) => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState({});
  const [error, setError] = useState('');

  const load = async () => {
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(500);
    if (curatorId) q = q.eq('curator_id', curatorId);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    setOrders((data || []).filter((o) => o.payment_status !== 'pending' || o.order_type === 'request'));
    setLoading(false);
  };

  useEffect(() => {
    Promise.resolve().then(load);
    const ch = supabase.channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [curatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (o, patch) => {
    setError('');
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, ...patch } : x)));
    const { error: err } = await supabase.from('orders').update(patch).eq('id', o.id);
    if (err) { setError(err.message); load(); }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const month = orders.filter((o) => counts(o) && new Date(o.created_at).getMonth() === now.getMonth() && new Date(o.created_at).getFullYear() === now.getFullYear());
    return {
      revenue: orders.filter(counts).reduce((s, o) => s + (o.amount_total || 0), 0),
      month: month.reduce((s, o) => s + (o.amount_total || 0), 0),
      open: orders.filter((o) => ['new', 'confirmed'].includes(o.fulfillment_status || 'new')).length,
      newCount: orders.filter((o) => (o.fulfillment_status || 'new') === 'new').length,
    };
  }, [orders]);

  const shown = orders.filter((o) => {
    const st = o.fulfillment_status || 'new';
    if (filter === 'all') return true;
    if (filter === 'open') return st === 'new' || st === 'confirmed';
    return st === filter;
  });

  const exportCsv = () => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([toCsv(shown)], { type: 'text/csv' })),
      download: `p31-orders-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="ord">
      <div className="ord-stats">
        <div><span>{money(stats.month)}</span><small>This month</small></div>
        <div><span>{money(stats.revenue)}</span><small>All time</small></div>
        <div className={stats.newCount ? 'is-hot' : ''}><span>{stats.open}</span><small>Open orders{stats.newCount ? ` · ${stats.newCount} new` : ''}</small></div>
      </div>

      <div className="ord-bar">
        <div className="ord-filters" role="tablist">
          {FILTERS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
        <div className="ord-tools">
          <button onClick={() => { setLoading(true); load(); }} aria-label="Refresh"><RefreshCw size={15} className={loading ? 'ord-spin' : ''} /></button>
          <button onClick={exportCsv} disabled={!shown.length}><Download size={15} /> CSV</button>
        </div>
      </div>

      {error && <p className="ord-err">{error}</p>}
      {!loading && shown.length === 0 && (
        <div className="ord-empty"><Package size={28} /><p>{orders.length ? 'No orders in this view.' : 'No orders yet — share your storefront link to start selling.'}</p></div>
      )}

      <div className="ord-list">
        {shown.map((o) => {
          const st = o.fulfillment_status || 'new';
          const isRequest = o.order_type === 'request';
          const addr = address(o.shipping_address);
          return (
            <article className={`ord-card is-${st}`} key={o.id}>
              <header>
                <div>
                  <strong>#{ref(o)}</strong>
                  <span>{new Date(o.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="ord-pills">
                  <span className={`ord-pill ${isRequest ? '' : 'is-paid'}`}>
                    {isRequest ? <><Send size={12} /> Request</> : <><CreditCard size={12} /> {o.payment_status === 'paid' ? 'Paid' : o.payment_status}</>}
                  </span>
                  <span className={`ord-pill is-${st}`}>{st}</span>
                </div>
              </header>

              <ul className="ord-items">
                {lines(o).map((l, i) => (
                  <li key={i}>
                    <span>{l.quantity}× {l.name}{l.options && Object.keys(l.options).length ? <em> · {Object.entries(l.options).map(([k, v]) => `${k}: ${v}`).join(' · ')}</em> : null}</span>
                    {l.price_cents != null && <span>{money(l.price_cents * l.quantity)}</span>}
                  </li>
                ))}
                {o.discount_amount > 0 && <li className="is-disc"><span>Code {o.discount_code}</span><span>−{money(o.discount_amount)}</span></li>}
                <li className="is-total"><span>Total</span><span>{money(o.amount_total)}</span></li>
              </ul>

              <div className="ord-buyer">
                <strong>{o.buyer_name || 'Guest'}</strong>
                {o.buyer_email && <a href={`mailto:${o.buyer_email}?subject=${encodeURIComponent(`Your order #${ref(o)}`)}`}><Mail size={14} /> {o.buyer_email}</a>}
                {o.buyer_phone && <a href={`tel:${o.buyer_phone}`}><Phone size={14} /> {o.buyer_phone}</a>}
                {o.fulfillment_method && <span><Truck size={14} /> {METHOD[o.fulfillment_method] || o.fulfillment_method}</span>}
                {addr && <span><MapPin size={14} /> {addr}</span>}
                {o.buyer_note && <span><StickyNote size={14} /> “{o.buyer_note}”</span>}
                {o.tracking_number && <span><Package size={14} /> Tracking {o.tracking_number}</span>}
              </div>

              {st !== 'fulfilled' && st !== 'cancelled' && (
                <div className="ord-actions">
                  {isRequest && st === 'new' && (
                    <button className="ord-btn ord-btn--plum" onClick={() => update(o, { fulfillment_status: 'confirmed' })}><Check size={15} /> Confirm order</button>
                  )}
                  {(o.fulfillment_method === 'ship' || !o.fulfillment_method) && (
                    <input placeholder="Tracking number (optional)" value={tracking[o.id] ?? o.tracking_number ?? ''} onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })} />
                  )}
                  <button className="ord-btn ord-btn--gold" onClick={() => update(o, { fulfillment_status: 'fulfilled', ...(tracking[o.id] ? { tracking_number: tracking[o.id] } : {}) })}>
                    <Package size={15} /> Mark fulfilled
                  </button>
                  <button className="ord-btn ord-btn--ghost" onClick={() => window.confirm(`Cancel order #${ref(o)}?`) && update(o, { fulfillment_status: 'cancelled' })}><X size={15} /> Cancel</button>
                </div>
              )}
              {(st === 'fulfilled' || st === 'cancelled') && (
                <button className="ord-link" onClick={() => update(o, { fulfillment_status: isRequest ? 'confirmed' : 'new' })}>Re-open</button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default OrdersPanel;
