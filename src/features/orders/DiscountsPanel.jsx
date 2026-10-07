import React, { useEffect, useState } from 'react';
import { Tag, Plus, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './Orders.css';

const blank = { code: '', kind: 'percent', value: '', min_subtotal: '', max_uses: '', expires_at: '' };

/** Curator discount codes — checked on the server at checkout. */
const DiscountsPanel = ({ curatorId }) => {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const load = () => supabase.from('discount_codes').select('*').eq('curator_id', curatorId)
    .order('created_at', { ascending: false }).then(({ data, error: err }) => {
      if (err) setError(err.message);
      setCodes(data || []);
    });

  useEffect(() => { if (curatorId) load(); }, [curatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault();
    setError('');
    const value = Number(form.value);
    if (!form.code.trim() || !(value > 0) || (form.kind === 'percent' && value > 100)) {
      return setError(form.kind === 'percent' ? 'Enter a code and a percentage between 1 and 100.' : 'Enter a code and a dollar amount.');
    }
    const { error: err } = await supabase.from('discount_codes').insert({
      curator_id: curatorId,
      code: form.code.trim().toUpperCase().replace(/\s+/g, ''),
      kind: form.kind,
      value,
      min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
    });
    if (err) return setError(err.message.includes('duplicate') ? 'You already have a code with that name.' : err.message);
    setForm(blank);
    load();
  };

  const toggle = async (c) => {
    setCodes((list) => list.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    await supabase.from('discount_codes').update({ active: !c.active }).eq('id', c.id);
  };

  const copy = async (c) => {
    await navigator.clipboard.writeText(c.code);
    setCopied(c.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const describe = (c) => [
    c.kind === 'percent' ? `${Number(c.value)}% off` : `$${Number(c.value).toFixed(2)} off`,
    Number(c.min_subtotal) > 0 && `orders over $${Number(c.min_subtotal).toFixed(2)}`,
    `used ${c.uses}${c.max_uses ? ` of ${c.max_uses}` : ''}`,
    c.expires_at && `ends ${new Date(c.expires_at).toLocaleDateString()}`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="dc">
      <form className="dc-form" onSubmit={create}>
        <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}><Tag size={18} /> New discount code</h3>
        <div className="dc-row">
          <label>Code<input name="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WINTER15" maxLength={24} /></label>
          <label>Type
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="percent">% off</option>
              <option value="amount">$ off</option>
            </select>
          </label>
          <label>{form.kind === 'percent' ? 'Percent' : 'Dollars'}<input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.kind === 'percent' ? '15' : '10'} /></label>
          <label>Minimum order ($)<input type="number" min="0" step="0.01" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} placeholder="Optional" /></label>
          <label>Max uses<input type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" /></label>
          <label>Ends on<input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} /></label>
        </div>
        {error && <p className="ord-err">{error}</p>}
        <button className="ord-btn ord-btn--plum" style={{ justifySelf: 'start' }}><Plus size={15} /> Create code</button>
      </form>

      <div className="dc-list">
        {codes.length === 0 && <p className="ord-empty" style={{ margin: 0 }}>No codes yet. Share one at your next market or on social.</p>}
        {codes.map((c) => (
          <div className={`dc-item ${c.active ? '' : 'is-off'}`} key={c.id}>
            <div>
              <code>{c.code}</code>
              <p>{describe(c)}</p>
            </div>
            <div>
              <button onClick={() => copy(c)} aria-label="Copy code">{copied === c.id ? <Check size={14} /> : <Copy size={14} />}</button>
              <button onClick={() => toggle(c)}>{c.active ? 'Pause' : 'Resume'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscountsPanel;
