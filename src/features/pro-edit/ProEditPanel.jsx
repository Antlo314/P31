import React, { useEffect, useState } from 'react';
import { Film, Upload, Clock, Loader2, CheckCircle2, XCircle, Download, X, Music2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { IRIS_STYLES } from './irisStyles';
import { fmtTime } from './findMoments';
import './ProEdit.css';

const STATUS = {
  queued: { Icon: Clock, label: 'Queued' },
  processing: { Icon: Loader2, label: 'Editing in DaVinci' },
  done: { Icon: CheckCircle2, label: 'Ready' },
  failed: { Icon: XCircle, label: 'Needs attention' },
};

/**
 * Request a professional DaVinci Resolve edit (premium curators + operators)
 * and follow its progress. With operatorView, shows everyone's jobs and lets
 * the team move them along.
 */
const ProEditPanel = ({ userId, operatorView = false }) => {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ title: '', style: IRIS_STYLES[0], aspect: '9:16', notes: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    let q = supabase.from('pro_edit_jobs').select('*').order('created_at', { ascending: false }).limit(100);
    if (!operatorView) q = q.eq('requested_by', userId);
    q.then(({ data }) => setJobs(data || []));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('pro-edit-jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pro_edit_jobs' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, operatorView]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!files.length) return setError('Add at least one clip.');
    setError('');
    const folder = `${userId}/pro-edit/${Date.now()}`;
    const paths = [];
    for (let i = 0; i < files.length; i++) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      const f = files[i];
      const path = `${folder}/${String(i + 1).padStart(2, '0')}-${f.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('studio').upload(path, f);
      if (upErr) {
        setBusy('');
        return setError(`${f.name}: ${upErr.message}${/size/i.test(upErr.message) ? ' — export it smaller (1080p) and try again.' : ''}`);
      }
      paths.push(path);
    }
    setBusy('Sending to the editing queue…');
    const { error: insErr } = await supabase.from('pro_edit_jobs').insert({
      requested_by: userId, title: form.title, style: form.style, aspect: form.aspect, notes: form.notes, source_paths: paths,
    });
    setBusy('');
    if (insErr) return setError(insErr.message.includes('row-level') ? 'Pro Edit is a premium feature.' : insErr.message);
    setFiles([]);
    setForm({ ...form, title: '', notes: '' });
    load();
  };

  const download = async (path) => {
    const { data } = await supabase.storage.from('studio').createSignedUrl(path, 3600, { download: true });
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  const setStatus = (id, status) => supabase.from('pro_edit_jobs').update({ status }).eq('id', id).then(load);

  // Team: attach the final render from Resolve and mark the job ready.
  const uploadResult = async (job, file) => {
    if (!file) return;
    setBusy(`Uploading finished edit for “${job.title || 'job'}”…`);
    const path = `${job.requested_by}/pro-edit/results/${job.id}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from('studio').upload(path, file, { upsert: true });
    if (upErr) { setBusy(''); return setError(upErr.message); }
    await supabase.from('pro_edit_jobs').update({ result_path: path, status: 'done', error: null }).eq('id', job.id);
    setBusy('');
    load();
  };

  return (
    <div className="pe">
      <form className="pe-card" onSubmit={submit}>
        <h3><Film size={16} /> Request a pro edit</h3>
        <p className="pe-muted">Iris edits your footage in DaVinci Resolve — colour grade, music mix, cuts and captions — and sends it back here.</p>
        <label className="pe-field"><span>Title</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Winter Gala recap" required />
        </label>
        <div className="pe-row">
          <label className="pe-field"><span>Look</span>
            <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
              {IRIS_STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="pe-field"><span>Format</span>
            <select value={form.aspect} onChange={(e) => setForm({ ...form, aspect: e.target.value })}>
              {['9:16', '4:5', '1:1', '16:9'].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <label className="pe-field"><span>Notes for the editor</span>
          <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Music feel, must-keep moments, text to show…" />
        </label>
        <label className="pe-drop">
          <Upload size={18} /> {files.length ? `${files.length} clip${files.length > 1 ? 's' : ''} ready` : 'Add footage'}
          <input type="file" accept="video/*" multiple hidden onChange={(e) => setFiles([...files, ...e.target.files])} />
        </label>
        {files.length > 0 && (
          <ul className="pe-files">
            {files.map((f, i) => (
              <li key={i}>{f.name} <button type="button" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label="Remove"><X size={14} /></button></li>
            ))}
          </ul>
        )}
        {error && <p className="pe-error">{error}</p>}
        <button className="pe-btn" disabled={!!busy}>{busy || 'Send to Iris'}</button>
      </form>

      <div className="pe-jobs">
        <h3>{operatorView ? 'Edit queue' : 'Your edits'}</h3>
        {jobs.length === 0 && <p className="pe-muted">Nothing here yet.</p>}
        {jobs.map((j) => {
          const S = STATUS[j.status] || STATUS.queued;
          return (
            <article className={`pe-job pe-job--${j.status}`} key={j.id}>
              <S.Icon size={20} className={j.status === 'processing' ? 'pe-spin' : ''} />
              <div className="pe-job__main">
                <strong>{j.title || 'Untitled edit'}</strong>
                <span>{j.kind === 'clip'
                  ? <>Clip {j.clip_index} of {j.clip_count} · {fmtTime(j.clip_start)}–{fmtTime(j.clip_end)}{j.source_name ? ` of ${j.source_name}` : ''}</>
                  : <>{j.source_paths.length} clip{j.source_paths.length > 1 ? 's' : ''}</>} · {j.style} · {j.aspect} · {new Date(j.created_at).toLocaleDateString()}</span>
                {j.music_path && <span><Music2 size={12} /> {j.music_path.split('/').pop().replace(/^\d+-/, '').replace(/_/g, ' ')}</span>}
                <span className="pe-status">{S.label}{j.error ? ` — ${j.error}` : ''}</span>
                {j.notes && operatorView && <span className="pe-notes">“{j.notes}”</span>}
              </div>
              <div className="pe-job__actions">
                {j.result_path && <button className="pe-btn pe-btn--sm" onClick={() => download(j.result_path)}><Download size={14} /> Download</button>}
                {operatorView && j.iris_package && <span className="pe-pill">Iris · {j.iris_package}</span>}
                {operatorView && j.status !== 'done' && (
                  <label className="pe-btn pe-btn--sm">
                    <Upload size={14} /> Upload finished edit
                    <input type="file" accept="video/*" hidden onChange={(e) => uploadResult(j, e.target.files[0])} />
                  </label>
                )}
                {operatorView && j.status !== 'done' && (
                  <select value={j.status} onChange={(e) => setStatus(j.id, e.target.value)} aria-label="Status">
                    {Object.keys(STATUS).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
                  </select>
                )}
                {operatorView && j.source_paths.map((p, i) => (
                  <button key={p} className="pe-linkbtn" onClick={() => download(p)}>Clip {i + 1}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default ProEditPanel;
