import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Hash, BookOpen, Heart, PartyPopper, Store, CalendarDays, GraduationCap, ShieldCheck, Sparkles, Users, Menu, X, Search,
  MessageCircle, Pin, LogIn, ArrowLeft, Plus, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isCollective } from '../lib/site';
import mark from '../assets/academy/collective-mark.webp';
import * as api from './api';
import { GROUPS, groupOf } from './badges';
import { Avatar, Badges, Message, DayDivider, Composer, Lightbox, PersonCard } from './parts';
import './gather.css';

const ICONS = { sparkles: Sparkles, book: BookOpen, hash: Hash, heart: Heart, party: PartyPopper, store: Store, calendar: CalendarDays, graduation: GraduationCap, shield: ShieldCheck };
const SECTIONS = [['gather', 'Gather'], ['market', 'Market'], ['academy', 'Academy'], ['team', 'Team']];
const sameDay = (a, b) => a && new Date(a.created_at).toDateString() === new Date(b.created_at).toDateString();
const WORD_SEEN = 'p31_word_seen';

/** /gather — The Gathering: P31's community space for vendors, students, mentors, the team and overseers. */
const Gather = () => {
  const { user, loading } = useAuth();
  const { slug } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);           // chat_me()
  const [channels, setChannels] = useState([]);
  const [people, setPeople] = useState(() => new Map());
  const [messages, setMessages] = useState([]);
  const [more, setMore] = useState(false);
  const [thread, setThread] = useState(null);   // { root, replies }
  const [replyTo, setReplyTo] = useState(null);
  const [threadReplyTo, setThreadReplyTo] = useState(null);
  const [urls, setUrls] = useState({});
  const [panel, setPanel] = useState(null);     // 'members' | 'pins' | null
  const [nav, setNav] = useState(false);        // phones: channel list open
  const [person, setPerson] = useState(null);
  const [light, setLight] = useState(null);
  const [word, setWord] = useState(null);       // today's Daily Word pop-up
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState('loading'); // loading | ready | outside | failed
  const listRef = useRef(null);
  const atBottom = useRef(true);

  const channel = useMemo(() => channels.find((c) => c.slug === slug) || null, [channels, slug]);
  // What the live feed needs to know (kept in a ref so the subscription is made once).
  const live = useRef({ channel: null, thread: null });
  useEffect(() => { live.current = { channel: channel?.id, thread: thread?.root?.id }; }, [channel?.id, thread?.root?.id]);

  // ── Loading ──
  const loadChannels = useCallback(async () => setChannels(await api.getChannels()), []);
  useEffect(() => {
    if (loading || !user) return undefined;
    let on = true;
    (async () => {
      try {
        const m = await api.getMe();
        if (!on) return;
        setMe(m);
        if (!m?.member) { setState('outside'); return; }
        const [list, folks] = await Promise.all([api.getChannels(), api.getPeople()]);
        if (!on) return;
        setChannels(list);
        setPeople(new Map(folks.map((p) => [p.id, p])));
        setState('ready');
      } catch (e) { if (on) { setError(e.message); setState('failed'); } }
    })();
    return () => { on = false; };
  }, [user, loading]);

  // No channel in the link: open the first one with something new, else The Gathering.
  useEffect(() => {
    if (state !== 'ready' || slug) return;
    const first = channels.find((c) => c.unread > 0 && c.kind !== 'dm') || channels.find((c) => c.slug === 'the-gathering') || channels[0];
    if (first) navigate(`/gather/${first.slug}`, { replace: true });
  }, [state, slug, channels, navigate]);

  // Someone we have not met yet (a new member, a DM partner): fetch their name and badges.
  const ensurePeople = useCallback(async (ids) => {
    const missing = [...new Set(ids.filter(Boolean))].filter((id) => !people.has(id));
    if (!missing.length) return;
    const found = await api.getPeople(missing);
    if (found.length) setPeople((p) => { const n = new Map(p); found.forEach((x) => n.set(x.id, x)); return n; });
  }, [people]);

  // Signed links for any photos and videos on screen.
  const signFor = useCallback(async (list) => {
    const paths = list.flatMap((m) => (m.attachments || []).map((a) => a.path));
    if (!paths.length) return;
    const got = await api.signPaths(paths);
    setUrls((u) => ({ ...u, ...got }));
  }, []);

  // Open a channel: its latest messages, mark read.
  useEffect(() => {
    if (!channel) return undefined;
    let on = true;
    Promise.resolve().then(() => { if (on) { setMessages([]); setThread(null); setReplyTo(null); setNav(false); } });
    api.getMessages(channel.id).then((list) => {
      if (!on) return;
      setMessages(list); setMore(list.length >= api.PAGE);
      atBottom.current = true;
      ensurePeople(list.flatMap((m) => [m.author_id])); signFor(list);
    }).catch((e) => on && setError(e.message));
    api.markRead(channel.id).then(() => setChannels((cs) => cs.map((c) => (c.id === channel.id ? { ...c, unread: 0 } : c))));
    return () => { on = false; };
  }, [channel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = async () => {
    if (!messages.length) return;
    const el = listRef.current; const before = el?.scrollHeight || 0;
    const older = await api.getMessages(channel.id, messages[0].created_at);
    setMore(older.length >= api.PAGE);
    setMessages((m) => [...older, ...m]);
    ensurePeople(older.map((m) => m.author_id)); signFor(older);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - before; });
  };

  // Stay at the newest message unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);
  const onScroll = () => { const el = listRef.current; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  // ── Live: new messages, edits, reactions, new replies, other channels lighting up ──
  const channelsRef = useRef(channels);
  useEffect(() => { channelsRef.current = channels; }, [channels]);
  const peopleRef = useRef(people);
  useEffect(() => { peopleRef.current = people; }, [people]);
  useEffect(() => {
    if (state !== 'ready') return undefined;
    const upsert = (list, row) => (list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row]);
    const sub = supabase.channel('gathering')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, ({ new: row, eventType }) => {
        if (!row?.id) return;
        const { channel: here, thread: open } = live.current;
        ensurePeople([row.author_id]); signFor([row]);
        if (row.thread_root) {
          if (row.thread_root === open) setThread((t) => (t ? { ...t, replies: upsert(t.replies, row) } : t));
          return;
        }
        if (row.channel_id === here) {
          setMessages((list) => upsert(list, row));
          setThread((t) => (t && t.root.id === row.id ? { ...t, root: row } : t));
          if (eventType === 'INSERT') api.markRead(here);
        } else if (eventType === 'INSERT' && row.author_id !== me?.id) {
          setChannels((cs) => cs.map((c) => (c.id === row.channel_id ? { ...c, unread: (c.unread || 0) + 1, last_message_at: row.created_at } : c)));
          if (!channelsRef.current.some((c) => c.id === row.channel_id)) loadChannels(); // a brand-new DM
        }
        // A direct message for me, while I am looking elsewhere: a notification on this device.
        if (eventType === 'INSERT' && row.author_id !== me?.id && (row.channel_id !== here || document.hidden)) {
          const ch = channelsRef.current.find((c) => c.id === row.channel_id);
          if (ch?.kind === 'dm') {
            const who = peopleRef.current.get(row.author_id)?.name || 'Someone';
            api.showDeviceNotification(`${who} · The Gathering`, (row.body || 'Sent you a photo').replace(/\*\*?/g, '').slice(0, 120), () => navigate(`/gather/${ch.slug}`));
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tab title shows what is waiting.
  const unread = channels.reduce((s, c) => s + (c.id === channel?.id ? 0 : c.unread || 0), 0);
  useEffect(() => { document.title = `${unread ? `(${unread}) ` : ''}${channel ? channelName(channel, people, me) + ' · ' : ''}The Gathering`; }, [unread, channel, people, me]);

  // ── The Daily Word pop-up: once a day, the first time someone opens The Gathering ──
  useEffect(() => {
    if (state !== 'ready') return;
    const day = api.etToday();
    let seen = '';
    try { seen = localStorage.getItem(WORD_SEEN) || ''; } catch { /* private mode */ }
    if (seen === day) return;
    const wc = channels.find((c) => c.slug === 'daily-word');
    if (!wc) return;
    supabase.from('chat_messages').select('*').eq('channel_id', wc.id).eq('kind', 'scripture').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { const m = data?.[0]; if (m && m.meta?.day === day) setWord(m); });
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const closeWord = () => { try { localStorage.setItem(WORD_SEEN, api.etToday()); } catch { /* private mode */ } setWord(null); };

  // ── Actions ──
  const byId = useCallback((id) => messages.find((m) => m.id === id) || thread?.replies.find((m) => m.id === id) || (thread?.root?.id === id ? thread.root : null), [messages, thread]);
  const replace = (row) => {
    setMessages((list) => list.map((x) => (x.id === row.id ? row : x)));
    setThread((t) => (t ? { root: t.root.id === row.id ? row : t.root, replies: t.replies.map((x) => (x.id === row.id ? row : x)) } : t));
  };
  const sendTo = async (channelId, text, files, reply, root) => {
    const attachments = [];
    for (const f of files) attachments.push(await api.upload(f, me.id));
    const row = await api.post(channelId, text, attachments, reply?.id || null, root?.id || null);
    await signFor([row]);
    if (root) {
      setThread((t) => (t && !t.replies.some((x) => x.id === row.id) ? { root: { ...t.root, reply_count: (t.root.reply_count || 0) + 1, last_reply_at: row.created_at }, replies: [...t.replies, row] } : t));
      setMessages((list) => list.map((x) => (x.id === root.id ? { ...x, reply_count: (x.reply_count || 0) + 1, last_reply_at: row.created_at } : x)));
    } else {
      atBottom.current = true;
      setMessages((list) => (list.some((x) => x.id === row.id) ? list : [...list, row]));
    }
  };
  const openThread = async (m) => {
    setPanel(null); setThreadReplyTo(null);
    setThread({ root: m, replies: [] });
    const replies = await api.getThread(m.id);
    ensurePeople(replies.map((r) => r.author_id)); signFor(replies);
    setThread((t) => (t && t.root.id === m.id ? { ...t, replies } : t));
  };
  const actions = {
    react: async (m, emoji) => { try { const r = await api.react(m.id, emoji); replace({ ...m, reactions: r || {} }); } catch (e) { setError(e.message); } },
    reply: (m) => (m.thread_root ? setThreadReplyTo(m) : setReplyTo(m)),
    thread: openThread,
    edit: async (m, body) => { try { replace(await api.edit(m.id, body)); } catch (e) { setError(e.message); } },
    remove: async (m) => { if (!window.confirm('Remove this message? This cannot be undone.')) return; try { replace(await api.remove(m.id)); } catch (e) { setError(e.message); } },
    pin: async (m) => { try { replace(await api.pin(m.id, !m.pinned)); } catch (e) { setError(e.message); } },
    person: (id) => { const p = people.get(id); if (p) setPerson(p); },
    lightbox: (items, index) => setLight({ items, index }),
    jump: (id) => { const el = document.getElementById(`m-${id}`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1600); } },
  };
  const messagePerson = async (p) => {
    setPerson(null); setPanel(null);
    try {
      const s = await api.openDm(p.id);
      await loadChannels();
      navigate(`/gather/${s}`);
    } catch (e) { setError(e.message); }
  };

  // ── Screens before the room ──
  if (!loading && !user) return <Guest />;
  if (state === 'loading') return <Shell><div className="gt-center"><Loader2 className="gt-spin" size={28} /><p>Opening The Gathering…</p></div></Shell>;
  if (state === 'outside' || state === 'failed') {
    return (
      <Shell>
        <div className="gt-center gt-gate">
          <img src={mark} alt="" />
          <h1>The <em>Gathering</em></h1>
          {state === 'failed' ? <p>{/does not exist|schema|function/i.test(error) ? 'The Gathering is being set up. Check back shortly.' : error}</p> : (
            <>
              <p>The Gathering is for P31 vendors, mentorship students and alumnae, mentors and the team. Your account is not part of one of those yet.</p>
              <p className="gt-gate__links">
                <a href="https://www.p31market.com/apply">Apply to vend</a> · <a href="https://www.thep31collective.org/mentorship">Explore mentorship</a>
              </p>
            </>
          )}
          <Link className="gt-btn" to="/"><ArrowLeft size={15} /> Back to the site</Link>
        </div>
      </Shell>
    );
  }

  // ── The room ──
  const meP = people.get(me.id) || { id: me.id, name: user?.user_metadata?.full_name || 'You', roles: me.roles };
  const pinned = messages.filter((m) => m.pinned && !m.deleted_at);
  const locked = channel && ['announcements', 'scripture'].includes(channel.kind) && !me.moderator
    ? (channel.kind === 'scripture' ? 'Share what today’s word speaks to you in its discussion: tap “Join the discussion”.' : 'Only the team posts here. Reply in a thread to join in.') : null;
  const dms = channels.filter((c) => c.kind === 'dm');
  const members = [...people.values()].filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Shell>
      <div className={`gt ${nav ? 'nav-open' : ''} ${thread || panel ? 'side-open' : ''}`}>
        {/* Channels */}
        <aside className="gt-side" aria-label="Channels">
          <header className="gt-side__brand">
            <img src={mark} alt="" />
            <div><strong>The Gathering</strong><small>Proverbs 31 · by NEBA</small></div>
            <button type="button" className="gt-icon gt-only-phone" onClick={() => setNav(false)} aria-label="Close channels"><X size={18} /></button>
          </header>
          <nav className="gt-side__list">
            {SECTIONS.map(([key, label]) => {
              const list = channels.filter((c) => c.section === key);
              if (!list.length) return null;
              return (
                <div key={key} className="gt-sec">
                  <p className="gt-sec__label">{label}</p>
                  {list.map((c) => {
                    const Icon = ICONS[c.icon] || Hash;
                    return (
                      <Link key={c.id} to={`/gather/${c.slug}`} className={`gt-ch ${c.id === channel?.id ? 'is-on' : ''} ${c.unread ? 'has-new' : ''}`}>
                        <Icon size={16} /> <span>{c.name}</span>{c.unread > 0 && c.id !== channel?.id && <b>{c.unread > 99 ? '99+' : c.unread}</b>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
            <div className="gt-sec">
              <p className="gt-sec__label">Direct messages <button type="button" className="gt-icon gt-icon--sm" onClick={() => setPanel('members')} aria-label="New message"><Plus size={14} /></button></p>
              {dms.map((c) => {
                const other = people.get(c.other_user);
                return (
                  <Link key={c.id} to={`/gather/${c.slug}`} className={`gt-ch gt-ch--dm ${c.id === channel?.id ? 'is-on' : ''} ${c.unread ? 'has-new' : ''}`}>
                    <Avatar person={other} size={22} /> <span>{other?.name || 'Conversation'}</span>{c.unread > 0 && c.id !== channel?.id && <b>{c.unread}</b>}
                  </Link>
                );
              })}
              {!dms.length && <p className="gt-sec__empty">Open anyone’s card to send a private message.</p>}
            </div>
          </nav>
          <footer className="gt-me">
            <Avatar person={meP} size={34} onClick={() => setPerson(meP)} />
            <div><strong>{meP.name}</strong><Badges roles={meP.roles} max={1} /></div>
          </footer>
        </aside>
        <button type="button" className="gt-scrim" onClick={() => { setNav(false); }} aria-label="Close menu" tabIndex={-1} />

        {/* Conversation */}
        <main className="gt-main">
          <header className="gt-head">
            <button type="button" className="gt-icon gt-only-phone" onClick={() => setNav(true)} aria-label="Channels"><Menu size={20} /></button>
            <div className="gt-head__title">
              <h1>{channel ? channelName(channel, people, me) : 'The Gathering'}</h1>
              {channel?.topic && channel.kind !== 'dm' && <p>{channel.topic}</p>}
              {channel?.kind === 'dm' && <Badges roles={people.get(channel.other_user)?.roles} max={3} />}
            </div>
            {pinned.length > 0 && <button type="button" className={`gt-icon ${panel === 'pins' ? 'is-on' : ''}`} onClick={() => { setThread(null); setPanel(panel === 'pins' ? null : 'pins'); }} aria-label="Pinned messages" title="Pinned"><Pin size={18} /></button>}
            <button type="button" className={`gt-icon ${panel === 'members' ? 'is-on' : ''}`} onClick={() => { setThread(null); setPanel(panel === 'members' ? null : 'members'); }} aria-label="Members" title="Members"><Users size={18} /><span className="gt-icon__label">Members</span></button>
          </header>

          {error && <p className="gt-alert" role="alert">{error} <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} /></button></p>}

          <div className="gt-list" ref={listRef} onScroll={onScroll}>
            {more && <button type="button" className="gt-older" onClick={loadOlder}>Load earlier messages</button>}
            {!messages.length && channel && <div className="gt-empty"><MessageCircle size={26} /><p>{channel.kind === 'dm' ? 'Say hello. This conversation is just the two of you.' : 'No messages yet. Be the first to say something.'}</p></div>}
            {messages.map((m, i) => (
              <React.Fragment key={m.id}>
                {!sameDay(messages[i - 1], m) && <DayDivider iso={m.created_at} />}
                <Message m={m} prev={sameDay(messages[i - 1], m) ? messages[i - 1] : null} people={people} me={me} urls={urls} byId={byId} actions={actions} />
              </React.Fragment>
            ))}
          </div>

          {channel && (
            <Composer
              key={channel.id}
              locked={locked}
              placeholder={channel.kind === 'dm' ? `Message ${channelName(channel, people, me)}` : `Message #${channel.name}`}
              replyTo={replyTo} replyName={replyTo && (people.get(replyTo.author_id)?.name || 'this message')} onCancelReply={() => setReplyTo(null)}
              onSend={async (text, files) => { await sendTo(channel.id, text, files, replyTo, null); setReplyTo(null); }}
            />
          )}
        </main>

        {/* Thread, members or pins */}
        {(thread || panel) && (
          <aside className="gt-panel" aria-label={thread ? 'Thread' : panel === 'pins' ? 'Pinned messages' : 'Members'}>
            <header className="gt-panel__head">
              <strong>{thread ? (thread.root.kind === 'scripture' ? 'Daily Word discussion' : 'Thread') : panel === 'pins' ? 'Pinned' : 'Members'}</strong>
              <button type="button" className="gt-icon" onClick={() => { setThread(null); setPanel(null); }} aria-label="Close"><X size={18} /></button>
            </header>
            {thread && (
              <>
                <div className="gt-list gt-list--thread">
                  <Message m={thread.root} people={people} me={me} urls={urls} byId={byId} actions={actions} inThread />
                  <p className="gt-thread-count">{thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}</p>
                  {thread.replies.map((m, i) => <Message key={m.id} m={m} prev={thread.replies[i - 1]} people={people} me={me} urls={urls} byId={byId} actions={actions} inThread />)}
                </div>
                <Composer
                  key={thread.root.id}
                  placeholder={thread.root.kind === 'scripture' ? 'What is this word speaking to you?' : 'Reply in the thread'}
                  replyTo={threadReplyTo} replyName={threadReplyTo && (people.get(threadReplyTo.author_id)?.name || 'this message')} onCancelReply={() => setThreadReplyTo(null)}
                  onSend={async (text, files) => { await sendTo(thread.root.channel_id, text, files, threadReplyTo, thread.root); setThreadReplyTo(null); }}
                  autoFocus
                />
              </>
            )}
            {!thread && panel === 'pins' && (
              <div className="gt-list gt-list--thread">
                {pinned.map((m) => <Message key={m.id} m={m} people={people} me={me} urls={urls} byId={byId} actions={actions} inThread />)}
              </div>
            )}
            {!thread && panel === 'members' && (
              <div className="gt-members">
                <label className="gt-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find someone" aria-label="Find someone" /></label>
                {GROUPS.map(([g, label]) => {
                  const list = members.filter((p) => groupOf(p.roles) === g).sort((a, b) => a.name.localeCompare(b.name));
                  if (!list.length) return null;
                  return (
                    <div key={g} className="gt-members__group">
                      <p className="gt-sec__label">{label} · {list.length}</p>
                      {list.map((p) => (
                        <button key={p.id} type="button" className="gt-member" onClick={() => setPerson(p)}>
                          <Avatar person={p} size={32} />
                          <span><strong>{p.name}{p.id === me.id ? ' (you)' : ''}</strong><Badges roles={p.roles} max={1} /></span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>

      {person && <PersonCard person={person} me={me} onClose={() => setPerson(null)} onMessage={messagePerson}
        onSetPrefs={async (dmEmail) => { const r = await api.setPrefs(dmEmail); setMe((m) => ({ ...m, dm_email: r?.dm_email ?? dmEmail })); }}
        onSetTitle={async (p, title) => { await api.setTitle(p.id, title); const [fresh] = await api.getPeople([p.id]); if (fresh) { setPeople((m) => new Map(m).set(fresh.id, fresh)); setPerson(fresh); } }} />}
      {light && <Lightbox items={light.items} index={light.index} urls={urls} onClose={() => setLight(null)} />}
      {word && (
        <div className="gt-sheet" role="dialog" aria-modal="true" aria-label="Today’s Daily Word" onClick={(e) => e.target === e.currentTarget && closeWord()}>
          <div className="gt-wordpop">
            <button type="button" className="gt-person__close" onClick={closeWord} aria-label="Close"><X size={18} /></button>
            <img src={mark} alt="" />
            <p className="gt-word__eyebrow"><BookOpen size={13} /> Today’s Daily Word</p>
            <blockquote>“{word.meta?.text}”</blockquote>
            <p className="gt-word__ref">{word.meta?.ref} · KJV</p>
            <p className="gt-word__prompt">{word.body}</p>
            <div className="gt-word__actions">
              <button type="button" className="gt-btn gt-btn--gold" onClick={() => { closeWord(); navigate('/gather/daily-word'); setTimeout(() => openThread(word), 300); }}><MessageCircle size={15} /> Join the discussion</button>
              <button type="button" className="gt-btn" onClick={() => { actions.react(word, '🙏🏾'); closeWord(); }}>🙏🏾 Amen</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
};

function channelName(c, people, me) {
  if (c.kind !== 'dm') return c.name;
  return people.get(c.other_user)?.name || (me ? 'Conversation' : 'Direct message');
}

const Shell = ({ children }) => <div className="gt-shell">{children}</div>;

const Guest = () => (
  <Shell>
    <div className="gt-center gt-gate">
      <img src={mark} alt="" />
      <h1>The <em>Gathering</em></h1>
      <p>Where P31 vendors, mentorship students, mentors and the team come together: conversation, prayer, celebration, and a Daily Word every morning.</p>
      <Link className="gt-btn gt-btn--gold" to={isCollective ? '/portal?next=/gather' : '/login?next=/gather'}><LogIn size={16} /> Sign in to join</Link>
    </div>
  </Shell>
);

export default Gather;
