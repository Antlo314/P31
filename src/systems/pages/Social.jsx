import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, PenSquare, Inbox, Share2, Copy, Check, Trash2, ImagePlus, X, ExternalLink, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import AiAssist from '../../components/AiAssist';

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', limit: 2200 },
  { id: 'tiktok', label: 'TikTok', limit: 2200 },
  { id: 'facebook', label: 'Facebook', limit: 63206 },
  { id: 'x', label: 'X', limit: 280 },
  { id: 'linkedin', label: 'LinkedIn', limit: 3000 },
  { id: 'threads', label: 'Threads', limit: 500 },
];

const blankPost = { caption: '', platforms: ['instagram', 'facebook'], media_urls: [], scheduled_for: '', notes: '' };

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const dayLabel = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const Social = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('plan');
  const [posts, setPosts] = useState([]);
  const [draft, setDraft] = useState(blankPost);
  const [editingId, setEditingId] = useState(null);
  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () =>
    supabase.from('social_posts').select('*').order('scheduled_for', { ascending: true, nullsFirst: false })
      .then(({ data }) => setPosts(data || []));

  useEffect(() => { load(); }, []);

  // Signed preview links for private media.
  useEffect(() => {
    const paths = [...new Set(posts.flatMap((p) => p.media_urls || []).concat(draft.media_urls))].filter((p) => !previews[p]);
    if (!paths.length) return;
    supabase.storage.from('studio').createSignedUrls(paths, 3600).then(({ data }) => {
      if (data) setPreviews((prev) => ({ ...prev, ...Object.fromEntries(data.map((d) => [d.path, d.signedUrl])) }));
    });
  }, [posts, draft.media_urls, previews]);

  const groups = useMemo(() => {
    const scheduled = posts.filter((p) => p.status === 'scheduled');
    const byDay = {};
    scheduled.forEach((p) => {
      const k = new Date(p.scheduled_for).toDateString();
      (byDay[k] ||= []).push(p);
    });
    return {
      byDay: Object.entries(byDay),
      drafts: posts.filter((p) => p.status === 'draft'),
      posted: posts.filter((p) => p.status === 'posted').reverse().slice(0, 20),
    };
  }, [posts]);

  const tightest = Math.min(...PLATFORMS.filter((p) => draft.platforms.includes(p.id)).map((p) => p.limit), Infinity);

  const uploadMedia = async (files) => {
    setUploading(true);
    const paths = [];
    for (const file of files) {
      const path = `${user.id}/social/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error } = await supabase.storage.from('studio').upload(path, file);
      if (!error) paths.push(path);
    }
    setDraft((d) => ({ ...d, media_urls: [...d.media_urls, ...paths] }));
    setUploading(false);
  };

  const savePost = async (status) => {
    if (status === 'scheduled' && !draft.scheduled_for) return setMsg('Pick a date and time to schedule.');
    const row = {
      caption: draft.caption,
      platforms: draft.platforms,
      media_urls: draft.media_urls,
      notes: draft.notes,
      scheduled_for: draft.scheduled_for ? new Date(draft.scheduled_for).toISOString() : null,
      status,
    };
    const { error } = editingId
      ? await supabase.from('social_posts').update(row).eq('id', editingId)
      : await supabase.from('social_posts').insert(row);
    if (error) return setMsg(error.message);
    setDraft(blankPost); setEditingId(null);
    setMsg(status === 'scheduled' ? 'Scheduled.' : 'Draft saved.');
    load();
  };

  const edit = (p) => {
    setEditingId(p.id);
    setDraft({ caption: p.caption || '', platforms: p.platforms || [], media_urls: p.media_urls || [], scheduled_for: toLocalInput(p.scheduled_for), notes: p.notes || '' });
    setTab('compose');
  };

  const remove = async (id) => {
    await supabase.from('social_posts').delete().eq('id', id);
    load();
  };

  const markPosted = async (id) => {
    await supabase.from('social_posts').update({ status: 'posted' }).eq('id', id);
    load();
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Social</p>
        <h1>Social command</h1>
        <p className="sys-muted">Plan and schedule posts, share them from your phone, and keep up with comments.</p>
      </header>

      <div className="sys-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'plan'} onClick={() => setTab('plan')}><CalendarClock size={16} /> Plan</button>
        <button role="tab" aria-selected={tab === 'compose'} onClick={() => setTab('compose')}><PenSquare size={16} /> {editingId ? 'Edit' : 'New post'}</button>
        <button role="tab" aria-selected={tab === 'inbox'} onClick={() => setTab('inbox')}><Inbox size={16} /> Comments</button>
      </div>

      {msg && <p className="sys-ok" onAnimationEnd={() => setMsg('')}><Check size={16} /> {msg}</p>}

      {tab === 'plan' && (
        <>
          {groups.byDay.length === 0 && groups.drafts.length === 0 && (
            <p className="sys-empty">Nothing planned yet. <button className="sys-linkbtn" onClick={() => setTab('compose')}>Write your first post</button></p>
          )}
          {groups.byDay.map(([day, list]) => (
            <section key={day} className="sys-day">
              <h2 className="sys-subhead">{dayLabel(list[0].scheduled_for)}</h2>
              {list.map((p) => <PostCard key={p.id} p={p} previews={previews} onEdit={edit} onDelete={remove} onPosted={markPosted} />)}
            </section>
          ))}
          {groups.drafts.length > 0 && (
            <section className="sys-day">
              <h2 className="sys-subhead">Drafts</h2>
              {groups.drafts.map((p) => <PostCard key={p.id} p={p} previews={previews} onEdit={edit} onDelete={remove} onPosted={markPosted} />)}
            </section>
          )}
          {groups.posted.length > 0 && (
            <section className="sys-day">
              <h2 className="sys-subhead">Recently posted</h2>
              {groups.posted.map((p) => <PostCard key={p.id} p={p} previews={previews} onEdit={edit} onDelete={remove} />)}
            </section>
          )}
        </>
      )}

      {tab === 'compose' && (
        <div className="sys-card sys-form">
          <div className="sys-chips" aria-label="Platforms">
            {PLATFORMS.map((pl) => {
              const on = draft.platforms.includes(pl.id);
              return (
                <button key={pl.id} type="button" className={`sys-chip ${on ? 'is-on' : ''}`} aria-pressed={on}
                  onClick={() => setDraft((d) => ({ ...d, platforms: on ? d.platforms.filter((x) => x !== pl.id) : [...d.platforms, pl.id] }))}>
                  {pl.label}
                </button>
              );
            })}
          </div>

          <label className="sys-field">
            <span>Caption</span>
            <textarea rows={7} value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              placeholder="Write once — we’ll flag anything too long for a platform." />
                        <small className={draft.caption.length > tightest ? 'sys-error' : 'sys-muted'}>
              {draft.caption.length}{Number.isFinite(tightest) ? ` / ${tightest}` : ''} characters
            </small>
          </label>
          <AiAssist
            task="caption"
            label="Write captions with AI (uses what you typed as the topic)"
            getInput={() => ({
              topic: draft.caption || draft.notes,
              platforms: draft.platforms.join(', '),
              maxChars: Number.isFinite(tightest) ? tightest : '',
            })}
            getImage={() => {
              const img = draft.media_urls.find((m) => !/\.(mp4|mov|webm)$/i.test(m));
              return img && previews[img] ? { imageUrl: previews[img] } : null;
            }}
            onUse={(t) => setDraft((d) => ({ ...d, caption: t }))}
          />

          <div className="sys-media">
            {draft.media_urls.map((path) => (
              <div className="sys-media__item" key={path}>
                {/\.(mp4|mov|webm)$/i.test(path)
                  ? <video src={previews[path]} muted playsInline />
                  : <img src={previews[path]} alt="" />}
                <button type="button" aria-label="Remove" onClick={() => setDraft((d) => ({ ...d, media_urls: d.media_urls.filter((m) => m !== path) }))}><X size={14} /></button>
              </div>
            ))}
            <label className="sys-media__add">
              <ImagePlus size={20} />
              <span>{uploading ? 'Uploading…' : 'Add photo / video'}</span>
              <input type="file" accept="image/*,video/*" multiple hidden onChange={(e) => uploadMedia([...e.target.files])} />
            </label>
          </div>

          <div className="sys-row">
            <label className="sys-field sys-grow">
              <span>Post on</span>
              <input type="datetime-local" value={draft.scheduled_for} onChange={(e) => setDraft({ ...draft, scheduled_for: e.target.value })} />
            </label>
          </div>

          <label className="sys-field">
            <span>Notes (team only)</span>
            <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>

          <div className="sys-row">
            <button className="sys-btn sys-btn--gold" onClick={() => savePost('scheduled')}><CalendarClock size={16} /> Schedule</button>
            <button className="sys-btn sys-btn--ghost" onClick={() => savePost('draft')}>Save draft</button>
            {editingId && <button className="sys-btn sys-btn--ghost" onClick={() => { setEditingId(null); setDraft(blankPost); }}>Cancel</button>}
          </div>
        </div>
      )}

      {tab === 'inbox' && <CommentsInbox />}
    </div>
  );
};

const PostCard = ({ p, previews, onEdit, onDelete, onPosted }) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // On phones this opens the native share sheet with the media attached,
  // so it goes straight into Instagram, TikTok, Facebook, etc.
  const share = async () => {
    setSharing(true);
    try {
      const files = await Promise.all((p.media_urls || []).map(async (path) => {
        const blob = await fetch(previews[path]).then((r) => r.blob());
        return new File([blob], path.split('/').pop(), { type: blob.type });
      }));
      const data = { text: p.caption || '', files };
      if (navigator.canShare?.(data)) await navigator.share(data);
      else if (navigator.share) await navigator.share({ text: p.caption || '' });
      else {
        await navigator.clipboard.writeText(p.caption || '');
        setCopied(true);
      }
    } catch { /* user closed the share sheet */ }
    setSharing(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(p.caption || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="sys-post">
      {p.media_urls?.[0] && (
        <div className="sys-post__thumb">
          {/\.(mp4|mov|webm)$/i.test(p.media_urls[0]) ? <video src={previews[p.media_urls[0]]} muted playsInline /> : <img src={previews[p.media_urls[0]]} alt="" />}
          {p.media_urls.length > 1 && <span>+{p.media_urls.length - 1}</span>}
        </div>
      )}
      <div className="sys-post__body">
        <div className="sys-post__meta">
          {p.scheduled_for && <span>{new Date(p.scheduled_for).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
          {(p.platforms || []).map((pl) => <span className="sys-pill" key={pl}>{pl}</span>)}
        </div>
        <p className="sys-post__caption">{p.caption || <em>No caption</em>}</p>
        <div className="sys-post__actions">
          {p.status !== 'posted' && <button className="sys-btn sys-btn--sm sys-btn--gold" onClick={share} disabled={sharing}><Share2 size={14} /> Share</button>}
          <button className="sys-btn sys-btn--sm sys-btn--ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} Copy</button>
          {onPosted && <button className="sys-btn sys-btn--sm sys-btn--ghost" onClick={() => onPosted(p.id)}><Check size={14} /> Posted</button>}
          <button className="sys-btn sys-btn--sm sys-btn--ghost" onClick={() => onEdit(p)}><PenSquare size={14} /> Edit</button>
          <button className="sys-icon-btn" onClick={() => onDelete(p.id)} aria-label="Delete post"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
};

const CommentsInbox = () => {
  const [platform, setPlatform] = useState('instagram');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [list, setList] = useState(null);

  const fetchComments = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setList(null);
    const { data, error: fnError } = await supabase.functions.invoke('social-search', {
      body: { action: 'comments', platform, url, limit: 50 },
    });
    setBusy(false);
    if (fnError) return setError('Comment service isn’t reachable — deploy the social-search function.');
    if (data?.error) return setError(data.error);
    setList(data.comments || []);
  };

  return (
    <>
      <form className="sys-card sys-form" onSubmit={fetchComments}>
        <div className="sys-chips">
          {['instagram', 'facebook'].map((pl) => (
            <button type="button" key={pl} className={`sys-chip ${platform === pl ? 'is-on' : ''}`} onClick={() => setPlatform(pl)}>{pl}</button>
          ))}
        </div>
        <label className="sys-field">
          <span>Post link</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" required />
        </label>
        <button className="sys-btn sys-btn--gold" disabled={busy}><MessageCircle size={16} /> {busy ? 'Fetching… (up to 2 min)' : 'Get comments'}</button>
        {error && <p className="sys-error">{error}</p>}
      </form>

      {list && list.length === 0 && <p className="sys-empty">No comments found on that post.</p>}
      <div className="sys-results">
        {(list || []).map((c, i) => (
          <article className="sys-result" key={i}>
            <div className="sys-result__main">
              <h3>{c.author_url ? <a href={c.author_url} target="_blank" rel="noreferrer">{c.author}</a> : c.author}</h3>
              <p>{c.text}</p>
              <div className="sys-result__meta">
                {c.at && <span>{new Date(c.at).toLocaleString()}</span>}
                {c.likes != null && <span>♥ {c.likes}</span>}
                                <a href={url} target="_blank" rel="noreferrer">Reply on post <ExternalLink size={13} /></a>
              </div>
              <AiAssist compact task="reply" label="Draft a reply" getInput={() => ({ author: c.author, comment: c.text, platform })} />
            </div>
          </article>
        ))}
      </div>
    </>
  );
};

export default Social;
