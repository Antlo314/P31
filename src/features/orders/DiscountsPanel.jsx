import React, { useEffect, useRef, useState } from 'react';
import { Tag, Plus, Copy, Check, Pencil, Trash2, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import './Orders.css';

const blank = { code: '', kind: 'percent', value: '', min_subtotal: '', max_uses: '', expires_at: '' };

// A saved code back into the form's shape (the date box wants YYYY-MM-DD in her time zone).
const toForm = (c) => {
  let end = '';
  if (c.expires_at) {
    const d = new Date(c.expires_at);
    end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return {
    code: c.code || '',
    kind: c.kind || 'percent',
    value: c.value != null ? String(Number(c.value)) : '',
    min_subtotal: Number(c.min_subtotal) > 0 ? String(Number(c.min_subtotal)) : '',
    max_uses: c.max_uses ? String(c.max_uses) : '',
    expires_at: end,
  };
};

/** Shop promo codes: make, change, pause or delete. Checked on the server at checkout. */
const DiscountsPanel = ({ curatorId }) => {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState(null); // the code being changed, or null for a new one
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const formRef = useRef(null);

  const load = () => supabase.from('discount_codes').select('*').eq('curator_id', curatorId)
    .order('created_at', { ascending: false }).then(({ data, error: err }) => {
      if (err) setError(err.message);
      setCodes(data || []);
    });

  useEffect(() => { if (curatorId) load(); }, [curatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setNote('');
    const value = Number(form.value);
    if (!form.code.trim() || !(value > 0) || (form.kind === 'percent' && value > 100)) {
      return setError(form.kind === 'percent' ? 'Enter a code and a percentage between 1 and 100.' : 'Enter a code and a dollar amount.');
    }
    const row = {
      code: form.code.trim().toUpperCase().replace(/\s+/g, ''),
      kind: form.kind,
      value,
      min_subtotal: form.min_subtotal ? Number(form.min_subtotal) : 0,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
    };
    setBusy(true);
    const { error: err } = editingId
      ? await supabase.from('discount_codes').update(row).eq('id', editingId)
      : await supabase.from('discount_codes').insert({ ...row, curator_id: curatorId });
    setBusy(false);
    if (err) return setError(/duplicate|unique/i.test(err.message) ? 'You already have a code with that name.' : err.message);
    setNote(editingId ? `${row.code} is updated.` : `${row.code} is ready to share.`);
    setForm(blank);
    setEditingId(null);
    load();
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm(toForm(c));
    setError('');
    setNote('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => { setEditingId(null); setForm(blank); setError(''); };

  const toggle = async (c) => {
    setCodes((list) => list.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    const { error: err } = await supabase.from('discount_codes').update({ active: !c.active }).eq('id', c.id);
    if (err) { setError('That change did not save. Please try again.'); load(); }
  };

  // Deleting only removes the code; past orders keep the code and discount they used.
  const remove = async (c) => {
    if (!window.confirm(`Delete the code ${c.code}? Shoppers will not be able to use it any more. Past orders keep their discount.`)) return;
    setError('');
    const { error: err } = await supabase.from('discount_codes').delete().eq('id', c.id);
    if (err) return setError('That code was not deleted. Please try again.');
    if (editingId === c.id) cancelEdit();
    setNote(`${c.code} is deleted.`);
    load();
  };

  const copy = async (c) => {
    try { await navigator.clipboard.writeText(c.code); } catch { return; }
    setCopied(c.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const describe = (c) => [
    c.kind === 'percent' ? `${Number(c.value)}% off` : `$${Number(c.value).toFixed(2)} off`,
    Number(c.min_subtotal) > 0 && `orders over $${Number(c.min_subtotal).toFixed(2)}`,
    `used ${c.uses}${c.max_uses ? ` of ${c.max_uses}` : ''}`,
    c.expires_at && (new Date(c.expires_at) < new Date() ? `ended ${new Date(c.expires_at).toLocaleDateString()}` : `ends ${new Date(c.expires_at).toLocaleDateString()}`),
    !c.active && 'paused',
  ].filter(Boolean).join(' · ');

  return (
    <div className="dc">
      <form className="dc-form" onSubmit={save} ref={formRef}>
        <h3 style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {editingId ? <><Pencil size={18} /> Change this code</> : <><Tag size={18} /> New promo code</>}
        </h3>
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
        {note && !error && <p className="dc-note" role="status">{note}</p>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ord-btn ord-btn--plum" disabled={busy}>
            {editingId ? <><Save size={15} /> Save changes</> : <><Plus size={15} /> Create code</>}
          </button>
          {editingId && <button type="button" className="ord-btn" onClick={cancelEdit}><X size={15} /> Cancel</button>}
        </div>
      </form>

      <div className="dc-list">
        {codes.length === 0 && <p className="ord-empty" style={{ margin: 0 }}>No codes yet. Share one at your next market or on social.</p>}
        {codes.map((c) => (
          <div className={`dc-item ${c.active ? '' : 'is-off'} ${editingId === c.id ? 'is-editing' : ''}`} key={c.id}>
            <div>
              <code>{c.code}</code>
              <p>{describe(c)}</p>
            </div>
            <div>
              <button type="button" onClick={() => copy(c)} aria-label={`Copy ${c.code}`}>{copied === c.id ? <Check size={14} /> : <Copy size={14} />}</button>
              <button type="button" onClick={() => startEdit(c)} aria-label={`Change ${c.code}`}><Pencil size={14} /> Edit</button>
              <button type="button" onClick={() => toggle(c)}>{c.active ? 'Pause' : 'Resume'}</button>
              <button type="button" className="dc-del" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiscountsPanel;
