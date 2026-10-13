import React, { useEffect, useState } from 'react';
import { Layers, Wand2, CalendarClock, Save, Loader2, X, Sparkles } from 'lucide-react';
import Thumb from './Thumb';
import { fromWords, resize, toReel } from './templates';
import { STYLES } from './brand';
import { PATTERN_KINDS } from './patterns';
import { renderStill, renderVideo, videoLength } from './export';
import { getMusicBuffer } from './audio';
import { saveDesign } from './store';
import { thumbDataUrl } from './thumbs';
import { studio, uploadMedia, bestSlotsET } from '../api';
import { askAi } from '../ai';

const pad = (n) => String(n).padStart(2, '0');
const etToday = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const TAGS = '#P31Marketplace #Proverbs31Woman #FaithAndBusiness #KingdomEntrepreneur #WomenWhoBuild';
const KINDS = [
  ['quote', 'Bold quote', 'One quote per line'],
  ['prayer', 'Prayer', 'Opener | statement (e.g. Dear God, | Make me bold)'],
  ['scripture', 'Scripture', 'Verse | reference (KJV wording)'],
  ['blank', 'Fill in the blank', 'The start of the sentence'],
];
const wordsFor = (template, line) => {
  const [a, b] = line.split('|').map((s) => s.trim());
  if (template === 'prayer') return b ? { intro: a, headline: b } : { intro: 'Dear God,', headline: a };
  if (template === 'scripture') return { verse: a, reference: b || '' };
  if (template === 'blank') return { headline: a, eyebrow: 'Finish the sentence', ask: 'Answer in the comments' };
  return { headline: a };
};
const plainCaption = (line) => `${line.split('|').pop().trim()}\n\nWhat does this stir in you today? Tell us below. 💜\n\n${TAGS}`;

/**
 * Many posts at once: paste lines, choose the look, and the Studio makes a design for each, in
 * rotating brand colours, with captions; then saves them all or schedules them at good times.
 */
const Batch = ({ doc, shared }) => {
  const [lines, setLines] = useState('');
  const [template, setTemplate] = useState('quote');
  const [looks, setLooks] = useState('rotate');
  const [patterns, setPatterns] = useState('mix');
  const [format, setFormat] = useState('image');
  const [start, setStart] = useState(() => { const d = etToday(); d.setDate(d.getDate() + 1); return isoDay(d); });
  const [times, setTimes] = useState(['12:30', '19:30']);
  const [platforms, setPlatforms] = useState(['instagram', 'facebook']);
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // Suggest the two best weekday hours from Instagram's own data.
  useEffect(() => {
    studio('overview').then((o) => {
      const slots = bestSlotsET(o?.bestTime?.slots || [], 12).filter((s) => s.hour >= 9 && s.hour <= 21);
      const hours = [...new Set(slots.map((s) => s.hour))].slice(0, 2).sort((a, b) => a - b);
      if (hours.length === 2 && hours[1] - hours[0] >= 3) setTimes(hours.map((h) => `${pad(h)}:00`));
    }).catch(() => {});
  }, []);

  const build = () => {
    setError(''); setDone('');
    const list = lines.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 60);
    if (!list.length) { setError('Paste at least one line.'); return; }
    const kinds = PATTERN_KINDS.filter((k) => !['none', 'grain'].includes(k.key)).map((k) => k.key);
    const per = Math.max(1, times.length);
    setItems(list.map((line, i) => {
      const style = looks === 'rotate' ? STYLES[i % STYLES.length].key : doc.style;
      const pattern = patterns === 'mix' ? (i % 3 === 0 ? kinds[(i / 3) % kinds.length] : 'topo') : doc.pattern?.kind || 'topo';
      const d = resize(fromWords({ template, style, pattern, seed: 101 + i * 37, words: wordsFor(template, line) }), doc.size);
      const day = new Date(`${start}T12:00:00`); day.setDate(day.getDate() + Math.floor(i / per));
      return { key: `${i}-${line.slice(0, 12)}`, line, doc: { ...d, music: doc.music }, caption: plainCaption(line), when: `${isoDay(day)}T${times[i % per]}` };
    }));
  };
  const update = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const writeCaptions = async () => {
    setBusy('ai'); setError('');
    try {
      for (const [i, it] of items.entries()) {
        setProgress({ done: i, total: items.length, label: 'Writing captions' });
        const [first] = await askAi('caption', { topic: it.line.replace('|', ' '), platforms: 'Instagram and Facebook', details: 'For faith-driven women entrepreneurs (Proverbs 31 Marketplace). Warm and bold, two or three short lines, then one genuine question that invites a comment. No "tag a friend" or "share if". Keep any scripture word for word. End with 5 hashtags including #P31Marketplace.', maxChars: 450 });
        if (first) update(i, { caption: first.trim() });
      }
    } catch (e) { setError(e.message); }
    setProgress(null); setBusy('');
  };

  const saveAll = async () => {
    setBusy('save'); setError('');
    try {
      for (const [i, it] of items.entries()) {
        setProgress({ done: i, total: items.length, label: 'Saving' });
        await saveDesign({ title: it.line.slice(0, 80), doc: { ...it.doc, caption: it.caption }, thumb: await thumbDataUrl(it.doc) }, shared !== false);
      }
      setDone(`${items.length} designs saved. Find them under Saved.`);
    } catch (e) { setError(e.message); }
    setProgress(null); setBusy('');
  };

  const scheduleAll = async () => {
    if (!platforms.length) { setError('Pick Instagram, Facebook or both.'); return; }
    setBusy('schedule'); setError(''); setDone('');
    const failed = [];
    for (const [i, it] of items.entries()) {
      setProgress({ done: i, total: items.length, label: format === 'video' ? 'Making videos and scheduling' : 'Scheduling' });
      try {
        let file; let type; let coverUrl = null;
        if (format === 'video') {
          // Reels go out at 9:16, with the finished card as the cover.
          const reel = toReel(it.doc);
          const len = videoLength(reel);
          const audio = await getMusicBuffer(reel.music, len);
          const out = await renderVideo(reel, { seconds: len, audio });
          file = new File([out.blob], `p31-batch-${i + 1}.${out.type === 'video/mp4' ? 'mp4' : 'webm'}`, { type: out.type }); type = 'video';
          coverUrl = await uploadMedia(new File([await renderStill(reel)], `p31-batch-${i + 1}-cover.jpg`, { type: 'image/jpeg' }));
        } else {
          file = new File([await renderStill(it.doc)], `p31-batch-${i + 1}.jpg`, { type: 'image/jpeg' }); type = 'image';
        }
        const url = await uploadMedia(file, file.name);
        const ig = it.doc.music?.ig;
        await studio('create', {
          platforms, content: it.caption, title: it.line.slice(0, 90), media: [{ type, url, altText: it.line.replace('|', ' ') }],
          scheduledFor: it.when, timezone: 'America/New_York',
          ...(type === 'video' && ig ? { audioId: ig.id, audioVolume: 100, videoVolume: 0 } : {}),
          ...(coverUrl ? { coverUrl } : {}),
        });
      } catch (e) { failed.push(`${it.line.slice(0, 40)}: ${e.message}`); }
    }
    setProgress(null); setBusy('');
    if (failed.length) setError(`${failed.length} did not schedule. ${failed.slice(0, 3).join(' · ')}`);
    setDone(`${items.length - failed.length} of ${items.length} scheduled. They are on the Calendar.`);
  };

  return (
    <div className="dz-batch">
      <p className="ds-muted dz-small">Paste one line per post. Each becomes a design in the current size, in rotating brand colours, with a caption. Look them over, then save them or schedule the lot.</p>
      <label className="dz-field"><span>Kind of post</span>
        <select className="k-input" value={template} onChange={(e) => setTemplate(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <small className="ds-muted">{KINDS.find((k) => k[0] === template)[2]}</small>
      </label>
      <label className="dz-field"><span>Lines</span>
        <textarea className="k-input dz-textarea" rows={7} value={lines} onChange={(e) => setLines(e.target.value)} placeholder={'Push me God. I want the promises we talked about.\nDelayed is not denied. Keep building.\nFaith over fear. Purpose over pressure.'} />
      </label>
      <div className="dz-two">
        <label className="dz-field"><span>Colours</span>
          <select className="k-input" value={looks} onChange={(e) => setLooks(e.target.value)}><option value="rotate">Rotate the brand styles</option><option value="current">Like this design</option></select>
        </label>
        <label className="dz-field"><span>Patterns</span>
          <select className="k-input" value={patterns} onChange={(e) => setPatterns(e.target.value)}><option value="mix">Mostly topo, some others</option><option value="current">Like this design</option></select>
        </label>
      </div>
      <button type="button" className="k-btn k-btn--gold k-btn--sm" onClick={build}><Layers size={14} /> Make the designs</button>
      {error && <p className="k-error">{error}</p>}
      {done && <p className="fc-done">{done}</p>}

      {items && <>
        <h4>{items.length} designs</h4>
        <div className="dz-two">
          <label className="dz-field"><span>Post as</span>
            <select className="k-input" value={format} onChange={(e) => setFormat(e.target.value)}><option value="image">Images</option><option value="video">Reels with music (the Music tab’s track)</option></select>
          </label>
          <label className="dz-field"><span>Starting</span><input className="k-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        </div>
        <div className="dz-field"><span>Times each day (Eastern)</span>
          <span className="dz-inline">
            {times.map((t, i) => <span key={i} className="dz-time"><input className="k-input" type="time" value={t} onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))} />{times.length > 1 && <button type="button" className="ds-icon-btn" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} aria-label="Remove this time"><X size={13} /></button>}</span>)}
            {times.length < 3 && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setTimes((ts) => [...ts, '15:00'])}>Add a time</button>}
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={build}>Apply</button>
          </span>
        </div>
        <div className="dz-inline">
          {['instagram', 'facebook'].map((p) => <label key={p} className="dz-check"><input type="checkbox" checked={platforms.includes(p)} onChange={(e) => setPlatforms((ps) => (e.target.checked ? [...ps, p] : ps.filter((x) => x !== p)))} /> {p === 'instagram' ? 'Instagram' : 'Facebook'}</label>)}
        </div>
        <div className="dz-inline">
          <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={writeCaptions} disabled={!!busy}><Sparkles size={14} /> Write captions with AI</button>
          <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={saveAll} disabled={!!busy}><Save size={14} /> Save all</button>
          <button type="button" className="k-btn k-btn--gold k-btn--sm" onClick={scheduleAll} disabled={!!busy}><CalendarClock size={14} /> Schedule all</button>
        </div>
        {progress && <p className="dz-progress"><Loader2 size={14} className="dz-spin" /> {progress.label}: {progress.done + 1} of {progress.total}<span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></p>}
        <ul className="dz-batchlist">
          {items.map((it, i) => (
            <li key={it.key}>
              <Thumb doc={it.doc} width={120} />
              <div>
                <input className="k-input" type="datetime-local" value={it.when} onChange={(e) => update(i, { when: e.target.value })} aria-label="When it posts" />
                <textarea className="k-input dz-textarea" rows={4} value={it.caption} onChange={(e) => update(i, { caption: e.target.value })} aria-label="Caption" />
              </div>
              <button type="button" className="ds-icon-btn" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Leave this one out"><X size={14} /></button>
            </li>
          ))}
        </ul>
        <p className="ds-muted dz-small"><Wand2 size={13} /> Open any of them in the editor from Saved after Save all, to fine-tune one by hand.</p>
      </>}
    </div>
  );
};

export default Batch;
