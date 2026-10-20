import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Instagram, Facebook, Users, Eye, Heart, MessageCircle, Sparkles, CalendarClock, ImagePlus, Video, Send, Trash2, Pencil,
  ExternalLink, AlertTriangle, RefreshCw, Clapperboard, Inbox, MessagesSquare, X, Check, Clock, Upload, Copy,
} from 'lucide-react';
import { DashHead, DashEmpty } from '../apps/DashShell';
import SoundPicker from './SoundPicker';
import Handoffs from './Handoffs';
import { postPack } from './ai';
import { studio, uploadMedia, bestSlotsET, nextOccurrence, fmtET } from './api';
import DesktopOnly, { DesktopTag } from '../components/DesktopOnly';
import { isPhone, useIsPhone } from '../lib/device';

const ClipStudio = lazy(() => import('../features/clip-studio/ClipStudio'));
const PhotoStudio = lazy(() => import('../features/photo-studio/PhotoStudio'));

// The TikTok mark from the site header and footer (lucide has none).
const TikTok = ({ size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={rest['aria-label'] ? undefined : 'true'} {...rest}>
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.5z" />
  </svg>
);
const PLATFORM = { instagram: { Icon: Instagram, label: 'Instagram' }, facebook: { Icon: Facebook, label: 'Facebook' }, tiktok: { Icon: TikTok, label: 'TikTok' } };
// The brand an account or post speaks for (studio-zernio tags each one); same badges as Handoffs.
const BRAND = { market: { label: 'Marketplace', className: 'ds-pill ds-pill--gold' }, collective: { label: 'Collective', className: 'ds-pill' } };
const BrandBadge = ({ site }) => (site === 'both'
  ? <><BrandBadge site="market" /> <BrandBadge site="collective" /></>
  : BRAND[site] ? <span className={BRAND[site].className}>{BRAND[site].label}</span> : null);
const at = (u) => `@${String(u || '').replace(/^@/, '')}`;
/** An account in a few words: @handle, or the Facebook page's name. */
const accountLabel = (a) => (a.platform === 'facebook' ? a.displayName || 'Facebook page' : at(a.username));
/** A workspace Zernio could not read right now: the rest still shows, with a line saying so. */
const Notes = ({ notes }) => (notes?.length ? <p className="ds-muted" role="status"><AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {notes.map((n) => n.error).join(' · ')}</p> : null);
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
  // 30-day numbers for every Instagram and Facebook account (an older function sent only the Marketplace's two).
  const sections = data?.insights || (data ? [
    { accountId: 'ig', platform: 'instagram', site: 'market', username: accounts.find((a) => a.platform === 'instagram')?.username, insights: data.igInsights },
    { accountId: 'fb', platform: 'facebook', site: 'market', displayName: accounts.find((a) => a.platform === 'facebook')?.displayName, insights: data.fbInsights },
  ] : []);
  const slots = bestSlotsET(data?.bestTime?.slots || []);
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Your socials," accent="at a glance" lead="Both brands’ Instagram, Facebook and TikTok, with the last 30 days on Instagram and Facebook. Insights can lag up to 48 hours." actions={<button className="k-btn k-btn--ghost k-btn--sm" onClick={reload}><RefreshCw size={15} /> Refresh</button>} />
      {error && <Problem error={error} onRetry={reload} />}
      <Notes notes={data?.notes} />
      {loading && !data && <p className="ds-muted">Loading your accounts…</p>}
      <div className="ds-grid ds-grid--2">
        {accounts.map((a) => {
          const P = PLATFORM[a.platform];
          return (
            <article key={a.id} className="ds-card">
              <div className="ds-card__head">
                <h2>{P && <P.Icon size={18} />} {accountLabel(a)}</h2>
                <span className={`ds-pill ${a.active && !a.needsReconnection ? 'ds-pill--green' : 'ds-pill--red'}`}>{a.needsReconnection ? 'Reconnect' : a.active ? 'Connected' : 'Paused'}</span>
              </div>
              <p><BrandBadge site={a.site} /> <span className="ds-muted">{P?.label || a.platform}</span></p>
              <p><strong style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: 'var(--gold-hi)' }}>{fmtNum(a.followers)}</strong> <span className="ds-muted">followers</span></p>
              {a.tokenExpiresAt && <p className="ds-muted">Connection valid until {new Date(a.tokenExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — reconnect in Zernio before then.</p>}
              {a.profileUrl && <a className="k-link" href={a.profileUrl} target="_blank" rel="noopener noreferrer">Open profile <ExternalLink size={14} /></a>}
            </article>
          );
        })}
      </div>

      {data && (
        <>
          {sections.map((s) => {
            const m = s.insights?.metrics || {};
            const P = PLATFORM[s.platform];
            return (
              <section key={s.accountId} className="ds-section">
                <h2>{P && <P.Icon size={18} style={{ verticalAlign: '-3px' }} />} {s.platform === 'instagram' ? (s.username ? at(s.username) : 'Instagram') : (s.displayName || 'Facebook')} · 30 days <BrandBadge site={s.site} /></h2>
                {s.platform === 'instagram' ? (
                  <div className="ds-grid ds-grid--4">
                    <div className="ds-stat"><strong>{fmtNum(m.reach?.total)}</strong><span><Users size={12} /> Accounts reached</span></div>
                    <div className="ds-stat"><strong>{fmtNum(m.views?.total)}</strong><span><Eye size={12} /> Views</span></div>
                    <div className="ds-stat"><strong>{fmtNum(m.accounts_engaged?.total)}</strong><span><Heart size={12} /> Accounts engaged</span></div>
                    <div className="ds-stat"><strong>{fmtNum(m.total_interactions?.total)}</strong><span><MessageCircle size={12} /> Interactions</span></div>
                  </div>
                ) : (
                  <div className="ds-grid ds-grid--4">
                    <div className="ds-stat"><strong>{fmtNum(m.page_media_view?.total)}</strong><span>Media views</span></div>
                    <div className="ds-stat"><strong>{fmtNum(m.page_post_engagements?.total)}</strong><span>Post engagements</span></div>
                    <div className="ds-stat"><strong>{fmtNum(m.page_follows?.total)}</strong><span>Page follows</span></div>
                    <div className="ds-stat"><strong>{fmtNum((m.followers_gained?.total || 0) - (m.followers_lost?.total || 0))}</strong><span>Net new followers</span></div>
                  </div>
                )}
              </section>
            );
          })}
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
/** Change the caption of a post that is already on Facebook (Instagram does not allow it). */
const FacebookCaption = ({ post, onClose, onSaved }) => {
  const fb = post.platforms.find((x) => x.platform === 'facebook');
  const [content, setContent] = useState(fb?.customContent || post.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await studio('editPublished', { postId: post.id, workspace: post.workspace, platform: 'facebook', content }); onSaved(); onClose(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  return (
    <div className="ds-modal" role="dialog" aria-modal="true" aria-label="Edit the Facebook caption" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ds-modal__panel">
        <button className="k-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>Edit the Facebook caption</h2>
        <p className="ds-muted">This post is already live. Facebook lets the caption change; Instagram does not.</p>
        <form className="ds-form" onSubmit={save}>
          <label className="k-field"><span>Caption</span><textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} /></label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save the caption'}</button>
        </form>
      </div>
    </div>
  );
};

export const StudioCalendar = () => {
  const { data, loading, error, reload } = useStudio('posts');
  const navigate = useNavigate();
  const [fbEdit, setFbEdit] = useState(null);
  const [tab, setTab] = useState('scheduled');
  const act = async (fn, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { await fn(); reload(); } catch (err) { window.alert(err.message); }
  };
  const duplicate = (p) => navigate('/studio/compose', { state: { copy: { ...fieldsFromPost(p), when: '' } } });
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
    try { await studio('remove', { postId: p.id, workspace: p.workspace }); reload(); } catch (err) { window.alert(err.message); }
  };
  const published = (data?.published || []).flatMap((a) => a.posts.map((p) => ({ ...p, platform: a.platform, accountId: a.accountId, username: a.username, site: a.site }))).sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Content" accent="calendar" lead="Everything queued to go out, and how recent posts are doing."
        actions={<Link to="/studio/compose" className="k-btn k-btn--gold"><Send size={16} /> New post</Link>} />
      {error && <Problem error={error} onRetry={reload} />}
      <Notes notes={data?.notes} />
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
                    <BrandBadge site={p.site} />
                    <span className="st-plats">{p.platforms.map((x) => { const P = PLATFORM[x.platform]; return P ? <P.Icon key={`${x.platform}-${x.accountId}`} size={16} aria-label={`${P.label}${x.accountUsername ? ` ${at(x.accountUsername)}` : ''}`} /> : null; })}</span>
                  </div>
                  <p className="st-post__text">{p.content}</p>
                  <div className="k-actions">
                    <Link className="k-btn k-btn--sm k-btn--ghost" to={editLink(p)}><Pencil size={14} /> Edit</Link>
                    <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => duplicate(p)}><Copy size={14} /> Duplicate</button>
                    <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => act(() => studio('update', { postId: p.id, workspace: p.workspace, publishNow: true }), 'Send this post right now instead of at its scheduled time?')}><Send size={14} /> Post now</button>
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
              <article key={`${p.accountId}-${p.id}`} className="ds-card st-post st-post--stack">
                {p.picture && <img className="st-post__media" src={p.picture} alt="" loading="lazy" />}
                <div className="st-post__body">
                  <div className="ds-card__head"><span className="ds-muted">{P && <P.Icon size={14} />} {p.platform === 'facebook' ? '' : p.username ? `${at(p.username)} · ` : ''}{new Date(p.createdTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
        <ul className="ds-list">{data.recent.map((p) => {
          const fbLive = p.platforms.some((x) => x.platform === 'facebook' && x.status === 'published');
          const failed = p.status === 'failed' || p.status === 'partial' || p.platforms.some((x) => x.status === 'failed');
          const live = p.status === 'published' || p.platforms.some((x) => x.status === 'published');
          return (
            <li key={p.id} className="ds-row st-history">
              <Sparkles size={18} />
              <div>
                <strong>{p.title || p.content.slice(0, 60)}</strong>
                <small>{p.status} · {fmtET(p.publishedAt || p.scheduledFor)} · {p.platforms.map((x) => `${PLATFORM[x.platform]?.label || x.platform}${x.accountUsername && x.platform !== 'facebook' ? ` ${at(x.accountUsername)}` : ''}: ${x.status}`).join(', ')}</small>
                {p.platforms.some((x) => x.error) && <small style={{ color: '#ff9b9b' }}>{p.platforms.map((x) => x.error).filter(Boolean).join(' · ')}</small>}
                <div className="k-actions st-history__actions">
                  {failed && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => act(() => studio('retry', { postId: p.id, workspace: p.workspace }))}><RefreshCw size={14} /> Try again</button>}
                  {!live && <Link className="k-btn k-btn--sm k-btn--ghost" to={editLink(p)}><Pencil size={14} /> Edit</Link>}
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => duplicate(p)}><Copy size={14} /> Duplicate</button>
                  {fbLive && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => setFbEdit(p)}><Facebook size={14} /> Edit Facebook caption</button>}
                  {fbLive && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => act(() => studio('unpublish', { postId: p.id, workspace: p.workspace, platform: 'facebook' }), 'Take this post down from Facebook? It cannot be put back.')}><Trash2 size={14} /> Remove from Facebook</button>}
                  {!live && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => act(() => studio('remove', { postId: p.id, workspace: p.workspace }), 'Delete this post from the studio? This cannot be undone.')}><Trash2 size={14} /> Delete</button>}
                  {p.platforms.filter((x) => x.url).map((x) => <a key={`${x.platform}-${x.accountId}`} className="k-link" href={x.url} target="_blank" rel="noopener noreferrer">Open on {PLATFORM[x.platform]?.label || x.platform} <ExternalLink size={13} /></a>)}
                </div>
                {live && p.platforms.some((x) => x.platform === 'instagram' && x.status === 'published') && <small className="ds-muted">Instagram does not let a published post be changed or removed from here; use the Instagram app.</small>}
              </div>
            </li>
          );
        })}</ul>
      ) : <p className="ds-muted">No posts have gone out through the studio yet.</p>)}

      {fbEdit && <FacebookCaption post={fbEdit} onClose={() => setFbEdit(null)} onSaved={reload} />}
    </>
  );
};

// ── Compose (new posts) and Edit (?edit=<post id>&ws=<workspace>), one form ──
/** The composer's fields from a Zernio post (for editing it, or for a copy): every account it goes to, TikTok included. */
const fieldsFromPost = (p) => {
  const ig = p.platforms.find((x) => x.platform === 'instagram');
  const fb = p.platforms.find((x) => x.platform === 'facebook');
  const tt = p.platforms.find((x) => x.platform === 'tiktok');
  return {
    accountIds: p.platforms.map((x) => x.accountId).filter(Boolean),
    platforms: [...new Set(p.platforms.map((x) => x.platform).filter((x) => PLATFORM[x]))],
    workspace: p.workspace || null,
    content: p.content || '',
    split: !!(fb?.customContent && fb.customContent !== p.content),
    fbContent: fb?.customContent || '',
    ttSplit: !!(tt?.customContent && tt.customContent !== p.content),
    ttContent: tt?.customContent || '',
    firstComment: ig?.firstComment || '',
    media: p.media.map((m) => ({ type: m.type, url: m.url, thumbnail: m.thumbnail, altText: m.altText || '', name: m.url.split('/').pop() })),
    audio: ig?.audioId ? { id: ig.audioId, title: 'the track already on it' } : null,
    when: p.scheduledFor ? toETInput(p.scheduledFor) : '',
  };
};
/** The composer link for a post, with the Zernio workspace it lives in when known. */
const editLink = (p) => `/studio/compose?edit=${encodeURIComponent(p.id)}${p.workspace ? `&ws=${encodeURIComponent(p.workspace)}` : ''}`;
const isWebm = (m) => m.type === 'video' && /\.webm(?:[?#]|$)/i.test(m.name || m.url || '');

export const StudioCompose = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const search = new URLSearchParams(location.search);
  const editId = search.get('edit');
  const wsParam = search.get('ws');
  const copy = location.state?.copy || null;
  const overview = useStudio('overview');
  const slots = bestSlotsET(overview.data?.bestTime?.slots || [], 4);
  // Where it goes: chosen accounts by id. Until someone picks, the Marketplace's accounts on the
  // given platforms (Instagram and Facebook, as before; the Design studio sends its own list).
  const accountsQ = useStudio('accounts');
  const accounts = useMemo(() => accountsQ.data?.accounts || [], [accountsQ.data]);
  const [picked, setPicked] = useState(copy?.accountIds?.length ? copy.accountIds : null);
  const [fallback, setFallback] = useState(copy?.platforms?.length ? copy.platforms : ['instagram', 'facebook']);
  const [content, setContent] = useState(copy?.content || '');
  const [split, setSplit] = useState(!!copy?.split);
  const [fbContent, setFbContent] = useState(copy?.fbContent || '');
  const [ttSplit, setTtSplit] = useState(!!copy?.ttSplit);
  const [ttContent, setTtContent] = useState(copy?.ttContent || '');
  const [media, setMedia] = useState(copy?.media || location.state?.media || []);
  const [when, setWhen] = useState(location.state?.when || '');
  const [busy, setBusy] = useState(editId ? 'Loading the post…' : '');
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const [topic, setTopic] = useState('');
  const [pack, setPack] = useState(null);
  const [firstComment, setFirstComment] = useState(copy?.firstComment || '');
  const [audio, setAudio] = useState(copy?.audio || null);
  const [showSound, setShowSound] = useState(false);
  // From the Design studio: the finished card as the reel's cover, and how loud the reel's own
  // music plays under an Instagram track (off for designs, whose music is only a background bed).
  const [cover, setCover] = useState(copy?.coverUrl || null);
  const [videoVolume, setVideoVolume] = useState(copy?.videoVolume ?? 100);
  const [editing, setEditing] = useState(null); // the post being edited, once loaded
  const isReel = media.length === 1 && media[0].type === 'video';

  const chosen = useMemo(() => (picked
    ? accounts.filter((a) => picked.includes(a.id))
    : fallback.map((p) => accounts.find((a) => a.platform === p && a.site === 'market')).filter(Boolean)), [accounts, picked, fallback]);
  // With no account list (Zernio unreachable, or an older function), the platforms stand in.
  const plats = accounts.length ? [...new Set(chosen.map((a) => a.platform))] : fallback;
  const hasIG = plats.includes('instagram');
  const hasFB = plats.includes('facebook');
  const hasTT = plats.includes('tiktok');
  // Accounts a saved post names that are no longer connected (a reconnect gives an account a new id).
  const gone = accounts.length && picked ? picked.filter((id) => !accounts.some((a) => a.id === id)) : [];
  const whereOf = (list) => (accounts.length ? list.map((a) => `${accountLabel(a)} (${PLATFORM[a.platform]?.label || a.platform})`).join(', ') : plats.map((p) => PLATFORM[p]?.label || p).join(' and '));
  const where = whereOf(chosen);
  // A saved post stays in its own Zernio workspace; the others are for a copy.
  const lockWs = editId ? (editing?.workspace || wsParam || null) : null;

  // Editing: load the post and fill every field from it.
  useEffect(() => {
    if (!editId) return undefined;
    let live = true;
    studio('get', { postId: editId, workspace: wsParam || undefined }).then(({ post }) => {
      if (!live) return;
      const f = fieldsFromPost(post);
      setEditing(post);
      setPicked(f.accountIds); setFallback(f.platforms.length ? f.platforms : ['instagram', 'facebook']);
      setContent(f.content); setSplit(f.split); setFbContent(f.fbContent); setTtSplit(f.ttSplit); setTtContent(f.ttContent);
      setFirstComment(f.firstComment); setMedia(f.media); setAudio(f.audio); setWhen(f.when); setBusy('');
    }, (err) => { if (live) { setError(err.message); setBusy(''); } });
    return () => { live = false; };
  }, [editId, wsParam]);
  const goneOut = editing && ['published', 'publishing'].includes(editing.status);
  const target = () => (accounts.length ? { accountIds: chosen.map((a) => a.id) } : picked?.length ? { accountIds: picked } : { platforms: fallback });
  const fields = () => ({
    ...target(), content, fbContent: split ? fbContent : undefined, ttContent: hasTT && ttSplit ? ttContent : undefined,
    scheduledFor: when, timezone: 'America/New_York',
    media: media.map(({ type, url, altText, thumbnail }) => ({ type, url, altText, thumbnail })),
    audioId: isReel && audio ? audio.id : undefined, firstComment: !isReel && firstComment ? firstComment : undefined,
    ...(isReel && audio ? { audioVolume: 100, videoVolume } : {}), coverUrl: isReel && cover ? cover : undefined,
  });
  const postNow = async () => {
    if (!window.confirm('Send this post right now instead of at its scheduled time?')) return;
    setError(''); setBusy('Sending…');
    try { const out = await studio('update', { postId: editId, workspace: lockWs || undefined, ...fields(), publishNow: true }); setDone({ ...out.post, now: true, where }); }
    catch (err) { setError(err.message); }
    setBusy('');
  };
  const removePost = async () => {
    if (!window.confirm('Delete this post? It won’t go out, and this cannot be undone.')) return;
    setBusy('Deleting…');
    try { await studio('remove', { postId: editId, workspace: lockWs || undefined }); navigate('/studio/calendar'); }
    catch (err) { setError(err.message); setBusy(''); }
  };
  const duplicate = () => {
    setEditing(null); setWhen('');
    navigate('/studio/compose', { state: { copy: { accountIds: target().accountIds, platforms: plats, content, split, fbContent, ttSplit, ttContent, firstComment, media, audio, coverUrl: cover, videoVolume } } });
  };

  // Hook, captions, hashtags and a first comment from the writing helper.
  const draft = async () => {
    setError(''); setBusy('Drafting…');
    const brand = chosen.length && chosen.every((a) => a.site === 'collective') ? 'The P31 Collective' : 'Proverbs 31 Marketplace';
    try {
      const p = await postPack({ platforms: plats.map((x) => PLATFORM[x]?.label || x).join(' and '), kind: isReel ? 'reel' : media.length > 1 ? 'carousel' : 'photo', topic: topic || content || `a post for ${brand}` });
      setPack(p);
      if (!content) setContent(`${p.captions[0] || ''}\n\n${p.hashtags.join(' ')}`.trim());
      if (!firstComment) setFirstComment(p.firstComment);
    } catch (err) { setError(err.message); }
    setBusy('');
  };

  const toggle = (a) => setPicked((ps) => {
    const now = ps || chosen.map((x) => x.id);
    return now.includes(a.id) ? now.filter((x) => x !== a.id) : [...now, a.id];
  });
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
    if (!(accounts.length ? chosen.length : (picked?.length || fallback.length))) return setError('Pick at least one account to post to.');
    if (hasTT && !isReel) return setError('TikTok needs one video. Add a single video, or switch TikTok off.');
    if ((hasIG || hasFB) && media.some(isWebm)) return setError('Instagram and Facebook don’t take WebM video. Use an MP4, or post the WebM to TikTok only.');
    if (!when) return setError('Choose when it should go out.');
    setBusy(editId ? 'Saving…' : 'Scheduling…');
    try {
      const out = editId ? await studio('update', { postId: editId, workspace: lockWs || undefined, ...fields() }) : await studio('create', fields());
      // When one Zernio account's post did not go through, the headline names only the accounts that got one.
      const sent = out.warning && out.posts ? new Set(out.posts.flatMap((p) => (p.platforms || []).map((x) => x.accountId))) : null;
      const reached = sent ? chosen.filter((a) => sent.has(a.id)) : [];
      setDone({ ...out.post, where: reached.length ? whereOf(reached) : where, warning: out.warning || '' });
    } catch (err) { setError(err.message); }
    setBusy('');
  };

  if (done) {
    return (
      <DashEmpty Icon={Check} title={done.now ? 'Sent' : editId ? 'Saved' : 'Scheduled'} action={<div className="k-actions" style={{ justifyContent: 'center' }}>
        <Link to="/studio/calendar" className="k-btn k-btn--gold">View calendar</Link>
        <button type="button" className="k-btn k-btn--ghost" onClick={() => { window.location.href = '/studio/compose'; }}>Write another</button>
      </div>}>
        {done.now ? `Going out now on ${done.where}.` : `Goes out ${fmtET(done.scheduledFor)} (Eastern) on ${done.where}.`}
        {done.warning && <><br /><AlertTriangle size={14} style={{ verticalAlign: '-2px' }} /> {done.warning}</>}
      </DashEmpty>
    );
  }

  return (
    <>
      <DashHead eyebrow="Content Studio" title={editId ? 'Edit' : copy ? 'Copy of a' : 'Create a'} accent="post"
        lead={editId ? 'Change anything: the photos or video, the captions, the first comment, where it goes and when. Save, send it now, copy it, or delete it.' : copy ? 'A copy of a post, ready to change. Pick a new time and schedule it.' : 'Write once, publish to Instagram, Facebook and TikTok, for either brand, at the time you choose.'}
        actions={editId && editing && !goneOut ? (
          <div className="k-actions">
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={duplicate} disabled={!!busy}><Copy size={15} /> Duplicate</button>
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={removePost} disabled={!!busy}><Trash2 size={15} /> Delete</button>
          </div>
        ) : null} />
      {goneOut && <div className="ds-banner" role="status"><AlertTriangle size={18} /> This post has already gone out, so it can’t be changed here. Facebook captions can be changed, or the Facebook post removed, from Calendar → Studio history.</div>}
      <form className="ds-grid ds-grid--2" onSubmit={submit} style={{ alignItems: 'start' }}>
        <div className="ds-card ds-form">
          <div className="k-field"><span>Post to</span>
            {accounts.length ? (
              <div className="k-segs">
                {accounts.map((a) => {
                  const P = PLATFORM[a.platform];
                  const other = !!lockWs && a.workspace !== lockWs;
                  return (
                    <button type="button" key={a.id} aria-pressed={chosen.some((x) => x.id === a.id)} onClick={() => toggle(a)} disabled={other}
                      title={other ? 'This post lives in the other Zernio account. Duplicate it to post here too.' : `${P?.label || a.platform} · answers for the ${BRAND[a.site]?.label || a.site}`}>
                      {P && <P.Icon size={15} style={{ verticalAlign: '-3px' }} />} {accountLabel(a)} <small style={{ opacity: 0.7 }}>{BRAND[a.site]?.label}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <small className="ds-muted">{accountsQ.loading ? 'Loading your accounts…' : `Posting to the Marketplace’s ${plats.map((p) => PLATFORM[p]?.label || p).join(' and ')}${accountsQ.error ? ` (the account list didn’t load: ${accountsQ.error})` : ''}.`}</small>
            )}
            <Notes notes={accountsQ.data?.notes} />
            {gone.length > 0 && <small className="ds-muted"><AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> {gone.length === 1 ? 'One account this post went to is' : `${gone.length} accounts this post went to are`} no longer connected in Zernio, so saving leaves {gone.length === 1 ? 'it' : 'them'} out.</small>}
            {hasTT && <small className="ds-muted"><TikTok size={13} style={{ verticalAlign: '-2px' }} /> TikTok needs one video (MP4, MOV or WebM). It goes out public, with comments, duets and stitches on, unless the TikTok account limits them.</small>}
            {lockWs && accounts.some((a) => a.workspace !== lockWs) && <small className="ds-muted">A saved post can only use accounts in the same Zernio account. To post somewhere greyed out, duplicate it.</small>}
          </div>
          <div className="k-field st-ai"><span>Write it with help</span>
            <div className="st-ai__row">
              <input className="k-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What’s the post about? e.g. new candle curator, Winter Gala countdown" />
              <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={draft} disabled={!!busy}><Sparkles size={14} /> Draft</button>
            </div>
            {pack && (
              <div className="st-ai__picks">
                {pack.hooks.length > 0 && <small>Hook ideas for the video: {pack.hooks.join(' · ')}</small>}
                <div className="k-segs">{pack.captions.map((c, i) => <button type="button" key={i} onClick={() => setContent(`${c}\n\n${pack.hashtags.join(' ')}`)}>Caption {i + 1}</button>)}</div>
                {pack.bestTime && <small>{pack.bestTime}</small>}
              </div>
            )}
          </div>
          <label className="k-field"><span>Caption <em className="ds-muted" style={{ fontStyle: 'normal' }}>{content.length}/2200</em></span>
            <textarea rows={9} maxLength={2200} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your caption — Instagram links aren’t clickable, so say “link in bio”." />
          </label>
          {hasFB && hasIG && (
            <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={split} onChange={(e) => { setSplit(e.target.checked); if (e.target.checked && !fbContent) setFbContent(content); }} /><div><strong>Different caption for Facebook</strong><small>Use real links and names instead of @handles</small></div></label>
          )}
          {split && hasFB && <label className="k-field"><span>Facebook caption</span><textarea rows={6} value={fbContent} onChange={(e) => setFbContent(e.target.value)} /></label>}
          {hasTT && (hasIG || hasFB) && (
            <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={ttSplit} onChange={(e) => { setTtSplit(e.target.checked); if (e.target.checked && !ttContent) setTtContent(content); }} /><div><strong>Different caption for TikTok</strong><small>Otherwise TikTok gets the main caption above</small></div></label>
          )}
          {ttSplit && hasTT && <label className="k-field"><span>TikTok caption <em className="ds-muted" style={{ fontStyle: 'normal' }}>{ttContent.length}/2200</em></span><textarea rows={6} maxLength={2200} value={ttContent} onChange={(e) => setTtContent(e.target.value)} /></label>}
          {!isReel && hasIG && <label className="k-field"><span>First comment <em className="ds-muted" style={{ fontStyle: 'normal' }}>posted right after (Instagram photos & carousels)</em></span><input value={firstComment} onChange={(e) => setFirstComment(e.target.value)} placeholder="A link, a detail, or a question" /></label>}
        </div>

        <div className="ds-grid">
          <div className="ds-card ds-form">
            <div className="k-field"><span>Photos or video {hasIG && hasTT ? '(required for Instagram and TikTok)' : hasTT ? '(one video for TikTok)' : hasIG ? '(required for Instagram)' : ''}</span>
              <label className="st-drop">
                <Upload size={20} /> <strong>Add media</strong> <small>JPG, PNG, MP4, MOV, WebM · up to 10</small>
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
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
            {isReel && hasIG && (
              <div className="k-field"><span>Instagram audio {audio ? `· ${audio.title}` : ''}</span>
                {showSound ? <SoundPicker compact value={audio} onChange={setAudio} /> : <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowSound(true)}>{audio ? 'Change track' : 'Pick a trending track'}</button>}
              </div>
            )}
            {isReel && hasIG && audio && (
              <div className="k-field"><span>The reel’s own sound on Instagram</span>
                <div className="k-segs">{[[0, 'Off'], [25, 'Quiet'], [100, 'Full']].map(([v, l]) => <button type="button" key={v} aria-pressed={videoVolume === v} onClick={() => setVideoVolume(v)}>{l}</button>)}</div>
              </div>
            )}
            {isReel && cover && (
              <div className="k-field"><span>Cover (what the grid shows)</span>
                <span className="st-cover"><img src={cover} alt="Reel cover" /><button type="button" className="k-link" onClick={() => setCover(null)}>Use the first frame instead</button></span>
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
            <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={!!busy || goneOut}><CalendarClock size={18} /> {editId ? 'Save changes' : 'Schedule post'}</button>
            {editId && editing && !goneOut && <button type="button" className="k-btn k-btn--ghost k-btn--block" onClick={postNow} disabled={!!busy}><Send size={16} /> Post it now</button>}
          </div>
        </div>
      </form>
    </>
  );
};

// ── Inbox (read-only) ────────────────────────────────────────
/** Both brands, or one (Today's DM cards open ?brand=market or ?brand=collective). Rows without a
 * brand come from an older studio-zernio that read only the Market's Zernio key. */
const ofBrand = (brand) => (x) => !brand || (x.site || 'market') === brand;
const BrandTabs = ({ value, onChange }) => (
  <div className="ds-tabs-inline" role="tablist" aria-label="Brand">
    {[['', 'Both brands'], ['market', 'Marketplace'], ['collective', 'Collective']].map(([v, l]) => <button key={l} role="tab" aria-selected={value === v} onClick={() => onChange(v)}>{l}</button>)}
  </div>
);
/** Which account it came in on, and the brand that account answers for. */
const AccountTag = ({ item }) => (
  <>
    <BrandBadge site={item.site} />
    {item.accountUsername && item.platform !== 'facebook' && <small className="ds-muted"> to {at(item.accountUsername)}</small>}
  </>
);
const useBrand = () => {
  const location = useLocation();
  const initial = new URLSearchParams(location.search).get('brand');
  return useState(BRAND[initial] ? initial : '');
};

export const StudioInbox = () => {
  const [platform, setPlatform] = useState('');
  const [brand, setBrand] = useBrand();
  const list = useStudio('inbox', platform ? { platform } : {});
  const [open, setOpen] = useState(null);
  const thread = useStudio('thread', open ? { conversationId: open.id, accountId: open.accountId } : {}, !!open);
  const rows = (list.data?.conversations || []).filter(ofBrand(brand));
  const same = (a, b) => a && b && a.id === b.id && a.accountId === b.accountId;
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Messages" lead="Instagram, Facebook and TikTok DMs for both brands, including Carla’s replies. Read-only here — reply from the app or Zernio." />
      <Handoffs />
      <BrandTabs value={brand} onChange={(v) => { setBrand(v); setOpen(null); }} />
      <div className="ds-tabs-inline" role="tablist" aria-label="Platform">
        {[['', 'All'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['tiktok', 'TikTok']].map(([v, l]) => {
          const P = PLATFORM[v];
          return <button key={l} role="tab" aria-selected={platform === v} onClick={() => { setPlatform(v); setOpen(null); }}>{P && <P.Icon size={14} style={{ verticalAlign: '-2px' }} />} {l}</button>;
        })}
      </div>
      {list.error && <Problem error={list.error} onRetry={list.reload} />}
      <Notes notes={list.data?.notes} />
      <div className="ds-grid ds-grid--2" style={{ alignItems: 'start' }}>
        <ul className="ds-list">
          {rows.map((c) => {
            const P = PLATFORM[c.platform];
            return (
              <li key={`${c.accountId}:${c.id}`}><button className={`ds-row ${same(open, c) ? 'is-open' : ''}`} onClick={() => setOpen(c)}>
                {c.picture ? <img src={c.picture} alt="" className="st-avatar" /> : <Inbox size={20} />}
                <div><strong>{c.name}{c.username ? ` · @${c.username}` : ''}</strong><small>{c.last || '—'}</small><small><AccountTag item={c} /></small></div>
                {c.unread > 0 && <span className="ds-badge">{c.unread}</span>}
                {P && <P.Icon size={15} aria-label={P.label} />}
              </button></li>
            );
          })}
          {list.data && !rows.length && <li className="ds-muted">No conversations{brand ? ` for the ${BRAND[brand].label}` : ''}.</li>}
        </ul>
        <div className="ds-card">
          {open ? (
            <>
              <h3>{open.name}</h3>
              <p className="ds-muted" style={{ marginTop: 0 }}>{PLATFORM[open.platform]?.label || open.platform} <AccountTag item={open} /></p>
              {thread.loading ? <p className="ds-muted">Loading…</p> : thread.error ? <p className="k-error">{thread.error}</p> : (
                <div className="ds-thread">
                  {(thread.data?.messages || []).map((m) => (
                    <div key={m.id} className={`ds-msg ${m.direction === 'outgoing' ? 'is-mine' : ''}`}>
                      {m.text || (m.attachments.length ? `[${m.attachments.join(', ')}]` : '—')}
                      <small>{m.direction === 'outgoing' ? (open.accountUsername ? at(open.accountUsername) : 'P31') : open.name} · {fmtET(m.at)}</small>
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
  const [brand, setBrand] = useBrand();
  const [open, setOpen] = useState(null);
  const comments = useStudio('postComments', open ? { postId: open.id, accountId: open.accountId } : {}, !!open);
  const rows = (posts.data?.posts || []).filter(ofBrand(brand));
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Comments" lead="Recent posts with comments on Instagram, Facebook and TikTok, for both brands. Read-only here — reply from the app or Zernio." />
      <BrandTabs value={brand} onChange={(v) => { setBrand(v); setOpen(null); }} />
      {posts.error && <Problem error={posts.error} onRetry={posts.reload} />}
      <Notes notes={posts.data?.notes} />
      <div className="ds-grid ds-grid--2" style={{ alignItems: 'start' }}>
        <ul className="ds-list">
          {rows.map((p) => {
            const P = PLATFORM[p.platform];
            return (
              <li key={`${p.accountId}:${p.id}`}><button className={`ds-row ${open && open.id === p.id && open.accountId === p.accountId ? 'is-open' : ''}`} onClick={() => setOpen(p)}>
                {p.picture ? <img src={p.picture} alt="" className="st-thumb" /> : <ImagePlus size={20} />}
                <div><strong>{(p.text || '').split('\n')[0].slice(0, 70) || 'Post'}</strong><small>{P?.label || p.platform} · {p.comments ?? 0} comments · {p.at ? new Date(p.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</small><small><AccountTag item={p} /></small></div>
                {P && <P.Icon size={15} aria-label={P.label} />}
              </button></li>
            );
          })}
          {posts.data && !rows.length && <li className="ds-muted">No commented posts{brand ? ` for the ${BRAND[brand].label}` : ''}.</li>}
        </ul>
        <div className="ds-card">
          {open ? (
            <>
              <div className="ds-card__head"><h3>Comments</h3>{open.permalink && <a className="k-link" href={open.permalink} target="_blank" rel="noopener noreferrer">Open post <ExternalLink size={13} /></a>}</div>
              <p className="ds-muted" style={{ marginTop: 0 }}>{PLATFORM[open.platform]?.label || open.platform} <AccountTag item={open} /></p>
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
  const phone = useIsPhone();
  const [tool, setTool] = useState(() => (isPhone() ? 'photo' : 'clip'));
  const useIt = async (blob, meta) => {
    const file = new File([blob], meta.name || `p31-${Date.now()}`, { type: blob.type || meta.type });
    const url = await uploadMedia(file);
    navigate('/studio/compose', { state: { media: [{ type: file.type.startsWith('video/') ? 'video' : 'image', url, name: file.name, altText: '' }] } });
  };
  return (
    <>
      <DashHead eyebrow="Content Studio" title="Creative" accent="tools" lead="Auto-edit a reel from raw footage, or style a product photo — then send it straight to the composer." />
      <div className="ds-tabs-inline" role="tablist">
        <button role="tab" aria-selected={tool === 'clip'} onClick={() => setTool('clip')}><Video size={15} style={{ verticalAlign: '-3px' }} /> Clip Studio {phone && <DesktopTag />}</button>
        <button role="tab" aria-selected={tool === 'photo'} onClick={() => setTool('photo')}><ImagePlus size={15} style={{ verticalAlign: '-3px' }} /> Photo Studio</button>
      </div>
      <Suspense fallback={<p className="ds-muted">Loading…</p>}>
        {tool === 'clip' ? (
          <DesktopOnly
            title="Clip Studio"
            what="Turns raw footage into a captioned reel with a look, music and the P31 mark, then sends it to Create post."
            instead={[{ to: '/studio/create', label: 'Style a product photo in Photo Studio' }, { to: '/studio/compose', label: 'Write and schedule a post' }]}
          >
            <ClipStudio onSave={useIt} saveLabel="Use in a post" />
          </DesktopOnly>
        ) : <PhotoStudio onSave={useIt} saveLabel="Use in a post" />}
      </Suspense>
    </>
  );
};
