import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, Clock, Download, Loader2, Music2, RefreshCw, Send } from 'lucide-react';
import { DashHead } from '../apps/DashShell';
import { studio, uploadMedia, fmtET } from './api';
import { trendingMusic, spreadPicks, trackName, tiktokMusicField, MUSIC_DEFAULTS } from './music';
import MusicChoice from './MusicPicker';

/**
 * Content Studio → Post plans (/studio/plans): sets of finished posts made ahead of time (video, cover,
 * caption, time), put on the site by a marketing script, e.g. marketing/social/2026-10-tiktok/publish.mjs
 * → public/social/tiktok-2026-10/plan.json. The team watches each one, can change a caption, and
 * schedules them on the plan's account through studio-zernio (which holds the Zernio keys). A post is
 * found in Zernio by its title, so nothing is scheduled twice.
 * Music (TikTok plans): TikTok's trending tracks are read once, and every post gets one picked ahead of
 * time (./musicPick.js: not explicit, long enough, P31 moods first, spread so no two posts in a row
 * share one). Change picks another, "Use our original music" keeps the video's own; each choice is
 * kept in this browser (localStorage, per plan and post) until it is scheduled. With no trending
 * music (developer-app connection, an error), posts go out with their own music as before.
 */
const PLANS = ['tiktok-2026-10'];
const PLATFORM = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' };
const BRAND = { market: 'Marketplace', collective: 'Collective' };
// Zernio publishes at once a time that has passed, so a post this close to its time counts as too late.
const SOON = 10 * 60_000;
const ZSTATUS = {
  scheduled: ['Scheduled', 'ds-pill--green'], publishing: ['Publishing', 'ds-pill--green'], published: ['Published', 'ds-pill--green'],
  failed: ['Failed in Zernio', 'ds-pill--red'], partial: ['Partly failed', 'ds-pill--red'], draft: ['Draft in Zernio', ''],
};
const at = (u) => `@${String(u || '').replace(/^@/, '')}`;
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// The team's music choice per post, kept in this browser: {mode: 'track', track, volume, originalVolume} or {mode: 'original'}.
const musicKey = (folder, id) => `p31.planMusic.${folder}.${id}`;
function readMusic(folder, posts) {
  const out = {};
  for (const p of posts) {
    try {
      const v = JSON.parse(window.localStorage.getItem(musicKey(folder, p.id)) || 'null');
      if (v?.mode === 'original') out[p.id] = null;
      else if (v?.mode === 'track' && v.track?.id) out[p.id] = { track: v.track, volume: v.volume ?? MUSIC_DEFAULTS.volume, originalVolume: v.originalVolume ?? MUSIC_DEFAULTS.originalVolume };
    } catch { /* storage off or unreadable: the auto-pick stands */ }
  }
  return out;
}
function saveMusic(folder, id, v) {
  try {
    if (v === undefined) window.localStorage.removeItem(musicKey(folder, id));
    else window.localStorage.setItem(musicKey(folder, id), JSON.stringify(v === null ? { mode: 'original' } : { mode: 'track', track: v.track, volume: v.volume, originalVolume: v.originalVolume }));
  } catch { /* storage off: the choice lasts until the page is closed */ }
}

/** A local time in a time zone ("2026-10-23T12:30:00", America/New_York) as a real instant, daylight saving included. */
function instantOf(local, tz) {
  const [d, t = '00:00'] = String(local).split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm, ss = 0] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm, ss);
  const offsetAt = (ms) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ms;
  };
  return new Date(guess - offsetAt(guess - offsetAt(guess)));
}

/** The Zernio post for a plan post, in either workspace: the same title (or an older script's "… · <id>" title). */
const inZernio = (list, post) => [...(list?.scheduled || []), ...(list?.recent || [])]
  .find((z) => z.title === post.title || String(z.title || '').endsWith(` · ${post.id}`));

const Problem = ({ children, onRetry }) => (
  <div className="ds-banner" role="alert"><AlertTriangle size={18} /> <span>{children}</span> {onRetry && <button type="button" className="k-btn k-btn--sm k-btn--ghost" onClick={onRetry}><RefreshCw size={14} /> Retry</button>}</div>
);

const StudioPlans = () => {
  const [folder, setFolder] = useState(PLANS[0]);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState('');
  const [accounts, setAccounts] = useState(null);
  const [accountsError, setAccountsError] = useState('');
  const [posts, setPosts] = useState(null);
  const [postsError, setPostsError] = useState('');
  const [version, setVersion] = useState(0);
  const [picked, setPicked] = useState('');
  const [captions, setCaptions] = useState({});
  const [brandLabel, setBrandLabel] = useState(true);
  const [progress, setProgress] = useState({}); // post id → { step } while working, then { done, note } or { error }
  const [confirm, setConfirm] = useState(null); // { ids, all } waiting for a yes (all: from the Schedule all button)
  const [batch, setBatch] = useState(null); // { done, total } while scheduling
  const running = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  const [music, setMusic] = useState(null); // trending {tracks, note} for the plan's account (null while loading)
  const [musicChoice, setMusicChoice] = useState({}); // post id → {track, volume, originalVolume}, or null for our own music

  // The plan's posts, from the files publish.mjs put on the site.
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => { if (live) { setPlan(null); setPlanError(''); setCaptions({}); setProgress({}); setConfirm(null); setMusicChoice({}); } });
    fetch(`/social/${folder}/plan.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((p) => {
        if (!Array.isArray(p?.posts)) throw new Error('no posts');
        if (live) { setPlan(p); setMusicChoice(readMusic(folder, p.posts)); }
      })
      .catch(() => live && setPlanError(`The plan “${folder}” isn’t on the site yet. Run its publish.mjs, deploy, then reload this page.`));
    return () => { live = false; };
  }, [folder]);

  // The connected accounts, and what Zernio already has (scheduled and recent posts, both workspaces).
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => { if (live) { setAccountsError(''); setPostsError(''); } });
    studio('accounts').then((a) => live && setAccounts(a), (err) => live && setAccountsError(err.message));
    studio('posts').then((p) => live && setPosts(p), (err) => live && setPostsError(err.message));
    return () => { live = false; };
  }, [version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // "Too late" keeps up with the clock; leaving mid-run asks first.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!batch) return undefined;
    const stay = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', stay);
    return () => window.removeEventListener('beforeunload', stay);
  }, [batch]);

  const tz = plan?.timezone || 'America/New_York';
  const candidates = useMemo(() => (accounts?.accounts || []).filter((a) => a.platform === plan?.platform && a.site === plan?.site), [accounts, plan]);
  const account = candidates.find((a) => a.id === picked) || (candidates.length === 1 ? candidates[0] : null);

  // Trending TikTok music for the plan's account, read once (kept for the page session).
  const tiktokPlan = plan?.platform === 'tiktok';
  const accountId = account?.id || '';
  useEffect(() => {
    if (!tiktokPlan || !accountId) return undefined;
    let live = true;
    Promise.resolve().then(() => live && setMusic(null));
    trendingMusic('tiktok', { accountId }).then((m) => live && setMusic(m));
    return () => { live = false; };
  }, [tiktokPlan, accountId]);
  const searchMusic = useCallback((q) => trendingMusic('tiktok', { accountId, q }), [accountId]);
  // No account to read music for: say so instead of "looking…".
  const accountsKnown = !!(accounts || accountsError);
  const musicList = useMemo(() => (!tiktokPlan ? null : accountId ? music
    : accountsKnown ? { tracks: [], note: 'Trending TikTok music shows once the TikTok account is connected. Posts go out with our own music.' } : null), [tiktokPlan, accountId, music, accountsKnown]);
  // A track for every post, picked ahead of time and spread out; the team's own choices stay as they are.
  const autos = useMemo(() => {
    if (!musicList?.tracks?.length || !plan) return {};
    const fixed = Object.fromEntries(Object.entries(musicChoice).map(([id, v]) => [id, v?.track?.id || null]));
    return spreadPicks(musicList.tracks, plan.posts.map((p) => ({ id: p.id, seconds: p.seconds })), { fixed });
  }, [musicList, plan, musicChoice]);
  const chosenMusic = (id) => (Object.prototype.hasOwnProperty.call(musicChoice, id) ? musicChoice[id]
    : autos[id] ? { track: autos[id], ...MUSIC_DEFAULTS, auto: true } : null);
  const setChosenMusic = (id, v) => {
    const clean = v === undefined || v === null ? v : { track: v.track, volume: v.volume ?? MUSIC_DEFAULTS.volume, originalVolume: v.originalVolume ?? MUSIC_DEFAULTS.originalVolume };
    setMusicChoice((s) => { const n = { ...s }; if (clean === undefined) delete n[id]; else n[id] = clean; return n; });
    saveMusic(folder, id, clean);
  };
  // A workspace Zernio couldn't read: its posts are missing from the list, so "already there" can't be trusted.
  const blind = !!account && (posts?.notes || []).some((n) => n.workspace === account.workspace);
  const rows = useMemo(() => (plan?.posts || []).map((p) => {
    const when = instantOf(p.when, tz).getTime();
    const z = inZernio(posts, p);
    const prog = progress[p.id] || null;
    const state = z || prog?.done ? 'there' : when - now < SOON ? 'late' : posts ? 'ready' : 'checking';
    return { ...p, at: when, z, prog, state };
  }), [plan, posts, progress, now, tz]);
  const ready = rows.filter((r) => r.state === 'ready');
  const count = (s) => rows.filter((r) => r.state === s).length;
  const promos = rows.filter((r) => r.promo).length;
  const canSchedule = !!account && !!posts && !blind && !batch;
  const where = account ? `${at(account.username)} (${PLATFORM[account.platform] || account.platform}, ${BRAND[account.site] || account.site})` : '';

  const mark = (id, v) => setProgress((s) => ({ ...s, [id]: v }));
  /** Schedule these posts one at a time; an error on one is shown on it and the rest carry on. */
  const schedule = async (ids) => {
    if (running.current || !account || !plan) return;
    running.current = true;
    setConfirm(null);
    setBatch({ done: 0, total: ids.length });
    // One fresh look at what Zernio has, so a post scheduled meanwhile (another tab, a teammate) is skipped.
    let fresh = null;
    const made = [];
    try {
      fresh = await studio('posts');
      setPosts(fresh);
      if ((fresh.notes || []).some((n) => n.workspace === account.workspace)) throw new Error('Zernio’s list of posts for this account couldn’t be read just now');
    } catch (err) {
      fresh = null;
      ids.forEach((id) => mark(id, { error: `Nothing was scheduled: ${err.message}. Try again in a minute.` }));
    }
    for (const [i, id] of (fresh ? ids : []).entries()) {
      const p = plan.posts.find((x) => x.id === id);
      const caption = (captions[id] ?? p?.caption ?? '').trim();
      try {
        if (!p) throw new Error('This post is no longer in the plan.');
        if (inZernio(fresh, p)) { mark(id, { done: true, note: 'It was already in Zernio, so it was left as it is.' }); continue; }
        if (instantOf(p.when, tz).getTime() - Date.now() < SOON) throw new Error('Its time has passed, so it was not scheduled.');
        if (!caption) throw new Error('Write a caption first.');
        mark(id, { step: 'Getting the video…' });
        const res = await fetch(`/social/${folder}/${p.video}`);
        if (!res.ok) throw new Error(`The video file didn’t load (${res.status}).`);
        const file = new File([await res.blob()], p.video, { type: 'video/mp4' });
        mark(id, { step: `Uploading the video (${mb(file.size)})…` });
        const url = await uploadMedia(file, p.video);
        mark(id, { step: 'Scheduling…' });
        const tiktokMusic = plan.platform === 'tiktok' ? tiktokMusicField(chosenMusic(id)) : undefined;
        const out = await studio('create', {
          accountIds: [account.id], content: caption, media: [{ type: 'video', url }],
          scheduledFor: p.when.slice(0, 16), timezone: tz, title: p.title,
          coverMs: p.coverMs, tiktokBrand: brandLabel && !!p.promo, idempotencyKey: p.title,
          ...(tiktokMusic ? { tiktokMusic } : {}),
        });
        mark(id, { done: true, note: [out.note, out.warning].filter(Boolean).join(' ') });
        saveMusic(folder, id, undefined); // scheduled: the choice now lives in Zernio
        made.push(p);
      } catch (err) {
        mark(id, { error: err.message });
      } finally {
        setBatch((b) => (b ? { ...b, done: i + 1 } : b));
      }
    }
    try {
      const after = await studio('posts');
      setPosts(after);
      // Zernio said yes but doesn't list it: most likely the same post was deleted earlier today and
      // Zernio answered with that one (a repeat within 24 hours gets the first answer back).
      made.filter((p) => !inZernio(after, p)).forEach((p) => mark(p.id, {
        error: 'Zernio said yes, but it isn’t in Zernio’s list. Press Refresh in a minute. If it still shows Ready, check the Studio calendar and Zernio before trying again, so it does not go out twice.',
      }));
    } catch { /* each post already shows what happened */ }
    setBatch(null);
    running.current = false;
  };

  /** The yes-or-no before anything is scheduled: which account, how many, and that they go out on their own. */
  const confirmBox = (ids) => (
    <div className="em-confirm pp-confirm" role="alertdialog" aria-label="Confirm scheduling">
      <span>{ids.length === 1
        ? <>Schedule this post on <strong>{where}</strong>? It publishes by itself at the time shown (Eastern), with nobody pressing anything. Until then it can be changed or deleted on the Calendar.</>
        : <>Schedule {plural(ids.length, 'post')} on <strong>{where}</strong>? Each one publishes by itself at its own time (Eastern), with nobody pressing anything. Until then each can be changed or deleted on the Calendar.</>}</span>
      <button type="button" className="k-btn k-btn--gold k-btn--sm" onClick={() => schedule(ids)}><Send size={14} /> Yes, schedule {ids.length === 1 ? 'it' : ids.length}</button>
      <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setConfirm(null)}>Cancel</button>
    </div>
  );

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Post" accent="plans"
        lead="Finished posts made ahead of time. Watch each one, change a caption if you like, and schedule it: it goes out by itself at its time."
        actions={<button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={reload} disabled={!!batch}><RefreshCw size={15} /> Refresh</button>} />
      {PLANS.length > 1 && (
        <div className="ds-tabs-inline" role="tablist" aria-label="Plan">
          {PLANS.map((f) => <button key={f} role="tab" aria-selected={folder === f} onClick={() => setFolder(f)} disabled={!!batch}>{f}</button>)}
        </div>
      )}
      {planError && <Problem>{planError}</Problem>}
      {!plan && !planError && <p className="ds-muted" role="status"><Loader2 size={14} className="pp-spin" /> Loading the plan…</p>}

      {plan && (
        <section className="ds-card pp-bar" aria-label="Plan and account">
          <div className="pp-bar__title">
            <h2>{plan.name}</h2>
            <small className="ds-muted">{plural(rows.length, 'post')} · {PLATFORM[plan.platform] || plan.platform} · {BRAND[plan.site] || plan.site} · times are Eastern</small>
          </div>

          {accountsError && <Problem onRetry={reload}>The account list didn’t load: {accountsError}</Problem>}
          {accounts && !candidates.length && (
            <p className="pp-alert" role="status"><AlertTriangle size={15} /> <span>No {BRAND[plan.site]} {PLATFORM[plan.platform]} account is connected in Zernio, so nothing can be scheduled yet. Connect it in Zernio, then press Refresh. Admins can see every connected profile in <Link className="k-link" to="/systems/social-accounts">Systems › Social accounts</Link>.</span></p>
          )}
          {candidates.length > 1 && (
            <div className="k-field"><span>Which {PLATFORM[plan.platform]} account?</span>
              <div className="k-segs">{candidates.map((a) => <button type="button" key={a.id} aria-pressed={account?.id === a.id} onClick={() => setPicked(a.id)} disabled={!!batch}>{at(a.username)} <small style={{ opacity: 0.7 }}>{a.workspace === 'collective' ? 'Collective Zernio' : 'Market Zernio'}</small></button>)}</div>
            </div>
          )}
          {account && (
            <p className="pp-acct"><Check size={15} /> <span>Goes to <strong>{where}</strong>.{account.needsReconnection ? ' Zernio says it needs reconnecting: posts won’t go out until it is.' : ''}</span></p>
          )}
          {(accounts?.notes || []).map((n) => <small key={n.workspace} className="ds-muted"><AlertTriangle size={13} /> {n.error}</small>)}
          {postsError && <Problem onRetry={reload}>What’s already in Zernio couldn’t be checked, so scheduling waits: {postsError}</Problem>}
          {blind && <p className="pp-alert" role="status"><AlertTriangle size={15} /> <span>Zernio’s posts for this account couldn’t be read just now, so scheduling waits (nothing can be checked for doubles). Press Refresh in a minute.</span></p>}

          {tiktokPlan && (
            <p className={musicList?.tracks?.length ? 'pp-acct' : 'ds-muted'} role="status" style={{ margin: 0 }}>
              <Music2 size={15} /> <span>{!musicList ? 'Looking up TikTok’s trending music…'
                : musicList.tracks.length ? `Trending TikTok music: ${plural(musicList.tracks.length, 'track')} found, and each post below has one picked ahead of time (nothing explicit, long enough for the video, spread out). Change any, or use our original music.`
                  : musicList.note || 'No trending TikTok music right now, so posts go out with our own music.'}</span>
            </p>
          )}

          {plan.platform === 'tiktok' && promos > 0 && (
            <label className="fc-check pp-label"><input type="checkbox" checked={brandLabel} onChange={(e) => setBrandLabel(e.target.checked)} disabled={!!batch} />
              <span>Label offer posts as “Your brand” (TikTok promotion label)<small>TikTok asks posts that promote your own business to say so. It applies to the {plural(promos, 'post')} marked P31 offer, and is left off if TikTok doesn’t offer it to this account.</small></span>
            </label>
          )}

          <div className="pp-counts">
            <span className="ds-pill ds-pill--green">{count('there')} in Zernio</span>
            <span className="ds-pill ds-pill--gold">{ready.length} ready</span>
            {count('late') > 0 && <span className="ds-pill">{count('late')} too late</span>}
            {!posts && !postsError && <span className="ds-muted"><Loader2 size={13} className="pp-spin" /> Checking Zernio…</span>}
            <button type="button" className="k-btn k-btn--gold k-btn--sm pp-all" onClick={() => setConfirm({ ids: ready.map((r) => r.id), all: true })} disabled={!canSchedule || !ready.length || !!confirm}>
              <CalendarClock size={15} /> Schedule all ready posts{ready.length ? ` (${ready.length})` : ''}
            </button>
          </div>
          {confirm?.all && confirmBox(confirm.ids)}
          {batch && (
            <div className="fc-progress" role="status">
              <div className="fc-progress__bar"><i style={{ width: `${(batch.done / Math.max(1, batch.total)) * 100}%` }} /></div>
              <span><Loader2 size={14} className="pp-spin" /> Scheduling {batch.done < batch.total ? batch.done + 1 : batch.total} of {batch.total}… keep this page open until it finishes.</span>
            </div>
          )}
        </section>
      )}

      <div className="pp-list">
        {rows.map((p) => {
          const src = `/social/${folder}/${p.video}`;
          const caption = captions[p.id] ?? p.caption;
          const edited = captions[p.id] != null && captions[p.id] !== p.caption;
          const [zLabel, zClass] = p.z ? (ZSTATUS[p.z.status] || [p.z.status, '']) : p.prog?.done ? ['Scheduled', 'ds-pill--green'] : [];
          return (
            <article key={p.id} className="ds-card pp-post" aria-label={p.title}>
              <video className="pp-video" controls preload="none" playsInline poster={`/social/${folder}/${p.cover}`} src={src} />
              <div className="pp-body">
                <div className="pp-head">
                  <strong><Clock size={14} /> {fmtET(new Date(p.at).toISOString())} ET</strong>
                  {p.state === 'there' && <span className={`ds-pill ${zClass}`}>{zLabel}</span>}
                  {p.state === 'ready' && <span className="ds-pill ds-pill--gold">Ready</span>}
                  {p.state === 'late' && <span className="ds-pill">Too late</span>}
                  {p.promo && <span className="ds-pill">P31 offer{plan?.platform === 'tiktok' && brandLabel && p.state !== 'there' ? ' · Your brand label' : ''}</span>}
                </div>
                <small className="ds-muted">{p.theme ? `${p.theme} · ` : ''}{p.seconds ? `${p.seconds} s · ` : ''}{p.id}</small>
                {p.state === 'ready' || p.state === 'checking' ? (
                  <label className="k-field pp-cap"><span>Caption <em className="ds-muted" style={{ fontStyle: 'normal' }}>{caption.length}/2200{edited ? ' · changed' : ''}</em></span>
                    <textarea rows={7} maxLength={2200} value={caption} disabled={!!batch} onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))} />
                  </label>
                ) : <p className="pp-text">{p.z?.content || caption}</p>}
                {tiktokPlan && (p.state === 'ready' || p.state === 'checking') && (() => {
                  const m = chosenMusic(p.id);
                  const own = Object.prototype.hasOwnProperty.call(musicChoice, p.id);
                  const stale = own && m?.track && musicList?.tracks?.length && !musicList.tracks.some((t) => t.id === m.track.id);
                  return (
                    <MusicChoice platform="tiktok" value={m} auto={!!m?.auto} list={musicList} load={searchMusic} showNote={false}
                      onChange={(v) => setChosenMusic(p.id, v)} disabled={!!batch} volumes originalLabel="Our music under it"
                      extra={(own || stale) && !batch ? (
                        <small className="ds-muted">{stale ? 'This track is no longer in TikTok’s trending list; it may not attach. ' : ''}
                          {musicList?.tracks?.length ? <button type="button" className="k-link" onClick={() => setChosenMusic(p.id, undefined)}>Back to the auto-pick</button> : null}
                        </small>
                      ) : null} />
                  );
                })()}
                {tiktokPlan && p.z && (() => {
                  const tm = (p.z.platforms || []).find((x) => x.platform === 'tiktok')?.tiktokMusic;
                  if (!tm) return null;
                  const t = musicList?.tracks?.find((x) => x.id === tm.id);
                  return <small className="ds-muted"><Music2 size={13} style={{ verticalAlign: '-2px' }} /> Music: {t ? trackName(t) : 'a trending TikTok track'} ({tm.volume}%)</small>;
                })()}
                {p.prog?.step && <p className="ds-muted pp-step" role="status"><Loader2 size={14} className="pp-spin" /> {p.prog.step}</p>}
                {p.prog?.error && <p className="k-error" role="alert">{p.prog.error}</p>}
                {p.prog?.done && <p className="pp-ok" role="status"><Check size={14} /> {p.prog.note || `Scheduled for ${fmtET(new Date(p.at).toISOString())} ET. It goes out by itself.`}</p>}
                {p.z && ['failed', 'partial'].includes(p.z.status) && <small className="ds-muted">Open the Calendar to see what Zernio said and try it again.</small>}
                {p.state === 'late' && <small className="ds-muted">Its time has passed. To post it anyway, download the video and use Create post with a new time.</small>}
                {confirm && !confirm.all && confirm.ids[0] === p.id && confirmBox(confirm.ids)}
                <div className="pp-btns">
                  {p.state === 'ready' && (
                    <button type="button" className="k-btn k-btn--gold k-btn--sm" onClick={() => setConfirm({ ids: [p.id] })} disabled={!canSchedule || !!confirm}><Send size={14} /> Schedule</button>
                  )}
                  {edited && p.state === 'ready' && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setCaptions((c) => { const n = { ...c }; delete n[p.id]; return n; })} disabled={!!batch}>Undo caption changes</button>}
                  {p.state === 'there' && <Link to="/studio/calendar" className="k-btn k-btn--ghost k-btn--sm"><CalendarClock size={14} /> Calendar</Link>}
                  <a className="k-btn k-btn--ghost k-btn--sm" href={src} download={p.video}><Download size={14} /> Video</a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

export default StudioPlans;
