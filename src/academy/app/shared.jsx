import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MessagesSquare, Plus, Pin, Lock, Unlock, Trash2, ArrowLeft, Send, Bell, CheckCheck, Printer, Award, Download, Share2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime } from '../../lib/academy';
import { COLLECTIVE_URL } from '../../lib/seo';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import { useAcademy, useRealtime, useRows, write } from './data';
import mark from '../../assets/academy/collective-mark.png';

const ago = (iso, now) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return fmtDate(iso, { month: 'short', day: 'numeric' });
};
const RoleTag = ({ role }) => (role === 'mentor' ? <span className="ds-pill ds-pill--gold">Mentor</span> : null);

// ── Discussions ──────────────────────────────────────────────
export const Discussions = () => {
  const { program } = useAcademy();
  const list = useRows(() => supabase.from('academy_threads').select('*').eq('program_id', program.id)
    .order('is_pinned', { ascending: false }).order('last_activity_at', { ascending: false }).limit(200), [program.id]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const start = async (e) => {
    e.preventDefault();
    const { data, error: err } = await write(supabase.from('academy_threads').insert({ program_id: program.id, title: form.title.trim(), body: form.body.trim() || null }).select('id').single());
    if (err) return setError(err);
    navigate(data.id);
  };
  return (
    <>
      <DashHead eyebrow={program.title} title="Discussions" lead="Ask, share and encourage one another. Everyone in the program can see these."
        actions={<button className="k-btn k-btn--gold" onClick={() => setOpen(!open)}><Plus size={16} /> Start a discussion</button>} />
      {open && (
        <form className="ds-card ds-form" onSubmit={start} style={{ marginBottom: 16 }}>
          <label className="k-field"><span>Topic</span><input required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. How do you price your first offer?" /></label>
          <label className="k-field"><span>Say more (optional)</span><textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }}><Send size={15} /> Post</button>
        </form>
      )}
      {list.data.length ? (
        <ul className="ds-list">
          {list.data.map((t) => (
            <li key={t.id}><Link to={t.id} className="ds-row cl-topic">
              <span className="cl-avatar">{(t.author_name || '?').charAt(0)}</span>
              <div><strong>{t.is_pinned && <Pin size={13} />} {t.is_locked && <Lock size={13} />} {t.title}</strong>
                <small>{t.author_name} · {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'} · {ago(t.last_activity_at, now)}</small></div>
              <RoleTag role={t.author_role} />
            </Link></li>
          ))}
        </ul>
      ) : <DashEmpty Icon={MessagesSquare} title="No discussions yet">Start the first one — a question, a win, or a word of encouragement.</DashEmpty>}
    </>
  );
};

export const DiscussionThread = () => {
  const { threadId } = useParams();
  const { user, isMentor } = useAcademy();
  const navigate = useNavigate();
  const thread = useRows(() => supabase.from('academy_threads').select('*').eq('id', threadId).maybeSingle(), [threadId], { initial: null });
  const posts = useRows(() => supabase.from('academy_posts').select('*').eq('thread_id', threadId).order('created_at'), [threadId]);
  useRealtime('academy_posts', 'thread_id', threadId, posts.reload);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [posts.data.length]);
  const t = thread.data;
  if (thread.loading) return <p className="ds-muted">Loading…</p>;
  if (!t) return <DashEmpty Icon={MessagesSquare} title="Discussion not found" action={<Link to=".." relative="path" className="k-btn k-btn--ghost">All discussions</Link>} />;

  const reply = async (e) => {
    e.preventDefault();
    const { error: err } = await write(supabase.from('academy_posts').insert({ thread_id: t.id, program_id: t.program_id, body: body.trim() }));
    if (err) return setError(err);
    setBody(''); setError(''); posts.reload();
  };
  const patch = async (p) => { await write(supabase.from('academy_threads').update(p).eq('id', t.id)); thread.reload(); };
  const removeThread = async () => { if (window.confirm('Delete this discussion and every reply?')) { await write(supabase.from('academy_threads').delete().eq('id', t.id)); navigate('..', { relative: 'path' }); } };
  const removePost = async (p) => { if (window.confirm('Delete this reply?')) { await write(supabase.from('academy_posts').delete().eq('id', p.id)); posts.reload(); } };

  return (
    <>
      <Link to=".." relative="path" className="k-link" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> All discussions</Link>
      <article className="ds-card cl-post cl-post--lead">
        <div className="cl-post__by"><span className="cl-avatar">{(t.author_name || '?').charAt(0)}</span><div><strong>{t.author_name}</strong><small>{fmtDateTime(t.created_at)}</small></div><RoleTag role={t.author_role} /></div>
        <h1 className="cl-post__title">{t.title}</h1>
        {t.body && <p className="cl-post__body">{t.body}</p>}
        {(isMentor || t.author_id === user?.id) && (
          <div className="k-actions">
            {isMentor && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => patch({ is_pinned: !t.is_pinned })}><Pin size={14} /> {t.is_pinned ? 'Unpin' : 'Pin'}</button>}
            {isMentor && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => patch({ is_locked: !t.is_locked })}>{t.is_locked ? <><Unlock size={14} /> Reopen</> : <><Lock size={14} /> Close replies</>}</button>}
            <button className="k-btn k-btn--sm k-btn--ghost" onClick={removeThread}><Trash2 size={14} /> Delete</button>
          </div>
        )}
      </article>
      <div className="cl-replies">
        {posts.data.map((p) => (
          <article key={p.id} className={`cl-post ${p.author_role === 'mentor' ? 'is-mentor' : ''}`}>
            <div className="cl-post__by"><span className="cl-avatar">{(p.author_name || '?').charAt(0)}</span><div><strong>{p.author_name}</strong><small>{fmtDateTime(p.created_at)}</small></div><RoleTag role={p.author_role} />
              {(isMentor || p.author_id === user?.id) && <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => removePost(p)} aria-label="Delete reply"><Trash2 size={13} /></button>}</div>
            <p className="cl-post__body">{p.body}</p>
          </article>
        ))}
        <div ref={endRef} />
      </div>
      {t.is_locked && !isMentor ? <div className="ds-banner"><Lock size={16} /> Replies are closed.</div> : (
        <form className="ds-compose" onSubmit={reply}>
          <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" aria-label="Reply"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) reply(e); }} />
          <button className="k-btn k-btn--plum k-btn--icon" disabled={!body.trim()} aria-label="Send reply"><Send size={18} /></button>
        </form>
      )}
      {error && <p className="k-error">{error}</p>}
    </>
  );
};

// ── Certificate (view, print, share) ─────────────────────────
export const CertificateView = () => {
  const { certId } = useParams();
  const { program } = useAcademy();
  const cert = useRows(() => supabase.from('academy_certificates').select('*').eq('id', certId).maybeSingle(), [certId], { initial: null });
  const [copied, setCopied] = useState(false);
  const c = cert.data;
  if (cert.loading) return <p className="ds-muted">Loading…</p>;
  if (!c) return <DashEmpty Icon={Award} title="Certificate not found" />;
  const verifyUrl = `${COLLECTIVE_URL}/verify/${c.serial}`;
  const share = async () => {
    const text = `I completed the ${program.title} with The Proverbs 31 Collective.`;
    try {
      if (navigator.share) await navigator.share({ title: c.title, text, url: verifyUrl });
      else { await navigator.clipboard.writeText(`${text} ${verifyUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    } catch { /* share sheet closed */ }
  };
  return (
    <>
      <div className="k-actions cl-no-print" style={{ marginBottom: 16 }}>
        <button className="k-btn k-btn--gold" onClick={() => window.print()}><Printer size={16} /> Print or save as PDF</button>
        <button className="k-btn k-btn--ghost" onClick={share}><Share2 size={16} /> {copied ? 'Link copied' : 'Share'}</button>
      </div>
      <div className="cl-cert">
        <div className="cl-cert__inner">
          <img src={mark} alt="" className="cl-cert__mark" />
          <p className="cl-cert__org">The Proverbs 31 Collective</p>
          <h1 className="cl-cert__title">{c.title}</h1>
          <p className="cl-cert__lead">This certifies that</p>
          <p className="cl-cert__name">{c.recipient_name}</p>
          <p className="cl-cert__lead">has completed the <strong>{program.title}</strong>{c.note ? ` — ${c.note}` : ''}.</p>
          <div className="cl-cert__foot">
            <div><strong>{fmtDate(c.issued_at, { month: 'long', day: 'numeric', year: 'numeric' })}</strong><small>Date</small></div>
            <div className="cl-cert__seal"><Award size={30} /></div>
            <div><strong>#{c.serial}</strong><small>Verify at thep31collective.org/verify</small></div>
          </div>
          <p className="cl-cert__verse">“Give her of the fruit of her hands; and let her own works praise her in the gates.” — Proverbs 31:31</p>
        </div>
      </div>
    </>
  );
};

// ── Notifications bell ───────────────────────────────────────
export const NotificationBell = ({ userId }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const list = useRows(() => supabase.from('academy_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(40), [userId]);
  useRealtime('academy_notifications', 'user_id', userId, list.reload);
  const [now, setNow] = useState(() => Date.now());
  const unread = list.data.filter((n) => !n.read_at).length;
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); window.removeEventListener('keydown', key); };
  }, [open]);

  const go = async (n) => {
    if (!n.read_at) await supabase.from('academy_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
    setOpen(false); list.reload();
    if (n.link) navigate(n.link);
  };
  const readAll = async () => {
    await supabase.from('academy_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
    list.reload();
  };
  if (!userId) return null;
  return (
    <div className="cl-bell" ref={panelRef}>
      <button className="ds-icon-btn" onClick={() => { setNow(Date.now()); setOpen(!open); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={17} />{unread > 0 && <em className="cl-bell__dot">{unread > 9 ? '9+' : unread}</em>}
      </button>
      {open && (
        <div className="cl-bell__panel" role="dialog" aria-label="Notifications">
          <div className="cl-bell__head"><strong>Notifications</strong>{unread > 0 && <button className="k-link" onClick={readAll}><CheckCheck size={15} /> Mark all read</button>}</div>
          {list.data.length ? (
            <ul>
              {list.data.map((n) => (
                <li key={n.id}><button className={n.read_at ? '' : 'is-unread'} onClick={() => go(n)}>
                  <strong>{n.title}</strong>{n.body && <span>{n.body}</span>}<small>{ago(n.created_at, now)}</small>
                </button></li>
              ))}
            </ul>
          ) : <p className="ds-muted" style={{ padding: 16 }}>You’re all caught up.</p>}
        </div>
      )}
    </div>
  );
};

// ── Install the classroom as an app (PC, Android, iPhone) ────
export const InstallApp = () => {
  const [prompt, setPrompt] = useState(null);
  const [ios] = useState(() => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (!prompt && !ios) return null;
  const install = async () => {
    if (prompt) { prompt.prompt(); await prompt.userChoice; setPrompt(null); } else setHint(!hint);
  };
  return (
    <div className="cl-install">
      <button className="ds-icon-btn" onClick={install} aria-label="Install the app" title="Install the app"><Download size={17} /></button>
      {hint && <div className="cl-install__hint">On iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</div>}
    </div>
  );
};
