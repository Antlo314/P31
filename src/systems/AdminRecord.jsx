import React, { useState } from 'react';
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';

/**
 * The same Edit and Delete in every Systems room.
 *   <DeleteRecord what="this application" onDelete={async () => supabase.from(...).delete().eq('id', id)} onDone={back} />
 *   <EditRecord fields={[['full_name', 'Name'], ['email', 'Email', 'email']]} value={row} onSave={async (patch) => ...} />
 * onDelete / onSave return the Supabase result ({ error, count }) or throw; the error is shown in place. Ask for
 * { count: 'exact' } on the delete or update: a count of 0 means the database refused it quietly (no permission).
 */
export const DeleteRecord = ({ what = 'this', note = '', onDelete, onDone, label = 'Delete', className = '' }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    if (!window.confirm(`Delete ${what}? ${note ? `${note} ` : ''}This cannot be undone.`)) return;
    setBusy(true); setError('');
    try {
      const res = await onDelete();
      if (res?.error) throw new Error(res.error.message || String(res.error));
      if (res && res.count === 0) throw new Error('Nothing was deleted. This login may not have that permission yet.');
      onDone?.();
    } catch (e) { setError(e.message || 'That did not delete. Please try again.'); }
    setBusy(false);
  };
  return (
    <span className={`adm-del ${className}`}>
      <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm adm-del__btn" onClick={run} disabled={busy}>
        {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} {label}
      </button>
      {error && <small className="sys-error" role="alert">{error}</small>}
    </span>
  );
};

/** A row of fields that turn into inputs with Save and Cancel. fields: [key, label, type?, options?] */
export const EditRecord = ({ fields, value, onSave, title = 'Edit details' }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = () => { setDraft(Object.fromEntries(fields.map(([k]) => [k, value?.[k] ?? '']))); setError(''); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    // Only what changed is sent; empty text becomes empty (null).
    const patch = {};
    fields.forEach(([k, , type]) => {
      let v = draft[k];
      if (type === 'number') v = v === '' || v == null ? null : Number(v);
      else if (typeof v === 'string') v = v.trim() === '' ? null : v.trim();
      if ((value?.[k] ?? null) !== v) patch[k] = v;
    });
    try {
      if (Object.keys(patch).length) {
        const res = await onSave(patch);
        if (res?.error) throw new Error(res.error.message || String(res.error));
        if (res && res.count === 0) throw new Error('Nothing was saved. This login may not have that permission yet.');
      }
      setOpen(false);
    } catch (err) { setError(err.message || 'That did not save. Please try again.'); }
    setBusy(false);
  };
  if (!open) return <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={start}><Pencil size={14} /> {title}</button>;
  return (
    <form className="sys-form adm-edit" onSubmit={save}>
      {fields.map(([k, label, type = 'text', options]) => (
        <label key={k} className="sys-field">
          <span>{label}</span>
          {type === 'textarea' ? <textarea rows={4} value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
            : type === 'select' ? (
              <select value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : <input type={type} value={draft[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} step={type === 'number' ? 'any' : undefined} />}
        </label>
      ))}
      {error && <p className="sys-error" role="alert">{error}</p>}
      <div className="sys-chips">
        <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={busy}>{busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Save</button>
        <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setOpen(false)} disabled={busy}><X size={14} /> Cancel</button>
      </div>
    </form>
  );
};
