import React, { useEffect, useRef, useState } from 'react';
import { CornerUpLeft, MessageSquareText, SmilePlus, Pencil, Trash2, Pin, PinOff, X, ImagePlus, Send, Loader2, BookOpen, Store, MessageCircle, Sparkles, Bell, Mail } from 'lucide-react';
import { REACTIONS, timeOf, dayOf, ago, deviceNotify, setDeviceNotify } from './api';
import { badgesFor, initials } from './badges';
import mark from '../assets/academy/collective-mark.webp';

// ── People ───────────────────────────────────────────────
export const Avatar = ({ person, size = 40, onClick }) => {
  const inner = person?.avatar_url
    ? <img src={person.avatar_url} alt="" loading="lazy" />
    : <span>{initials(person?.name)}</span>;
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return onClick
    ? <button type="button" className="gt-av" style={style} onClick={onClick} aria-label={`About ${person?.name || 'this member'}`}>{inner}</button>
    : <span className="gt-av" style={style} aria-hidden="true">{inner}</span>;
};

export const Badges = ({ roles, max = 2, size = 'sm' }) => {
  const list = badgesFor(roles);
  if (!list.length) return null;
  const shown = list.slice(0, max);
  return (
    <span className={`gt-badges gt-badges--${size}`}>
      {shown.map((b) => <span key={b.key} className={`gt-badge gt-badge--${b.tone}`} title={b.label}><b.Icon size={size === 'sm' ? 10 : 12} /> {b.label}</span>)}
      {list.length > max && <span className="gt-badge gt-badge--more" title={list.slice(max).map((b) => b.label).join(', ')}>+{list.length - max}</span>}
    </span>
  );
};

// ── Text: links, **bold**, *italic*, line breaks (no HTML ever) ──
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;
export const RichText = ({ text }) => {
  if (!text) return null;
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}{p.length > 70 ? '…' : ''}</a>;
        if (/^\*\*.+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (/^\*.+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
};

// ── Photos and videos ───────────────────────────────────
export const Media = ({ items, urls, onOpen }) => {
  if (!items?.length) return null;
  return (
    <div className={`gt-media gt-media--${Math.min(items.length, 4)}`}>
      {items.map((a, i) => {
        const url = urls[a.path];
        if (!url) return <span key={a.path} className="gt-media__wait" aria-label="Loading media" />;
        return a.type === 'video'
          ? <video key={a.path} src={url} controls playsInline preload="metadata" className="gt-media__item" />
          : <button key={a.path} type="button" className="gt-media__item" onClick={() => onOpen(items.filter((x) => x.type === 'image'), i)}>
              <img src={url} alt={a.name || 'Shared photo'} loading="lazy" width={a.width || undefined} height={a.height || undefined} />
            </button>;
      })}
    </div>
  );
};

export const Lightbox = ({ items, index, urls, onClose }) => {
  const [i, setI] = useState(index);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose]);
  const a = items[i];
  return (
    <div className="gt-lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="gt-lightbox__close" onClick={onClose} aria-label="Close"><X size={22} /></button>
      {a && <img src={urls[a.path]} alt={a.name || ''} />}
      {items.length > 1 && <p className="gt-lightbox__count">{i + 1} / {items.length}</p>}
    </div>
  );
};

// ── One message ─────────────────────────────────────────
const sameGroup = (a, b) => a && b && a.author_id && a.author_id === b.author_id && a.kind === 'message' && b.kind === 'message'
  && !b.reply_to && !a.deleted_at && new Date(b.created_at) - new Date(a.created_at) < 7 * 60e3
  && dayOf(a.created_at) === dayOf(b.created_at);

export const DayDivider = ({ iso }) => <div className="gt-day" role="separator"><span>{dayOf(iso)}</span></div>;

export const Message = ({ m, prev, people, me, urls, byId, inThread, actions }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body || '');
  const [picker, setPicker] = useState(false);
  const author = people.get(m.author_id);
  const mine = m.author_id && m.author_id === me.id;
  const grouped = sameGroup(prev, m);
  const quoted = m.reply_to ? byId(m.reply_to) : null;

  if (m.kind === 'scripture') return <WordCard m={m} people={people} me={me} actions={actions} inThread={inThread} />;
  if (m.kind === 'system') {
    return (
      <article className="gt-msg gt-msg--system" id={`m-${m.id}`}>
        <img src={mark} alt="" className="gt-msg__mark" />
        <div className="gt-msg__main">
          <header className="gt-msg__head"><strong>The P31 Gathering</strong>{m.pinned && <span className="gt-pin"><Pin size={11} /> Pinned</span>}</header>
          <div className="gt-msg__body"><RichText text={m.body} /></div>
        </div>
      </article>
    );
  }

  const save = async () => { await actions.edit(m, draft); setEditing(false); };
  const reactionList = Object.entries(m.reactions || {}).filter(([, ids]) => ids?.length);

  return (
    <article className={`gt-msg ${grouped ? 'is-grouped' : ''} ${mine ? 'is-mine' : ''} ${m.pinned ? 'is-pinned' : ''}`} id={`m-${m.id}`}>
      {grouped ? <span className="gt-msg__time-side">{timeOf(m.created_at)}</span> : <Avatar person={author} onClick={() => actions.person(m.author_id)} />}
      <div className="gt-msg__main">
        {!grouped && (
          <header className="gt-msg__head">
            <button type="button" className="gt-name" onClick={() => actions.person(m.author_id)}>{author?.name || 'P31 member'}</button>
            <Badges roles={author?.roles} />
            <time dateTime={m.created_at}>{timeOf(m.created_at)}</time>
            {m.pinned && <span className="gt-pin"><Pin size={11} /> Pinned</span>}
          </header>
        )}
        {quoted && (
          <button type="button" className="gt-quote" onClick={() => actions.jump(quoted.id)}>
            <CornerUpLeft size={12} /> <b>{people.get(quoted.author_id)?.name || 'P31 member'}</b> <span>{quoted.deleted_at ? 'removed message' : (quoted.body || 'a photo').replace(/\*\*?/g, '').slice(0, 90)}</span>
          </button>
        )}
        {m.deleted_at ? <p className="gt-msg__gone">This message was removed.</p> : editing ? (
          <div className="gt-edit">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }} />
            <div><button type="button" className="gt-btn gt-btn--gold gt-btn--sm" onClick={save}>Save</button> <button type="button" className="gt-btn gt-btn--sm" onClick={() => setEditing(false)}>Cancel</button></div>
          </div>
        ) : (
          <>
            {m.body && <div className="gt-msg__body"><RichText text={m.body} />{m.edited_at && <small className="gt-edited"> (edited)</small>}</div>}
            <Media items={m.attachments} urls={urls} onOpen={actions.lightbox} />
          </>
        )}
        {reactionList.length > 0 && (
          <div className="gt-reacts">
            {reactionList.map(([emoji, ids]) => (
              <button key={emoji} type="button" className={`gt-react ${ids.includes(me.id) ? 'is-mine' : ''}`} onClick={() => actions.react(m, emoji)}
                title={ids.map((id) => people.get(id)?.name || 'Someone').join(', ')}>{emoji} <b>{ids.length}</b></button>
            ))}
          </div>
        )}
        {!inThread && m.reply_count > 0 && (
          <button type="button" className="gt-thread-link" onClick={() => actions.thread(m)}>
            <MessageSquareText size={14} /> {m.reply_count} {m.reply_count === 1 ? 'reply' : 'replies'} <span>· {ago(m.last_reply_at || m.created_at)}</span>
          </button>
        )}
      </div>
      {!m.deleted_at && !editing && (
        <div className="gt-tools" role="toolbar" aria-label="Message actions">
          <div className="gt-tools__pick">
            <button type="button" onClick={() => setPicker(!picker)} aria-label="React" title="React"><SmilePlus size={16} /></button>
            {picker && <div className="gt-picker" onMouseLeave={() => setPicker(false)}>{REACTIONS.map((e) => <button key={e} type="button" onClick={() => { setPicker(false); actions.react(m, e); }}>{e}</button>)}</div>}
          </div>
          <button type="button" onClick={() => actions.reply(m)} aria-label="Reply" title="Reply"><CornerUpLeft size={16} /></button>
          {!inThread && <button type="button" onClick={() => actions.thread(m)} aria-label="Reply in thread" title="Reply in thread"><MessageSquareText size={16} /></button>}
          {mine && <button type="button" onClick={() => { setDraft(m.body || ''); setEditing(true); }} aria-label="Edit" title="Edit"><Pencil size={15} /></button>}
          {me.moderator && !inThread && <button type="button" onClick={() => actions.pin(m)} aria-label={m.pinned ? 'Unpin' : 'Pin'} title={m.pinned ? 'Unpin' : 'Pin'}>{m.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>}
          {(mine || me.moderator) && <button type="button" className="is-danger" onClick={() => actions.remove(m)} aria-label="Remove" title="Remove"><Trash2 size={15} /></button>}
        </div>
      )}
    </article>
  );
};

// ── The Daily Word, as it appears in the channel ────────
export const WordCard = ({ m, me, actions, inThread }) => {
  const day = m.meta?.day ? new Date(`${m.meta.day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : dayOf(m.created_at);
  const amens = m.reactions?.['🙏🏾'] || [];
  return (
    <article className="gt-word" id={`m-${m.id}`}>
      <p className="gt-word__eyebrow"><BookOpen size={13} /> Daily Word · {day}</p>
      <blockquote>“{m.meta?.text}”</blockquote>
      <p className="gt-word__ref">{m.meta?.ref} · KJV</p>
      <p className="gt-word__prompt">{m.body}</p>
      {!inThread && (
        <div className="gt-word__actions">
          <button type="button" className="gt-btn gt-btn--gold" onClick={() => actions.thread(m)}>
            <MessageCircle size={15} /> {m.reply_count ? `Join the discussion (${m.reply_count})` : 'Start the discussion'}
          </button>
          <button type="button" className={`gt-btn ${amens.includes(me.id) ? 'is-on' : ''}`} onClick={() => actions.react(m, '🙏🏾')}>🙏🏾 Amen{amens.length ? ` · ${amens.length}` : ''}</button>
        </div>
      )}
    </article>
  );
};

// ── Writing ─────────────────────────────────────────────
export const Composer = ({ placeholder, onSend, replyTo, replyName, onCancelReply, locked, autoFocus }) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const ref = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { if (replyTo) ref.current?.focus(); }, [replyTo]);
  useEffect(() => () => files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), [files]);
  useEffect(() => { // grow with the text
    const el = ref.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  if (locked) return <div className="gt-composer gt-composer--locked"><Sparkles size={15} /> {locked}</div>;

  const pick = (e) => {
    const list = [...(e.target.files || [])].slice(0, 6 - files.length).map((file) => ({ file, preview: /^image\//.test(file.type) ? URL.createObjectURL(file) : null }));
    setFiles((f) => [...f, ...list]);
    e.target.value = '';
  };
  const send = async () => {
    if (busy || (!text.trim() && !files.length)) return;
    setError('');
    try {
      setBusy(files.length ? `Uploading ${files.length === 1 ? 'your file' : `${files.length} files`}…` : 'Sending…');
      await onSend(text, files.map((f) => f.file));
      setText(''); setFiles([]);
    } catch (e) { setError(e.message); }
    setBusy('');
    ref.current?.focus();
  };
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <div className="gt-composer">
      {replyTo && (
        <div className="gt-composer__reply"><CornerUpLeft size={13} /> Replying to <b>{replyName}</b><button type="button" onClick={onCancelReply} aria-label="Cancel reply"><X size={14} /></button></div>
      )}
      {files.length > 0 && (
        <div className="gt-composer__files">
          {files.map((f, i) => (
            <span key={i} className="gt-chipfile">
              {f.preview ? <img src={f.preview} alt="" /> : <span className="gt-chipfile__vid">▶</span>}
              <small>{f.file.name}</small>
              <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label={`Remove ${f.file.name}`}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="gt-composer__error" role="alert">{error}</p>}
      <div className="gt-composer__row">
        <button type="button" className="gt-composer__attach" onClick={() => fileRef.current?.click()} disabled={files.length >= 6 || !!busy} aria-label="Add photos or videos" title="Add photos or videos"><ImagePlus size={20} /></button>
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple hidden onChange={pick} />
        <textarea ref={ref} rows={1} value={text} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); send(); } }}
          onPaste={(e) => { const imgs = [...e.clipboardData.files].filter((f) => /^image\//.test(f.type)); if (imgs.length) setFiles((f) => [...f, ...imgs.slice(0, 6 - f.length).map((file) => ({ file, preview: URL.createObjectURL(file) }))]); }} />
        <button type="button" className="gt-composer__send" onClick={send} disabled={!!busy || (!text.trim() && !files.length)} aria-label="Send">{busy ? <Loader2 size={18} className="gt-spin" /> : <Send size={18} />}</button>
      </div>
      {busy && <p className="gt-composer__busy">{busy}</p>}
    </div>
  );
};

// ── About a member ──────────────────────────────────────
export const PersonCard = ({ person, me, onClose, onMessage, onSetTitle, onSetPrefs }) => {
  const [title, setTitle] = useState(person?.roles?.title || '');
  const [saved, setSaved] = useState('');
  const [device, setDevice] = useState(() => deviceNotify());
  const [note, setNote] = useState('');
  const mine = person?.id === me.id;
  const toggleDevice = async () => {
    setNote('');
    try { const on = await setDeviceNotify(!device); setDevice(on); } catch (e) { setNote(e.message); }
  };
  const vendor = person.roles?.vendor;
  return (
    <div className="gt-sheet" role="dialog" aria-modal="true" aria-label={person.name} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gt-person">
        <button type="button" className="gt-person__close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <Avatar person={person} size={84} />
        <h3>{person.name}</h3>
        <Badges roles={person.roles} max={6} size="md" />
        {vendor?.slug && <a className="gt-person__shop" href={`https://www.p31market.com/${vendor.slug}`} target="_blank" rel="noreferrer"><Store size={14} /> {vendor.shop || 'Visit her shop'}</a>}
        {person.id !== me.id && <button type="button" className="gt-btn gt-btn--gold" onClick={() => onMessage(person)}><MessageCircle size={15} /> Message {person.name.split(' ')[0]}</button>}
        {mine && (
          <div className="gt-person__prefs">
            <p className="gt-person__prefs-title">When someone messages you privately</p>
            <label className="gt-switch">
              <input type="checkbox" checked={me.dm_email !== false} onChange={(e) => onSetPrefs?.(e.target.checked)} />
              <span><Mail size={14} /> Email me if I have not read it within a few minutes</span>
            </label>
            <label className="gt-switch">
              <input type="checkbox" checked={device} onChange={toggleDevice} />
              <span><Bell size={14} /> Notify me on this device while The Gathering is open</span>
            </label>
            {note && <small>{note}</small>}
          </div>
        )}
        {me.overseer && (
          <form className="gt-person__title" onSubmit={async (e) => { e.preventDefault(); try { await onSetTitle(person, title); setSaved('Saved'); } catch (err) { setSaved(err.message); } }}>
            <label><span>Title (overseers)</span><input value={title} maxLength={40} onChange={(e) => { setTitle(e.target.value); setSaved(''); }} placeholder="e.g. Founder & CEO" /></label>
            <button type="submit" className="gt-btn gt-btn--sm">Save title</button>
            {saved && <small>{saved}</small>}
          </form>
        )}
      </div>
    </div>
  );
};
