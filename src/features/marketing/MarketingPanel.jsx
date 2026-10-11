import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Megaphone, Link2, Copy, Check, Download, Share2, Sparkles, Loader2, Mail, Users, QrCode, BarChart3, Send,
  Trash2, Image as ImageIcon, Instagram, Tag, Pencil, Eye, ShoppingBag, FileText, AlertCircle, Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SITE_URL } from '../../lib/seo';
import { PROMO_LOOKS, PROMO_SIZES, drawPromo, drawSign, loadImage, downloadCanvas } from './promoCard';
import './Marketing.css';

const money = (n) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
const slugOf = (c) => c?.slug || c?.id || '';
const shopUrl = (c) => `${SITE_URL}/${slugOf(c)}`;
const productUrl = (c, p) => `${shopUrl(c)}?p=${p.id}`;

// Copy to the clipboard and remember which button did it for a moment.
const useCopy = () => {
  const [copied, setCopied] = useState(null);
  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); } catch { /* no clipboard */ }
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };
  return [copied, copy];
};

// Ask the writing helper; `imageUrl` lets it look at the product photo.
async function askAi(task, input, imageUrl) {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body: { task, input, ...(imageUrl ? { imageUrl } : {}) } });
  if (error) {
    let msg = 'The writing helper is not available right now.';
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data?.options || [];
}
const parseJson = (text) => {
  const clean = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(clean.slice(clean.search(/[[{]/)));
};

// A QR drawn off-screen so the canvases can copy it.
const HiddenQr = ({ value, holder }) => (
  <div ref={holder} className="mk-hidden" aria-hidden="true"><QRCodeCanvas value={value} size={512} level="H" includeMargin={false} /></div>
);
const qrOf = (holder) => holder.current?.querySelector('canvas') || null;

const CopyBtn = ({ text, k, copied, copy, label = 'Copy' }) => (
  <button type="button" className="mk-chip" onClick={() => copy(text, k)}>{copied === k ? <><Check size={14} /> Copied</> : <><Copy size={14} /> {label}</>}</button>
);

/* ───────────────────────── Promote a product ───────────────────────── */
const Promote = ({ curator, products, onEditProduct }) => {
  const live = useMemo(() => products.filter((p) => p.is_active !== false), [products]);
  const [pid, setPid] = useState(live[0]?.id ?? null);
  const p = live.find((x) => x.id === pid) || live[0] || null;
  const [look, setLook] = useState('clean');
  const [size, setSize] = useState('square');
  const [headline, setHeadline] = useState('');
  const [showQr, setShowQr] = useState(true);
  const [imgs, setImgs] = useState({ product: null, logo: null, key: '' });
  const [kit, setKit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [angle, setAngle] = useState('');
  const canvasRef = useRef(null);
  const qrHolder = useRef(null);
  const [copied, copy] = useCopy();
  const link = p ? productUrl(curator, p) : shopUrl(curator);

  useEffect(() => {
    if (!p) return;
    const key = `${p.image_url || ''}|${curator?.logo_url || ''}`;
    let alive = true;
    Promise.all([loadImage(p.image_url), loadImage(curator?.logo_url)]).then(([product, logo]) => {
      if (alive) setImgs({ product, logo, key });
    });
    return () => { alive = false; };
  }, [p, curator?.logo_url]);

  useEffect(() => {
    if (!p || !canvasRef.current) return undefined;
    const id = requestAnimationFrame(() => {
      drawPromo(canvasRef.current, { product: p, shop: curator, look, size, headline, productImg: imgs.product, logoImg: imgs.logo, qrCanvas: qrOf(qrHolder), showQr });
    });
    return () => cancelAnimationFrame(id);
  }, [p, curator, look, size, headline, imgs, showQr, link]);

  const generate = async () => {
    if (!p) return;
    setBusy(true); setErr(''); setKit(null);
    try {
      const [first] = await askAi('product_promo', {
        shop: curator?.business_name, name: p.name, price: p.price, compare_at: p.compare_at_price || '', category: p.category,
        description: p.description || '', tags: (p.tags || []).join(', '), angle,
      }, p.image_url?.startsWith('https://') ? p.image_url : undefined);
      const j = parseJson(first);
      setKit({
        hooks: (j.hooks || []).map(String).slice(0, 3),
        captions: (j.captions || []).map(String).slice(0, 3),
        story: String(j.story || ''),
        hashtags: (j.hashtags || []).map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 6),
        emailSubject: String(j.email_subject || ''), emailBody: String(j.email_body || ''),
        sms: String(j.sms || ''), bestTime: String(j.best_time || ''),
      });
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: `${p.name} · ${money(p.price)} at ${curator.business_name}`, url: link });
      else copy(link, 'share');
    } catch { /* closed */ }
  };

  if (!live.length) {
    return (
      <div className="mk-empty">
        <ShoppingBag size={28} />
        <h3>Add a product first</h3>
        <p>Marketing starts with something to sell. Add your first product in the Storefront tab, then come back here for its link, promo images and captions.</p>
      </div>
    );
  }

  const tags = kit ? kit.hashtags.join(' ') : '';

  return (
    <div className="mk-grid">
      <HiddenQr value={link} holder={qrHolder} />

      <section className="mk-card mk-span">
        <h3><Tag size={16} /> Which product?</h3>
        <div className="mk-products" role="tablist">
          {live.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === p.id} className={`mk-product ${x.id === p.id ? 'is-on' : ''}`} onClick={() => { setPid(x.id); setKit(null); setHeadline(''); }}>
              {x.image_url ? <img src={x.image_url} alt="" /> : <span className="mk-product__ph"><ImageIcon size={16} /></span>}
              <span>{x.name}</span>
              <small>{money(x.price)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="mk-card">
        <h3><Link2 size={16} /> The link</h3>
        <p className="mk-note">Opens your shop with <b>{p.name}</b> already showing. Put it in a story, a bio, a text, anywhere.</p>
        <div className="mk-link"><code>{link.replace('https://', '')}</code></div>
        <div className="mk-row">
          <CopyBtn text={link} k="link" copied={copied} copy={copy} label="Copy link" />
          <button type="button" className="mk-chip" onClick={share}><Share2 size={14} /> Share</button>
          <button type="button" className="mk-chip" onClick={() => { const q = qrOf(qrHolder); if (q) downloadCanvas(q, `${slugOf(curator)}-${p.id}-qr.png`); }}><QrCode size={14} /> QR code</button>
          <a className="mk-chip" href={link} target="_blank" rel="noreferrer"><Eye size={14} /> Preview</a>
          {onEditProduct && <button type="button" className="mk-chip" onClick={() => onEditProduct(p)}><Pencil size={14} /> Edit product</button>}
        </div>
        <div className="mk-facts">
          {p.badge && <span>{p.badge}</span>}
          {Number(p.compare_at_price) > Number(p.price) && <span>Sale · was {money(p.compare_at_price)}</span>}
          {p.sale_ends_at && new Date(p.sale_ends_at) > new Date() && <span><Clock size={12} /> Sale ends {new Date(p.sale_ends_at).toLocaleDateString()}</span>}
          {p.is_featured && <span>Featured</span>}
          {p.inventory != null && <span>{p.inventory} in stock</span>}
        </div>
      </section>

      <section className="mk-card mk-card--promo">
        <h3><ImageIcon size={16} /> Promo image</h3>
        <div className="mk-promo">
          <div className="mk-promo__preview">
            <canvas ref={canvasRef} className={`mk-canvas mk-canvas--${size}`} aria-label="Promo image preview" />
          </div>
          <div className="mk-promo__controls">
            <label className="mk-label">Look</label>
            <div className="mk-seg">
              {PROMO_LOOKS.map((l) => <button key={l.id} type="button" className={look === l.id ? 'is-on' : ''} onClick={() => setLook(l.id)} title={l.blurb}><i style={{ background: l.bg, borderColor: l.accent }} />{l.name}</button>)}
            </div>
            <label className="mk-label">Size</label>
            <div className="mk-seg">
              {PROMO_SIZES.map((s) => <button key={s.id} type="button" className={size === s.id ? 'is-on' : ''} onClick={() => setSize(s.id)}>{s.name}</button>)}
            </div>
            <label className="mk-label" htmlFor="mk-headline">Ribbon</label>
            <input id="mk-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={p.badge || 'New arrival, 20% off this week, Market exclusive…'} maxLength={28} />
            <label className="mk-toggle"><input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} /> Add a scan-to-shop QR</label>
            <button type="button" className="mk-btn mk-btn--gold" onClick={() => downloadCanvas(canvasRef.current, `${slugOf(curator)}-${p.id}-${look}-${size}.png`)}><Download size={16} /> Download PNG</button>
            <p className="mk-note">Use it as a post, a story or a flyer. Change the ribbon to match the caption.</p>
          </div>
        </div>
      </section>

      <section className="mk-card mk-span">
        <div className="mk-head">
          <h3><Sparkles size={16} /> Captions, hashtags, email &amp; text</h3>
          <div className="mk-row">
            <input className="mk-angle" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Angle (optional): Mother’s Day gift, restock, behind the scenes…" />
            <button type="button" className="mk-btn mk-btn--plum" onClick={generate} disabled={busy}>{busy ? <Loader2 size={16} className="mk-spin" /> : <Sparkles size={16} />} {kit ? 'Write it again' : 'Write the kit'}</button>
          </div>
        </div>
        {err && <p className="mk-err"><AlertCircle size={14} /> {err}</p>}
        {!kit && !busy && <p className="mk-note">One tap writes three captions, hook lines, a story line, hashtags, an email to your followers and a text message, all about this product and in your voice. You pick, edit and post.</p>}
        {kit && (
          <div className="mk-kit">
            <div className="mk-kit__col">
              <h4>Hook lines <small>on the video or image</small></h4>
              {kit.hooks.map((h, i) => <div className="mk-opt" key={i}><p>{h}</p><CopyBtn text={h} k={`h${i}`} copied={copied} copy={copy} /></div>)}
              <h4>Story line</h4>
              <div className="mk-opt"><p>{kit.story}</p><CopyBtn text={kit.story} k="story" copied={copied} copy={copy} /></div>
              <h4>Hashtags</h4>
              <div className="mk-opt"><p>{tags}</p><CopyBtn text={tags} k="tags" copied={copied} copy={copy} /></div>
              <h4>Text message</h4>
              <div className="mk-opt"><p>{kit.sms} {link}</p><CopyBtn text={`${kit.sms} ${link}`} k="sms" copied={copied} copy={copy} /></div>
              {kit.bestTime && <p className="mk-note"><Clock size={13} /> {kit.bestTime}</p>}
            </div>
            <div className="mk-kit__col">
              <h4>Captions <small>Instagram &amp; Facebook</small></h4>
              {kit.captions.map((c, i) => <div className="mk-opt" key={i}><p>{c}</p><CopyBtn text={`${c}\n\n${tags}`} k={`c${i}`} copied={copied} copy={copy} label="Copy + tags" /></div>)}
              <h4>Email to your followers</h4>
              <div className="mk-opt"><p><b>{kit.emailSubject}</b><br />{kit.emailBody}</p>
                <CopyBtn text={`${kit.emailSubject}\n\n${kit.emailBody}`} k="em" copied={copied} copy={copy} />
              </div>
              <p className="mk-note">Send it from the <b>Followers</b> tab: paste the subject and body, pick this product, press Send.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

/* ───────────────────────── Followers + emails ───────────────────────── */
const blankMail = { subject: '', body: '', product_id: '' };

const Followers = ({ curator, products, user }) => {
  const [subs, setSubs] = useState([]);
  const [mails, setMails] = useState([]);
  const [form, setForm] = useState(blankMail);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [draftId, setDraftId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from('shop_subscribers').select('id, email, name, source, unsubscribed, created_at').eq('curator_id', user.id).order('created_at', { ascending: false }).limit(1000),
      supabase.from('shop_campaigns').select('*').eq('curator_id', user.id).order('created_at', { ascending: false }).limit(50),
    ]);
    setSubs(s || []); setMails(m || []);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const active = subs.filter((s) => !s.unsubscribed);
  const sentToday = mails.some((m) => m.status === 'sent' && m.sent_at && Date.now() - new Date(m.sent_at) < 86400000);

  const writeIt = async () => {
    setBusy('ai'); setErr('');
    try {
      const prod = products.find((p) => String(p.id) === String(form.product_id));
      const [first] = await askAi('shop_email', { shop: curator?.business_name, goal: goal || 'share what is new', product: prod ? `${prod.name} (${money(prod.price)})` : '', details: form.body, maker: '' });
      const [subject, ...rest] = String(first).split('\n');
      setForm((f) => ({ ...f, subject: subject.trim(), body: rest.join('\n').trim() }));
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const saveDraft = async () => {
    if (!form.subject.trim() || form.body.trim().length < 10) { setErr('Give it a subject and a few lines.'); return null; }
    setErr('');
    const row = { curator_id: user.id, subject: form.subject.trim(), body: form.body.trim(), product_id: form.product_id ? Number(form.product_id) : null };
    const q = draftId ? supabase.from('shop_campaigns').update(row).eq('id', draftId).select().single() : supabase.from('shop_campaigns').insert(row).select().single();
    const { data, error } = await q;
    if (error) { setErr(error.message); return null; }
    setDraftId(data.id);
    return data.id;
  };

  const send = async (test) => {
    if (!test && !window.confirm(`Send this to ${active.length} follower${active.length === 1 ? '' : 's'} now? You can send one email a day.`)) return;
    setBusy(test ? 'test' : 'send'); setMsg(''); setErr('');
    try {
      const id = await saveDraft();
      if (!id) return;
      const { data, error } = await supabase.functions.invoke('shop-broadcast', { body: { campaign_id: id, test } });
      if (error) {
        let m = 'The email service is not reachable right now.';
        try { const ctx = await error.context?.json?.(); if (ctx?.error) m = ctx.error; } catch { /* keep */ }
        throw new Error(m);
      }
      if (data?.error) throw new Error(data.error);
      setMsg(test ? 'Test sent to your sign-in email.' : `Sent to ${data.sent} follower${data.sent === 1 ? '' : 's'}.`);
      if (!test) { setForm(blankMail); setDraftId(null); setGoal(''); }
      load();
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  };

  const exportCsv = () => {
    const rows = [['email', 'name', 'source', 'followed_on'], ...active.map((s) => [s.email, s.name || '', s.source || '', s.created_at.slice(0, 10)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${slugOf(curator)}-followers.csv`;
    a.click();
  };

  const remove = async (s) => {
    if (!window.confirm(`Remove ${s.email} from your followers?`)) return;
    await supabase.from('shop_subscribers').delete().eq('id', s.id);
    load();
  };

  return (
    <div className="mk-grid">
      <section className="mk-card">
        <div className="mk-head">
          <h3><Users size={16} /> {active.length} follower{active.length === 1 ? '' : 's'}</h3>
          {active.length > 0 && <button type="button" className="mk-chip" onClick={exportCsv}><Download size={14} /> CSV</button>}
        </div>
        <p className="mk-note">Shoppers leave their email at the bottom of your storefront (“Get updates from this shop”). They can leave with one tap, so write to them like friends.</p>
        {active.length === 0 ? (
          <div className="mk-empty mk-empty--inline"><Mail size={22} /><p>No followers yet. Share your shop link and the follow box does the rest.</p></div>
        ) : (
          <ul className="mk-list">
            {active.slice(0, 200).map((s) => (
              <li key={s.id}>
                <div><strong>{s.name || s.email}</strong>{s.name && <small>{s.email}</small>}</div>
                <small>{new Date(s.created_at).toLocaleDateString()}</small>
                <button type="button" className="mk-icon" onClick={() => remove(s)} aria-label="Remove"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mk-card">
        <h3><Send size={16} /> Email your followers</h3>
        <div className="mk-form">
          <label>What is this email about?
            <div className="mk-row">
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="New candle scents, 20% off this weekend, see us at the Winter Gala…" />
              <button type="button" className="mk-btn mk-btn--plum" onClick={writeIt} disabled={busy === 'ai'}>{busy === 'ai' ? <Loader2 size={16} className="mk-spin" /> : <Sparkles size={16} />} Write it</button>
            </div>
          </label>
          <label>Subject<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={90} /></label>
          <label>Message<textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Blank line between paragraphs. **bold** works." /></label>
          <label>Feature a product (optional)
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">None</option>
              {products.filter((p) => p.is_active !== false).map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.price)}</option>)}
            </select>
          </label>
          {err && <p className="mk-err"><AlertCircle size={14} /> {err}</p>}
          {msg && <p className="mk-ok"><Check size={14} /> {msg}</p>}
          <div className="mk-row">
            <button type="button" className="mk-chip" onClick={() => send(true)} disabled={!!busy}>{busy === 'test' ? <Loader2 size={14} className="mk-spin" /> : <Mail size={14} />} Send me a test</button>
            <button type="button" className="mk-btn mk-btn--gold" onClick={() => send(false)} disabled={!!busy || !active.length || sentToday}>
              {busy === 'send' ? <Loader2 size={16} className="mk-spin" /> : <Send size={16} />} Send to {active.length} follower{active.length === 1 ? '' : 's'}
            </button>
          </div>
          <p className="mk-note">{sentToday ? 'You emailed your followers today; the next send opens tomorrow.' : 'Sent from Proverbs 31 Marketplace with your shop name; replies come to your public email. One send a day.'}</p>
        </div>
      </section>

      {mails.length > 0 && (
        <section className="mk-card mk-span">
          <h3><FileText size={16} /> Sent &amp; drafts</h3>
          <ul className="mk-list">
            {mails.map((m) => (
              <li key={m.id}>
                <div><strong>{m.subject}</strong><small>{m.status === 'sent' ? `Sent to ${m.sent_count} · ${new Date(m.sent_at).toLocaleDateString()}` : m.status === 'failed' ? `Failed · ${m.error || ''}` : 'Draft'}</small></div>
                {m.status !== 'sent' && <button type="button" className="mk-chip" onClick={() => { setForm({ subject: m.subject, body: m.body, product_id: m.product_id || '' }); setDraftId(m.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Pencil size={14} /> Open</button>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

/* ───────────────────────── Share kit ───────────────────────── */
const ShareKit = ({ curator }) => {
  const [copied, copy] = useCopy();
  const qrHolder = useRef(null);
  const [signLine, setSignLine] = useState('Scan to shop & follow');
  const url = shopUrl(curator);
  const name = curator?.business_name || 'My shop';
  const short = url.replace('https://www.', '');
  const bio = `${curator?.tagline ? `${curator.tagline} · ` : ''}Shop ${short}`;
  const blurbs = [
    `Find ${name} on Proverbs 31 Marketplace: ${short}`,
    `New pieces are up! Shop ${name} online at ${short} and follow the shop for first dibs on drops.`,
    `We’re part of the Proverbs 31 Marketplace, a curated market of women-owned brands. Shop ${name}: ${short}`,
    `Loved it at the market? You can shop ${name} anytime at ${short}`,
  ];

  const downloadSign = async () => {
    const c = document.createElement('canvas');
    drawSign(c, { shop: curator, qrCanvas: qrOf(qrHolder), logoImg: await loadImage(curator?.logo_url), line: signLine });
    downloadCanvas(c, `${slugOf(curator)}-table-sign.png`);
  };

  return (
    <div className="mk-grid">
      <HiddenQr value={url} holder={qrHolder} />
      <section className="mk-card">
        <h3><Link2 size={16} /> Your shop link</h3>
        <div className="mk-link"><code>{short}</code></div>
        <div className="mk-row">
          <CopyBtn text={url} k="url" copied={copied} copy={copy} label="Copy link" />
          <button type="button" className="mk-chip" onClick={() => { const q = qrOf(qrHolder); if (q) downloadCanvas(q, `${slugOf(curator)}-qr.png`); }}><QrCode size={14} /> QR code</button>
          <a className="mk-chip" href={url} target="_blank" rel="noreferrer"><Eye size={14} /> Open</a>
        </div>
        <h4 className="mk-h4"><Instagram size={14} /> Bio line</h4>
        <div className="mk-opt"><p>{bio}</p><CopyBtn text={bio} k="bio" copied={copied} copy={copy} /></div>
        <p className="mk-note">Paste it in your Instagram, Facebook and TikTok bios so every post can say “link in bio”.</p>
      </section>

      <section className="mk-card">
        <h3><QrCode size={16} /> Table sign for the market</h3>
        <p className="mk-note">A 5×7 sign with your name, the QR and your link. Print it at home or any pharmacy photo counter and set it on your booth.</p>
        <label className="mk-label" htmlFor="mk-signline">Line under your name</label>
        <input id="mk-signline" value={signLine} onChange={(e) => setSignLine(e.target.value)} maxLength={34} />
        <div className="mk-row"><button type="button" className="mk-btn mk-btn--gold" onClick={downloadSign}><Download size={16} /> Download sign (PNG)</button></div>
      </section>

      <section className="mk-card mk-span">
        <h3><Megaphone size={16} /> Ready-to-post lines</h3>
        <div className="mk-kit">
          <div className="mk-kit__col">{blurbs.slice(0, 2).map((b, i) => <div className="mk-opt" key={i}><p>{b}</p><CopyBtn text={b} k={`b${i}`} copied={copied} copy={copy} /></div>)}</div>
          <div className="mk-kit__col">{blurbs.slice(2).map((b, i) => <div className="mk-opt" key={i}><p>{b}</p><CopyBtn text={b} k={`b${i + 2}`} copied={copied} copy={copy} /></div>)}</div>
        </div>
      </section>
    </div>
  );
};

/* ───────────────────────── Insights ───────────────────────── */
const Insights = ({ products }) => {
  const [rows, setRows] = useState(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    let alive = true;
    supabase.rpc('my_product_stats', { p_days: days }).then(({ data }) => { if (alive) setRows(data || []); });
    return () => { alive = false; };
  }, [days]);
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [String(p.id), p])), [products]);
  const list = (rows || []).map((r) => ({ ...r, product: byId[String(r.product_id)] })).filter((r) => r.product);
  const opens = list.reduce((s, r) => s + Number(r.opens), 0);
  const buys = list.reduce((s, r) => s + Number(r.buys), 0);
  const shares = list.reduce((s, r) => s + Number(r.shares), 0);
  const quiet = products.filter((p) => p.is_active !== false && !list.some((r) => r.product_id === p.id));

  return (
    <div className="mk-grid">
      <section className="mk-card mk-span">
        <div className="mk-head">
          <h3><BarChart3 size={16} /> What’s working</h3>
          <div className="mk-seg">{[7, 30, 90].map((d) => <button key={d} type="button" className={days === d ? 'is-on' : ''} onClick={() => setDays(d)}>{d} days</button>)}</div>
        </div>
        <div className="mk-stats">
          <div><span>{opens}</span><small>product opens</small></div>
          <div><span>{buys}</span><small>buy taps</small></div>
          <div><span>{shares}</span><small>shares</small></div>
          <div><span>{opens ? `${Math.round((buys / opens) * 100)}%` : '—'}</span><small>open → buy</small></div>
        </div>
        {rows === null ? <p className="mk-note">Loading…</p> : list.length === 0 ? (
          <div className="mk-empty mk-empty--inline"><Eye size={22} /><p>No product views in this window yet. Share a product link from the Promote tab and the numbers start here.</p></div>
        ) : (
          <table className="mk-table">
            <thead><tr><th>Product</th><th>Opens</th><th>Buy taps</th><th>Shares</th><th>Open → buy</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.product_id}>
                  <td><div className="mk-tp">{r.product.image_url ? <img src={r.product.image_url} alt="" /> : <span />}<span>{r.product.name}</span></div></td>
                  <td>{r.opens}</td><td>{r.buys}</td><td>{r.shares}</td>
                  <td>{Number(r.opens) ? `${Math.round((Number(r.buys) / Number(r.opens)) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {quiet.length > 0 && list.length > 0 && (
          <p className="mk-note"><Megaphone size={13} /> Quiet lately: {quiet.slice(0, 4).map((p) => p.name).join(', ')}{quiet.length > 4 ? ` and ${quiet.length - 4} more` : ''}. A promo image and a story link is the fastest way to wake one up.</p>
        )}
      </section>
      <section className="mk-card mk-span mk-tips">
        <h3><Sparkles size={16} /> What moves product on P31</h3>
        <ul>
          <li><b>Post the product, not the logo.</b> A clear photo on a plain background opens 2–3× more than a flat lay with ten things in it. The Photo Studio removes the background in one tap.</li>
          <li><b>Lead with the hook.</b> The first line of a caption and the first 2 seconds of a reel decide everything. Say the feeling or the use, never “introducing”.</li>
          <li><b>One link, everywhere.</b> Your product link opens the item directly. Put it in stories with the link sticker, in the bio, in texts to past customers.</li>
          <li><b>Badges and timers work.</b> “Limited”, “Back in stock” and a sale that ends Sunday give people a reason to act today. Set them on the product.</li>
          <li><b>Email beats the algorithm.</b> Everyone who follows your shop sees your email; a fraction see a post. One warm email a week before a market fills a booth.</li>
          <li><b>Post when they’re scrolling.</b> For handmade and gifts, evenings 7–9pm and Sunday afternoons do best; the Studio planner can schedule for you.</li>
        </ul>
      </section>
    </div>
  );
};

/* ───────────────────────── Panel ───────────────────────── */
const TABS = [
  ['promote', 'Promote a product', Megaphone],
  ['followers', 'Followers & email', Mail],
  ['kit', 'Share kit', QrCode],
  ['insights', 'Insights', BarChart3],
];

/** Vendor marketing: product links, promo images, AI captions, the shop's own email list, a share kit and product insights. */
const MarketingPanel = ({ curator, products = [], user, onEditProduct }) => {
  const [tab, setTab] = useState('promote');
  return (
    <div className="dashboard-view mk">
      <header className="dashboard-header">
        <div>
          <span className="section-kicker">Marketing</span>
          <h1 className="font-headline">Get your products seen</h1>
          <p className="text-muted">Links, promo images, captions, your own email list and the numbers, for every product you sell.</p>
        </div>
      </header>
      <div className="mk-tabs" role="tablist">
        {TABS.map((t) => {
          const Icon = t[2];
          return <button key={t[0]} role="tab" aria-selected={tab === t[0]} className={tab === t[0] ? 'is-on' : ''} onClick={() => setTab(t[0])}><Icon size={16} /> {t[1]}</button>;
        })}
      </div>
      {tab === 'promote' && <Promote curator={curator} products={products} onEditProduct={onEditProduct} />}
      {tab === 'followers' && <Followers curator={curator} products={products} user={user} />}
      {tab === 'kit' && <ShareKit curator={curator} />}
      {tab === 'insights' && <Insights products={products} />}
    </div>
  );
};

export default MarketingPanel;
