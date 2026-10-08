import React, { useState } from 'react';
import { HandCoins, Gift, TrendingUp, HandHeart, Heart, CheckCircle2, Mail, Phone, ArrowUpRight, ArrowDown, ArrowRight, CalendarDays } from 'lucide-react';
import { openCalendly } from '../lib/calendly';
import { supabase } from '../lib/supabase';
import PageHeader from '../components/PageHeader';
import LazyVideo from '../components/LazyVideo';

import heroImg from '../assets/web/p31_partner_hero_editorial.webp';
import groupImg from '../assets/web/p31_community_impact_editorial_1776544076592.webp';
import visionaryVid from '../assets/web/visionary.mp4';
import visionaryPoster from '../assets/web/visionary-poster.webp';

const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y';

const WAYS = [
  { Icon: HandCoins, title: 'Financial giving', tone: 'night', body: 'Your contribution helps us host markets, expand resources and sustain the vision.', cta: 'Give now', href: DONATE_URL },
  { Icon: Gift, title: 'In-kind giving', tone: 'gold', body: 'Event space, tables and tents, artisan products, or services like photography and marketing.', cta: 'Offer resources', type: 'In-Kind' },
  { Icon: TrendingUp, title: 'Strategic partnership', body: 'Businesses and organizations collaborating at scale to expand our reach and impact.', cta: 'Collaborate', type: 'Strategic' },
  { Icon: HandHeart, title: 'Volunteer', body: 'Serve at a market — welcome guests, support curators, help the day run beautifully.', cta: 'Volunteer', type: 'Volunteer' },
];
const TYPES = [['Financial', 'Financial'], ['In-Kind', 'In-kind'], ['Strategic', 'Strategic'], ['Volunteer', 'Volunteer']];
const blankForm = { full_name: '', email: '', phone: '', partnership_type: 'Strategic', message: '', trap: '' };

const Partner = () => {
  const [form, setForm] = useState(blankForm);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [errMsg, setErrMsg] = useState('');

  const choose = (type) => {
    setForm((f) => ({ ...f, partnership_type: type }));
    document.getElementById('partner-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    const { error } = await supabase.rpc('submit_partnership', {
      p_name: form.full_name, p_email: form.email, p_phone: form.phone,
      p_type: form.partnership_type, p_message: form.message, p_trap: form.trap,
    });
    if (error) { setErrMsg(error.message); return setState('error'); }
    setForm(blankForm);
    setState('done');
  };

  return (
    <div className="k-page">
      <PageHeader
        eyebrow="A Holy Movement"
        title="Partner with"
        accent="the movement"
        lead="More than an event — a space where women build, heal and walk boldly in what God has entrusted to them. Stand with us."
        media={{ src: heroImg, alt: 'A Proverbs 31 curator in an editorial portrait' }}
        actions={<>
          <a href="#ways" className="k-btn k-btn--gold">Ways to give <ArrowDown size={18} /></a>
          <a href="#partner-form" className="k-btn k-btn--light">Get in touch</a>
        </>}
      />

      {/* Why */}
      <section className="k-section">
        <div className="k-split k-split--wide-left">
          <div className="k-head" style={{ marginBottom: 0 }}>
            <p className="k-eyebrow" data-reveal="fade">Impact</p>
            <h2 className="k-h2" data-split>Why partnership <em>matters</em></h2>
            <p className="k-lede" data-reveal>Every vision needs people willing to stand behind it. Your partnership helps us:</p>
            <ul className="k-checks" data-reveal-group>
              <li><CheckCircle2 size={20} /> Give small businesses room to grow</li>
              <li><CheckCircle2 size={20} /> Create safe, impactful spaces for community</li>
              <li><CheckCircle2 size={20} /> Support women breaking cycles and building legacy</li>
              <li><CheckCircle2 size={20} /> Reach more people through marketplace experiences</li>
            </ul>
          </div>
          <div className="k-arch k-arch--ring" data-reveal="clip">
            <img src={groupImg} alt="Women gathering at a Proverbs 31 market" loading="lazy" decoding="async" data-parallax="7" style={{ height: '116%', top: '-8%' }} />
          </div>
        </div>
      </section>

      <section className="k-section k-section--night k-dark k-section--tight">
        <figure className="k-quote k-center" style={{ maxWidth: 940 }}>
          <blockquote data-scrub>“What you give becomes a seed into something far greater than a single event.”</blockquote>
        </figure>
      </section>

      {/* Ways */}
      <section className="k-section k-section--mist" id="ways">
        <div className="k-head">
          <p className="k-eyebrow" data-reveal="fade">Engagement</p>
          <h2 className="k-h2" data-split>Ways to <em>invest</em></h2>
          <p className="k-lede" data-reveal>Every form of giving carries weight. Choose the path that aligns with your calling.</p>
        </div>
        <div className="k-grid k-grid--2" data-reveal-group>
          {WAYS.map((w, i) => (
            <article key={w.title} className={`k-card ${w.tone ? `k-card--${w.tone}` : ''}`}>
              <span className="k-num">0{i + 1}</span>
              <span className="k-icon"><w.Icon size={22} /></span>
              <h3>{w.title}</h3>
              <p>{w.body}</p>
              {w.href ? (
                <a href={w.href} target="_blank" rel="noreferrer" className={`k-btn k-btn--sm ${w.tone === 'night' ? 'k-btn--gold' : 'k-btn--plum'}`} style={{ justifySelf: 'start', marginTop: 8 }}>
                  {w.cta} <ArrowUpRight size={16} />
                </a>
              ) : (
                <button onClick={() => choose(w.type)} className={`k-btn k-btn--sm ${w.tone === 'gold' ? 'k-btn--plum' : 'k-btn--outline'}`} style={{ justifySelf: 'start', marginTop: 8 }}>
                  {w.cta} <ArrowRight size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
        <article className="k-tile" style={{ minHeight: 300, marginTop: 'clamp(14px, 1.6vw, 22px)' }} data-reveal="clip">
          <LazyVideo src={visionaryVid} poster={visionaryPoster} />
          <div className="k-tile__copy" style={{ maxWidth: 620 }}>
            <span className="k-chip"><Heart size={12} /> The heart behind your giving</span>
            <h3>Seen or unseen, every gift matters.</h3>
            <p>It is alignment with a vision committed to uplifting women and strengthening communities.</p>
          </div>
        </article>
      </section>

      {/* Form */}
      <section className="k-section" id="partner-form">
        <div className="k-split" style={{ alignItems: 'start' }}>
          <div className="k-head" style={{ marginBottom: 0 }}>
            <p className="k-eyebrow" data-reveal="fade">Take the next step</p>
            <h2 className="k-h2" data-split>Align with the <em>movement</em></h2>
            <p className="k-lede" data-reveal>If you feel led to partner with Proverbs 31 Marketplace, we invite you to connect.</p>
            <div className="k-contact" data-reveal-group>
              <a href="mailto:proverbs31markets@gmail.com"><Mail size={18} /> proverbs31markets@gmail.com</a>
              <a href="tel:14705622852"><Phone size={18} /> 1 (470) 562-2852</a>
            </div>
            <div className="k-actions" data-reveal>
              <button type="button" className="k-btn k-btn--plum" onClick={() => openCalendly('connect', { source: 'partner-page' })}><CalendarDays size={18} /> Book a 30-min connect call</button>
            </div>
          </div>

          <div className="k-card" style={{ padding: 'clamp(22px, 4vw, 40px)' }} data-reveal>
            {state === 'done' ? (
              <div className="k-success">
                <span className="k-icon"><CheckCircle2 size={28} /></span>
                <h3>Thank you</h3>
                <p>Your message reached the P31 team — we’ll be in touch soon.</p>
                <button className="k-btn k-btn--ghost" onClick={() => setState('idle')}>Send another</button>
              </div>
            ) : (
              <form className="k-form" onSubmit={submit}>
                <div className="k-field">
                  <span>I’d like to help with</span>
                  <div className="k-segs" role="group" aria-label="Partnership type">
                    {TYPES.map(([v, label]) => (
                      <button type="button" key={v} aria-pressed={form.partnership_type === v} onClick={() => setForm({ ...form, partnership_type: v })}>{label}</button>
                    ))}
                  </div>
                </div>
                <label className="k-field"><span>Full name</span>
                  <input required autoComplete="name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </label>
                <div className="k-row">
                  <label className="k-field"><span>Email</span>
                    <input required type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <label className="k-field"><span>Phone (optional)</span>
                    <input type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                </div>
                <label className="k-field"><span>Message</span>
                  <textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How would you like to partner with us?" />
                </label>
                <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.trap} onChange={(e) => setForm({ ...form, trap: e.target.value })} />
                {state === 'error' && <p className="k-error" role="alert">{errMsg || 'Something went wrong — please try again or email us.'}</p>}
                <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Sending…' : <>Send to the P31 team <ArrowRight size={18} /></>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Partner;
