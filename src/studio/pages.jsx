import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Instagram, Facebook, Users, Eye, Heart, MessageCircle, Sparkles, CalendarClock, ImagePlus, Video, Send, Trash2, Pencil,
  ExternalLink, AlertTriangle, RefreshCw, Clapperboard, Inbox, MessagesSquare, X, Check, Clock, Upload,
} from 'lucide-react';
import { DashHead, DashEmpty } from '../apps/DashShell';
import { studio, uploadMedia, bestSlotsET, nextOccurrence, fmtET } from './api';

const ClipStudio = lazy(() => import('../features/clip-studio/ClipStudio'));
const PhotoStudio = lazy(() => import('../features/photo-studio/PhotoStudio'));

const PLATFORM = { instagram: { Icon: Instagram, label: 'Instagram' }, facebook: { Icon: Facebook, label: 'Facebook' } };
const fmtNum = (n) => (n == null ? '—' : n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('en-US'));
const toETInput = (iso) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

/** Load a studio action and keep it fresh. */
function useStudio(action, params, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});
  useEffect(() => {
    let live = true;
    if (!enabled) {
      Promise.resolve().then(() => live && setState({ data: null, loading: false, error: '' }));
      return () => { live = false; };
    }
    Promise.resolve().then(() => live && setState((s) => ({ ...s, loading: true, error: '' })));
    studio(action, params).then(
      (data) => live && setState({ data, loading: false, error: '' }),
      (err) => live && setState({ data: null, loading: false, error: err.message }),
    );
    return () => { live = false; };
  }, [action, key, version, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: useCallback(() => setVersion((v) => v + 1), []) };
}

const Problem = ({ error, onRetry }) => (
  <div className="ds-banner" role="alert"><AlertTriangle size={18} /> {error} {onRetry && <button className="k-btn k-btn--sm k-btn--ghost" onClick={onRetry}><RefreshCw size={14} /> Retry</button>}</div>
);

// ── Overview ─────────────────────────────────────────────────
export const StudioOverview = () => {
  const { data, loading, error, reload } = useStudio('overview');
  const accounts = data?.accounts || [];
  const ig = data?.igInsights?.metrics || {};
  const fb = data?.fbInsights?.metrics || {};
  const slots = bestSlotsET(data?.bestTime?.slots || []);
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Your socials," accent="at a glance" lead="Last 30 days across Instagram and Facebook. Insights can lag up to 48 hours." actions={<button className="k-btn k-btn--ghost k-btn--sm" onClick={reload}><RefreshCw size={15} /> Refresh</button>} />
      {error && <Problem error={error} onRetry={reload} />}
      {loading && !data && <p className="ds-muted">Loading your accounts…</p>}
      <div className="ds-grid ds-grid--2">
        {accounts.map((a) => {
          const P = PLATFORM[a.platform];
          return (
            <article key={a.id} className="ds-card">
              <div className="ds-card__head">
                <h2>{P && <P.Icon size={18} />} {a.platform === 'instagram' ? `@${a.username}` : a.displayName}</h2>
                <span className={`ds-pill ${a.active && !a.needsReconnection ? 'ds-pill--green' : 'ds-pill--red'}`}>{a.needsReconnection ? 'Reconnect' : a.active ? 'Connected' : 'Paused'}</span>
              </div>
              <p><strong style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--gold-hi)' }}>{fmtNum(a.followers)}</strong> <span className="ds-muted">followers</span></p>
              {a.tokenExpiresAt && <p className="ds-muted">Connection valid until {new Date(a.tokenExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — reconnect in Zernio before then.</p>}
              {a.profileUrl && <a className="k-link" href={a.profileUrl} target="_blank" rel="noopener noreferrer">Open profile <ExternalLink size={14} /></a>}
            </article>
          );
        })}
      </div>

      {data && (
        <>
          <section className="ds-section">
            <h2><Instagram size={18} style={{ verticalAlign: '-3px' }} /> Instagram · 30 days</h2>
            <div className="ds-grid ds-grid--4">
              <div className="ds-stat"><strong>{fmtNum(ig.reach?.total)}</strong><span><Users size={12} /> Accounts reached</span></div>
              <div className="ds-stat"><strong>{fmtNum(ig.views?.total)}</strong><span><Eye size={12} /> Views</span></div>
              <div className="ds-stat"><strong>{fmtNum(ig.accounts_engaged?.total)}</strong><span><Heart size={12} /> Accounts engaged</span></div>
              <div className="ds-stat"><strong>{fmtNum(ig.total_interactions?.total)}</strong><span><MessageCircle size={12} /> Interactions</span></div>
            </div>
          </section>
          <section className="ds-section">
            <h2><Facebook size={18} style={{ verticalAlign: '-3px' }} /> Facebook · 30 days</h2>
            <div className="ds-grid ds-grid--4">
              <div className="ds-stat"><strong>{fmtNum(fb.page_media_view?.total)}</strong><span>Media views</span></div>
              <div className="ds-stat"><strong>{fmtNum(fb.page_post_engagements?.total)}</strong><span>Post engagements</span></div>
              <div className="ds-stat"><strong>{fmtNum(fb.page_follows?.total)}</strong><span>Page follows</span></div>
              <div className="ds-stat"><strong>{fmtNum((fb.followers_gained?.total || 0) - (fb.followers_lost?.total || 0))}</strong><span>Net new followers</span></div>
            </div>
          </section>
          <section className="ds-section">
            <h2><Clock size={18} style={{ verticalAlign: '-3px' }} /> Best times to post (Eastern)</h2>
            {slots.length ? (
              <div className="ds-grid ds-grid--3">
                {slots.map((s, i) => (
                  <Link key={i} to="/studio/compose" state={{ when: nextOccurrence(s.day, s.hour) }} className="ds-row">
                    <CalendarClock size={18} /><div><strong>{s.label}</strong><small>Avg engagement {Math.round(s.score)} · {s.posts} past post{s.posts === 1 ? '' : 's'}</small></div>
                  </Link>
                ))}
              </div>
            ) : <p className="ds-muted">Not enough posts yet to rank times.</p>}
          </section>
        </>
      )}
    </>
  );
};

// ── Calendar (scheduled + published) ─────────────────────────
const EditModal = ({ post, onClose, onSaved }) => {
  const [content, setContent] = useState(post.content);
  const [when, setWhen] = useState(post.scheduledFor ? toETInput(post.scheduledFor) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await studio('update', { postId: post.id, content, scheduledFor: when, timezone: 'America/New_York' }); onSaved(); onClose(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="ds-modal" role="dialog" aria-modal="true" aria-label="Edit post" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal__panel">
        <button className="k-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Edit scheduled post</h2>
        <form className="ds-form" onSubmit={save}>
          <label className="k-field"><span>Caption (applies where no platform-specific caption was set)</span><textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} /></label>
          <label className="k-field"><span>Goes out (Eastern time)</span><input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
    </div>
  );
};

export const StudioCalendar = () => {
  const { data, loading, error, reload } = useStudio('posts');
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState('scheduled');
  const byDay = useMemo(() => {
    const groups = new Map();
    (data?.scheduled || []).forEach((p) => {
      const d = new Date(p.scheduledFor).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' });
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d).push(p);
    });
    return [...groups.entries()];
  }, [data]);
  const remove = async (p) => {
    if (!window.confirm('Delete this scheduled post? It won’t go out.')) return;
    try { await studio('remove', { postId: p.id }); reload(); } catch (err) { window.alert(err.message); }
  };
  const published = (data?.published || []).flatMap((a) => a.posts.map((p) => ({ ...p, platform: a.platform }))).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Content" accent="calendar" lead="Everything queued to go out, and how recent posts are doing."
        actions={<Link to="/studio/compose" className="k-btn k-btn--gold"><Send size={16} /> New post</Link>} />
      {error && <Problem error={error} onRetry={reload} />}
      <div className="ds-tabs-inline" role="tablist">
        <button role="tab" aria-selected={tab === 'scheduled'} onClick={() => setTab('scheduled')}>Scheduled ({data?.scheduled?.length ?? '…'})</button>
        <button role="tab" aria-selected={tab === 'published'} onClick={() => setTab('published')}>Published</button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>Studio history</button>
      </div>
      {loading && !data && <p className="ds-muted">Loading…</p>}

      {tab === 'scheduled' && data && (byDay.length ? byDay.map(([day, posts]) => (
        <section key={day} className="ds-section" style={{ marginTop: 18 }}>
          <h2>{day}</h2>
          <div className="ds-grid ds-grid--2">
            {posts.map((p) => (
              <article key={p.id} className="ds-card st-post">
                {p.media[0] && <img className="st-post__media" src={p.media[0].thumbnail || p.media[0].url} alt="" loading="lazy" />}
                <div className="st-post__body">
                  <div className="ds-card__head">
                    <span className="ds-pill ds-pill--gold"><Clock size={12} /> {fmtET(p.scheduledFor).split(', ').pop()}</span>
                    <span className="st-plats">{p.platforms.map((x) => { const P = PLATFORM[x.platform]; return P ? <P.Icon key={x.platform} size={16} aria-label={P.label} /> : null; })}</span>
                  </div>
                  <p className="st-post__text">{p.content}</p>
                  <div className="k-actions">
                    <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => setEdit(p)}><Pencil size={14} /> Edit</button>
                    <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => remove(p)}><Trash2 size={14} /> Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )) : <DashEmpty Icon={CalendarClock} title="Nothing scheduled" action={<Link to="/studio/compose" className="k-btn k-btn--gold">Schedule a post</Link>}>Queue up your next post from the composer.</DashEmpty>)}

      {tab === 'published' && data && (published.length ? (
        <div className="ds-grid ds-grid--3">
          {published.map((p) => {
            const P = PLATFORM[p.platform];
            return (
              <article key={`${p.platform}-${p.id}`} className="ds-card st-post st-post--stack">
                {p.picture && <img className="st-post__media" src={p.picture} alt="" loading="lazy" />}
                <div className="st-post__body">
                  <div className="ds-card__head"><span className="ds-muted">{P && <P.Icon size={14} />} {new Date(p.createdTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="ds-muted"><Heart size={13} /> {fmtNum(p.likes)} · <MessageCircle size={13} /> {fmtNum(p.comments)}</span></div>
                  <p className="st-post__text">{p.message}</p>
                  {p.permalink && <a className="k-link" href={p.permalink} target="_blank" rel="noopener noreferrer">View post <ExternalLink size={13} /></a>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="ds-muted">No published posts found.</p>)}

      {tab === 'history' && data && (data.recent.length ? (
        <ul className="ds-list">{data.recent.map((p) => (
          <li key={p.id} className="ds-row"><Sparkles size={18} /><div><strong>{p.title || p.content.slice(0, 60)}</strong><small>{p.status} · {fmtET(p.publishedAt || p.scheduledFor)} · {p.platforms.map((x) => `${x.platform}: ${x.status}`).join(', ')}</small>{p.platforms.some((x) => x.error) && <small style={{ color: '#ff9b9b' }}>{p.platforms.map((x) => x.error).filter(Boolean).join(' · ')}</small>}</div></li>
        ))}</ul>
      ) : <p className="ds-muted">No posts have gone out through the studio yet.</p>)}

      {edit && <EditModal post={edit} onClose={() => setEdit(null)} onSaved={reload} />}
    </>
  );
};

// ── Compose ──────────────────────────────────────────────────
export const StudioCompose = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const overview = useStudio('overview');
  const slots = bestSlotsET(overview.data?.bestTime?.slots || [], 4);
  const [platforms, setPlatforms] = useState(['instagram', 'facebook']);
  const [content, setContent] = useState('');
  const [split, setSplit] = useState(false);
  const [fbContent, setFbContent] = useState('');
  const [media, setMedia] = useState(location.state?.media || []);
  const [when, setWhen] = useState(location.state?.when || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const toggle = (p) => setPlatforms((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));
  const addFiles = async (files) => {
    setError('');
    for (const f of [...files].slice(0, 10 - media.length)) {
      const type = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : null;
      if (!type) { setError(`${f.name}: use a photo or video.`); continue; }
      setBusy(`Uploading ${f.name}…`);
      try {
        const url = await uploadMedia(f);
        setMedia((m) => [...m, { type, url, name: f.name, preview: URL.createObjectURL(f), altText: '' }]);
      } catch (err) { setError(err.message); }
    }
    setBusy('');
  };
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!platforms.length) return setError('Pick at least one platform.');
    if (!when) return setError('Choose when it should go out.');
    setBusy('Scheduling…');
    try {
      const out = await studio('create', {
        platforms, content, fbContent: split ? fbContent : undefined, scheduledFor: when, timezone: 'America/New_York',
        media: media.map(({ type, url, altText }) => ({ type, url, altText })),
      });
      setDone(out.post);
    } catch (err) { setError(err.message); }
    setBusy('');
  };

  if (done) {
    return (
      <DashEmpty Icon={Check} title="Scheduled" action={<div className="k-actions" style={{ justifyContent: 'center' }}>
        <Link to="/studio/calendar" className="k-btn k-btn--gold">View calendar</Link>
        <button className="k-btn k-btn--ghost" onClick={() => navigate(0)}>Write another</button>
      </div>}>Goes out {fmtET(done.scheduledFor)} (Eastern) on {platforms.join(' and ')}.</DashEmpty>
    );
  }

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Create a" accent="post" lead="Write once, publish to Instagram and Facebook at the time you choose." />
      <form className="ds-grid ds-grid--2" onSubmit={submit} style={{ alignItems: 'start' }}>
        <div className="ds-card ds-form">
          <div className="k-field"><span>Post to</span>
            <div className="k-segs">
              {Object.entries(PLATFORM).map(([k, P]) => <button type="button" key={k} aria-pressed={platforms.includes(k)} onClick={() => toggle(k)}><P.Icon size={15} style={{ verticalAlign: '-3px' }} /> {P.label}</button>)}
            </div>
          </div>
          <label className="k-field"><span>Caption <em className="ds-muted" style={{ fontStyle: 'normal' }}>{content.length}/2200</em></span>
            <textarea rows={9} maxLength={2200} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your caption — Instagram links aren’t clickable, so say “link in bio”." />
          </label>
          {platforms.includes('facebook') && platforms.includes('instagram') && (
            <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={split} onChange={(e) => { setSplit(e.target.checked); if (e.target.checked && !fbContent) setFbContent(content); }} /><div><strong>Different caption for Facebook</strong><small>Use real links and names instead of @handles</small></div></label>
          )}
          {split && <label className="k-field"><span>Facebook caption</span><textarea rows={6} value={fbContent} onChange={(e) => setFbContent(e.target.value)} /></label>}
        </div>

        <div className="ds-grid">
          <div className="ds-card ds-form">
            <div className="k-field"><span>Photos or video {platforms.includes('instagram') ? '(required for Instagram)' : ''}</span>
              <label className="st-drop">
                <Upload size={20} /> <strong>Add media</strong> <small>JPG, PNG, MP4 · up to 10</small>
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            {media.length > 0 && (
              <div className="st-media">
                {media.map((m, i) => (
                  <figure key={m.url}>
                    {m.type === 'video' ? <video src={m.preview || m.url} muted playsInline /> : <img src={m.preview || m.url} alt="" />}
                    <input className="k-input" placeholder="Alt text (describe it)" value={m.altText || ''} onChange={(e) => setMedia(media.map((x, j) => (j === i ? { ...x, altText: e.target.value } : x)))} />
                    <button type="button" className="ds-icon-btn" onClick={() => setMedia(media.filter((_, j) => j !== i))} aria-label="Remove"><X size={14} /></button>
                  </figure>
                ))}
              </div>
            )}
            <p className="ds-muted"><Link to="/studio/create" className="k-link"><Clapperboard size={14} /> Make a reel or product photo in the creative tools</Link></p>
          </div>

          <div className="ds-card ds-form">
            <label className="k-field"><span>Goes out (Eastern time)</span><input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></label>
            {slots.length > 0 && (
              <div className="k-field"><span>Suggested — when your audience engages most</span>
                <div className="k-segs">{slots.map((s, i) => { const v = nextOccurrence(s.day, s.hour); return <button type="button" key={i} aria-pressed={when === v} onClick={() => setWhen(v)}>{s.label}</button>; })}</div>
              </div>
            )}
            {error && <p className="k-error" role="alert">{error}</p>}
            {busy && <p className="ds-muted" role="status">{busy}</p>}
            <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={!!busy}><CalendarClock size={18} /> Schedule post</button>
          </div>
        </div>
      </form>
    </>
  );
};

// ── Inbox (read-only) ────────────────────────────────────────
export const StudioInbox = () => {
  const [platform, setPlatform] = useState('');
  const list = useStudio('inbox', platform ? { platform } : {});
  const [open, setOpen] = useState(null);
  const thread = useStudio('thread', open ? { conversationId: open.id, accountId: open.accountId } : {}, !!open);
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Messages" lead="Instagram and Facebook DMs, including Carla’s replies. Read-only here — reply from the Instagram or Facebook app or Zernio." />
      <div className="ds-tabs-inline" role="tablist">
        {[['', 'All'], ['instagram', 'Instagram'], ['facebook', 'Facebook']].map(([v, l]) => <button key={l} role="tab" aria-selected={platform === v} onClick={() => { setPlatform(v); setOpen(null); }}>{l}</button>)}
      </div>
      {list.error && <Problem error={list.error} onRetry={list.reload} />}
      <div className="ds-grid ds-grid--2" style={{ alignItems: 'start' }}>
        <ul className="ds-list">
          {(list.data?.conversations || []).map((c) => {
            const P = PLATFORM[c.platform];
            return (
              <li key={c.id}><button className={`ds-row ${open?.id === c.id ? 'is-open' : ''}`} onClick={() => setOpen(c)}>
                {c.picture ? <img src={c.picture} alt="" className="st-avatar" /> : <Inbox size={20} />}
                <div><strong>{c.name}{c.username ? ` · @${c.username}` : ''}</strong><small>{c.last || '—'}</small></div>
                {c.unread > 0 && <span className="ds-badge">{c.unread}</span>}
                {P && <P.Icon size={15} />}
              </button></li>
            );
          })}
          {list.data && !list.data.conversations?.length && <li className="ds-muted">No conversations.</li>}
        </ul>
        <div className="ds-card">
          {open ? (
            <>
              <h3>{open.name}</h3>
              {thread.loading ? <p className="ds-muted">Loading…</p> : thread.error ? <p className="k-error">{thread.error}</p> : (
                <div className="ds-thread">
                  {(thread.data?.messages || []).map((m) => (
                    <div key={m.id} className={`ds-msg ${m.direction === 'outgoing' ? 'is-mine' : ''}`}>
                      {m.text || (m.attachments.length ? `[${m.attachments.join(', ')}]` : '—')}
                      <small>{m.direction === 'outgoing' ? 'P31' : open.name} · {fmtET(m.at)}</small>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : <p className="ds-muted"><MessagesSquare size={16} /> Pick a conversation to read it.</p>}
        </div>
      </div>
    </>
  );
};

// ── Comments (read-only) ─────────────────────────────────────
export const StudioComments = () => {
  const posts = useStudio('comments');
  const [open, setOpen] = useState(null);
  const comments = useStudio('postComments', open ? { postId: open.id, accountId: open.accountId } : {}, !!open);
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Comments" lead="Recent posts with comments. Read-only here — reply from the app or Zernio." />
      {posts.error && <Problem error={posts.error} onRetry={posts.reload} />}
      <div className="ds-grid ds-grid--2" style={{ alignItems: 'start' }}>
        <ul className="ds-list">
          {(posts.data?.posts || []).map((p) => {
            const P = PLATFORM[p.platform];
            return (
              <li key={p.id}><button className="ds-row" onClick={() => setOpen(p)}>
                {p.picture ? <img src={p.picture} alt="" className="st-thumb" /> : <ImagePlus size={20} />}
                <div><strong>{(p.text || '').split('\n')[0].slice(0, 70) || 'Post'}</strong><small>{P?.label} · {p.comments ?? 0} comments · {p.at ? new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</small></div>
              </button></li>
            );
          })}
        </ul>
        <div className="ds-card">
          {open ? (
            <>
              <div className="ds-card__head"><h3>Comments</h3>{open.permalink && <a className="k-link" href={open.permalink} target="_blank" rel="noopener noreferrer">Open post <ExternalLink size={13} /></a>}</div>
              {comments.loading ? <p className="ds-muted">Loading…</p> : comments.error ? <p className="k-error">{comments.error}</p> : (
                <ul className="ds-list">{(comments.data?.comments || []).map((c) => (
                  <li key={c.id} className="ds-row"><MessageCircle size={16} /><div><strong>{c.from}</strong><small style={{ whiteSpace: 'pre-wrap' }}>{c.text}</small><small>{c.at ? fmtET(c.at) : ''}</small></div></li>
                ))}{!comments.data?.comments?.length && <li className="ds-muted">No comments loaded.</li>}</ul>
              )}
            </>
          ) : <p className="ds-muted">Pick a post to read its comments.</p>}
        </div>
      </div>
    </>
  );
};

// ── Creative tools → straight into a post ────────────────────
export const StudioCreate = () => {
  const navigate = useNavigate();
  const [tool, setTool] = useState('clip');
  const useIt = async (blob, meta) => {
    const file = new File([blob], meta.name || `p31-${Date.now()}`, { type: blob.type || meta.type });
    const url = await uploadMedia(file);
    navigate('/studio/compose', { state: { media: [{ type: file.type.startsWith('video/') ? 'video' : 'image', url, name: file.name, altText: '' }] } });
  };
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Creative" accent="tools" lead="Auto-edit a reel from raw footage, or style a product photo — then send it straight to the composer." />
      <div className="ds-tabs-inline" role="tablist">
        <button role="tab" aria-selected={tool === 'clip'} onClick={() => setTool('clip')}><Video size={15} style={{ verticalAlign: '-3px' }} /> Clip Studio</button>
        <button role="tab" aria-selected={tool === 'photo'} onClick={() => setTool('photo')}><ImagePlus size={15} style={{ verticalAlign: '-3px' }} /> Photo Studio</button>
      </div>
      <Suspense fallback={<p className="ds-muted">Loading…</p>}>
        {tool === 'clip' ? <ClipStudio onSave={useIt} saveLabel="Use in a post" /> : <PhotoStudio onSave={useIt} saveLabel="Use in a post" />}
      </Suspense>
    </>
  );
};
