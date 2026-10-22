import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Check, ImagePlus, EyeOff, X, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fromRow, refreshTeamDirectory, TEAM_PHOTO_BUCKET } from '../../lib/teamDirectory';
import './TeamDirectoryAdmin.css';

// Systems > Team directory (v64): the people on the Team sections of both sites. Admins add, edit,
// reorder, hide and remove people and upload their photos (public team-photos bucket). Until a
// photo is uploaded, the bundled photo for that name is used; the code list in src/lib/team.js
// is only the fallback while the table is missing or empty.
const SITE_LABEL = { both: 'Both sites', market: 'Market only', collective: 'Collective only' };
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const EMPTY = { id: null, name: '', role: '', blurb: '', emails: '', site: 'both', is_visible: true, photo_path: null };
const missingTable = (m = '') => /does not exist|schema cache|Could not find/i.test(m);

const TeamDirectoryAdmin = () => {
  const [rows, setRows] = useState(null); // null while loading, false when v64 has not run
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    const { data, error: err } = await supabase.from('team_directory').select('*').order('sort_order').order('name');
    if (err) { if (missingTable(err.message)) setRows(false); else setError(err.message); return; }
    setRows(data || []);
  };
  useEffect(() => { Promise.resolve().then(load); }, []);
  const done = async (text) => { setMsg(text); await load(); refreshTeamDirectory(); };

  // The chosen photo, previewed in the same square crop the site uses.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const open = (row) => {
    setError(''); setMsg(''); setFile(null);
    setForm(row ? { ...row, role: row.role || '', blurb: row.blurb || '', emails: (row.emails || []).join('\n') } : { ...EMPTY });
  };
  const close = () => { setForm(null); setFile(null); };

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!TYPES[f.type]) return setError('Photos must be JPG, PNG or WebP.');
    if (f.size > MAX_BYTES) return setError(`That photo is ${(f.size / 1048576).toFixed(1)} MB; the limit is 5 MB.`);
    setError(''); setFile(f);
  };

  const removeFile = async (path) => {
    if (path && !/^https?:\/\//i.test(path)) await supabase.storage.from(TEAM_PHOTO_BUCKET).remove([path]);
  };

  // Upload the new photo as <id>-<timestamp>.<ext>, point the row at it, then drop the old file.
  const uploadPhoto = async (id, oldPath) => {
    const path = `${id}-${Date.now()}.${TYPES[file.type]}`;
    const { error: upErr } = await supabase.storage.from(TEAM_PHOTO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
    if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
    const { error: err } = await supabase.from('team_directory').update({ photo_path: path }).eq('id', id);
    if (err) { await removeFile(path); throw err; }
    if (oldPath && oldPath !== path) await removeFile(oldPath);
  };

  const save = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const emails = form.emails.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    const bad = emails.find((x) => !EMAIL_OK.test(x));
    if (!form.name.trim()) return setError('Add a name.');
    if (bad) return setError(`${bad} is not an email address.`);
    const blurb = form.blurb.split('\n').map((x) => x.trim()).filter(Boolean).join('\n');
    const values = { name: form.name.trim(), role: form.role.trim() || null, blurb: blurb || null, emails: [...new Set(emails)], site: form.site, is_visible: form.is_visible };
    setBusy(true);
    try {
      let id = form.id;
      if (id) {
        const { error: err } = await supabase.from('team_directory').update(values).eq('id', id);
        if (err) throw err;
      } else {
        const last = (rows || []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
        const { data, error: err } = await supabase.from('team_directory').insert({ ...values, sort_order: last + 10 }).select('id').single();
        if (err) throw err;
        id = data.id;
      }
      if (file) await uploadPhoto(id, form.photo_path);
      close();
      await done(`${values.name} saved.${values.is_visible ? '' : ' Hidden from the sites.'}`);
    } catch (err) {
      setError(err.message || 'Could not save.');
      load();
    } finally { setBusy(false); }
  };

  const clearPhoto = async () => {
    if (!form?.id || !form.photo_path || !window.confirm(`Remove the uploaded photo of ${form.name}? The bundled photo (if there is one) shows again.`)) return;
    setBusy(true);
    const { error: err } = await supabase.from('team_directory').update({ photo_path: null }).eq('id', form.id);
    if (!err) await removeFile(form.photo_path);
    setBusy(false);
    if (err) return setError(err.message);
    setForm({ ...form, photo_path: null });
    done('Photo removed.');
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.name} from the team directory on both sites? (To keep the entry but stop showing it, untick "Show on the site" instead.)`)) return;
    setError(''); setMsg('');
    const { error: err } = await supabase.from('team_directory').delete().eq('id', row.id);
    if (err) return setError(err.message);
    await removeFile(row.photo_path);
    if (form?.id === row.id) close();
    done(`${row.name} removed.`);
  };

  // Swap with the neighbour, then number everyone 10, 20, 30… so the order is unambiguous.
  const move = async (index, step) => {
    const list = [...rows];
    const to = index + step;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    setRows(list);
    setError(''); setMsg('');
    const changed = list.map((r, i) => ({ id: r.id, sort_order: (i + 1) * 10, was: r.sort_order })).filter((r) => r.sort_order !== r.was);
    const results = await Promise.all(changed.map((r) => supabase.from('team_directory').update({ sort_order: r.sort_order }).eq('id', r.id)));
    const failed = results.find((r) => r.error);
    if (failed) setError(failed.error.message);
    await load();
    refreshTeamDirectory();
  };

  if (rows === false) {
    return (
      <div className="sys-page">
        <header className="sys-page__head"><p className="sys-eyebrow">Team</p><h1>Team directory</h1></header>
        <p className="sys-alert">Run storefront_v64_team_directory.sql in Supabase to edit the team directory here. Until then the sites show the team list from the site code.</p>
      </div>
    );
  }

  const current = form && form.photo_path ? fromRow(form).photo : null;
  const bundled = form ? fromRow({ ...form, photo_path: null }).photo : null;

  return (
    <div className="sys-page tda">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Team</p>
        <h1>Team directory</h1>
        <p className="sys-muted">The people on the Team sections of p31market.com and thep31collective.org: names, roles, what each does, the mailboxes to write to, and photos. Changes show on the sites straight away.</p>
      </header>

      {error && <p className="sys-alert" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      <section className="sys-card">
        <div className="tda-head">
          <h2><Users size={18} /> On the sites, in this order</h2>
          <button type="button" className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => open(null)}><Plus size={14} /> Add a person</button>
        </div>
        {rows === null ? <p className="sys-muted">Loading…</p> : rows.length === 0 ? (
          <p className="sys-muted">No one yet, so the sites show the team list from the site code. Add the first person to take over.</p>
        ) : (
          <ol className="tda-list">
            {rows.map((r, i) => {
              const shown = fromRow(r);
              return (
                <li key={r.id} className={`tda-row ${r.is_visible ? '' : 'is-hidden'}`}>
                  <span className="tda-thumb">{shown.photo ? <img src={shown.photo} alt="" /> : <User size={22} />}</span>
                  <div className="tda-who">
                    <strong>{r.name}</strong>
                    <span className="sys-muted">{r.role || 'No role yet'}</span>
                    <span className="tda-tags">
                      <span className="sys-tag">{SITE_LABEL[r.site] || r.site}</span>
                      {!r.is_visible && <span className="sys-tag sys-tag--dim"><EyeOff size={11} /> Hidden</span>}
                      {!shown.photo && <span className="sys-tag sys-tag--dim">No photo</span>}
                      {(r.emails || []).length > 0 && <span className="sys-muted tda-mail">{r.emails.join(', ')}</span>}
                    </span>
                  </div>
                  <span className="tda-actions">
                    <button type="button" className="sys-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${r.name} up`}><ArrowUp size={15} /></button>
                    <button type="button" className="sys-icon-btn" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${r.name} down`}><ArrowDown size={15} /></button>
                    <button type="button" className="sys-icon-btn" onClick={() => open(r)} aria-label={`Edit ${r.name}`}><Pencil size={15} /></button>
                    <button type="button" className="sys-icon-btn" onClick={() => remove(r)} aria-label={`Remove ${r.name}`}><Trash2 size={15} /></button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {form && (
        <section className="sys-card" aria-label={form.id ? `Edit ${form.name}` : 'Add a person'}>
          <div className="tda-head">
            <h2>{form.id ? <><Pencil size={18} /> Edit {form.name}</> : <><Plus size={18} /> Add a person</>}</h2>
            <button type="button" className="sys-icon-btn" onClick={close} aria-label="Close"><X size={16} /></button>
          </div>
          <form className="sys-form tda-form" onSubmit={save}>
            <div className="tda-photo">
              <span className="tda-square">
                {preview || current || bundled ? <img src={preview || current || bundled} alt="" /> : <User size={40} />}
              </span>
              <label className="sys-btn sys-btn--ghost sys-btn--sm">
                <ImagePlus size={14} /> {preview || current ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
              </label>
              <small className="sys-muted">
                {preview ? 'New photo: saved when you press Save.' : current ? 'Uploaded photo.' : bundled ? 'Using the photo built into the site.' : 'No photo yet.'}
                {' '}JPG, PNG or WebP up to 5 MB; shown in a square (round on the sites), centred.
              </small>
              {preview && <button type="button" className="sys-linkbtn" onClick={() => setFile(null)}>Keep the current photo</button>}
              {!preview && current && <button type="button" className="sys-linkbtn" onClick={clearPhoto} disabled={busy}>Remove uploaded photo</button>}
            </div>
            <div className="tda-fields">
              <div className="sys-row">
                <label className="sys-field sys-grow"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <label className="sys-field sys-grow"><span>Role</span><input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Member Liaison" /></label>
              </div>
              <label className="sys-field"><span>What she does (one point per line)</span>
                <textarea rows={3} value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} placeholder={'Community experience\nEvent planning'} />
              </label>
              <label className="sys-field"><span>Emails to show (one per line)</span>
                <textarea rows={2} value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} placeholder="members@thep31collective.org" />
              </label>
              <div className="sys-row">
                <label className="sys-field sys-grow"><span>Show on</span>
                  <select value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })}>
                    {Object.entries(SITE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="tda-check"><input type="checkbox" checked={form.is_visible} onChange={(e) => setForm({ ...form, is_visible: e.target.checked })} /> Show on the site</label>
              </div>
              <div className="sys-row">
                <button className="sys-btn sys-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
                <button type="button" className="sys-btn sys-btn--ghost" onClick={close} disabled={busy}>Cancel</button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};

export default TeamDirectoryAdmin;
