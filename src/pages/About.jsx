import React from 'react';
import { Mail, Phone, MapPin, ArrowUpRight, Gem, HeartHandshake, Users, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import FounderNote from '../components/FounderNote';
import { openJoin } from '../lib/join';

import editorialImg from '../assets/web/p31_partner_hero_editorial.webp';
import gatherImg from '../assets/web/p31_community_impact_editorial_1776544076592.webp';

const APPLY_URL = 'https://forms.gle/vmkK7fhgwiYNYEa38';

const VALUES = [
  { Icon: Gem, title: 'Faith meets luxury', body: 'A stage worthy of her craft — where beauty, purpose and excellence are never an afterthought.' },
  { Icon: HeartHandshake, title: 'Hand-selected, always', body: 'Every curator is personally vetted for craft, story and purpose. No pay-to-play, no filler.' },
  { Icon: Users, title: 'Community first', body: 'A movement of visionary women who gather, pray, build and buy from one another.' },
];

const STEPS = [
  ['Apply', 'Tell us about your gift — your craft, your story and what you make.'],
  ['Get curated', 'Our team reviews every application by hand and welcomes the best fit.'],
  ['Open your shop', 'Your storefront, studio tools and orders — all in your P31 dashboard.'],
  ['Gather', 'Meet your customers at our seasonal markets in Atlanta and beyond.'],
];

const About = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Our Story"
      title="Where her gifts"
      accent="make room."
      lead="An elite, traveling collective of women creatives — defying the standard pop-up to bring a majestic, high-end market to Atlanta and beyond."
      media={{ src: gatherImg, alt: 'Women of the Proverbs 31 community gathered together' }}
      actions={<>
        <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--gold">Become a curator <ArrowUpRight size={18} /></a>
        <button type="button" className="k-btn k-btn--light" onClick={openJoin}>Join the collective</button>
      </>}
    />

    {/* Foundation */}
    <section className="k-section">
      <div className="k-split k-split--wide-left">
        <div className="k-head" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Our Foundation</p>
          <h2 className="k-h2" data-split>Rooted in <em>purpose.</em></h2>
          <p className="k-lede" data-reveal>
            We curate spaces where faith and luxury converge. Our mission is to empower women to rise,
            build and elevate their brand presence — every curator hand-selected, representing the
            pinnacle of craftsmanship, beauty and entrepreneurial excellence.
          </p>
          <div className="k-actions" data-reveal>
            <a href="#how" className="k-link">How it works <ArrowRight size={16} /></a>
          </div>
        </div>
        <div className="k-arch k-arch--ring" data-reveal="clip">
          <img src={editorialImg} alt="A Proverbs 31 Marketplace curator" loading="lazy" decoding="async" data-parallax="7" style={{ height: '116%', top: '-8%' }} />
        </div>
      </div>
    </section>

    {/* Scripture */}
    <section className="k-section k-section--night k-dark">
      <figure className="k-quote k-center" style={{ maxWidth: 980 }}>
        <p className="k-eyebrow k-eyebrow--center" style={{ margin: 0 }} data-reveal="fade">The verse we’re built on</p>
        <blockquote data-scrub>“Give her of the fruit of her hands; and let her own works praise her in the gates.”</blockquote>
        <figcaption data-reveal="fade">Proverbs 31:31</figcaption>
      </figure>
    </section>

    {/* Values */}
    <section className="k-section">
      <div className="k-head">
        <p className="k-eyebrow" data-reveal="fade">What we stand for</p>
        <h2 className="k-h2" data-split>A standard, <em>composed</em></h2>
      </div>
      <div className="k-grid k-grid--3" data-reveal-group>
        {VALUES.map((v, i) => (
          <article className={`k-card ${i === 1 ? 'k-card--night' : ''}`} key={v.title}>
            <span className="k-num">0{i + 1}</span>
            <span className="k-icon"><v.Icon size={22} /></span>
            <h3>{v.title}</h3>
            <p>{v.body}</p>
          </article>
        ))}
      </div>
    </section>

    {/* How it works */}
    <section className="k-section k-section--mist" id="how">
      <div className="k-head k-head--row">
        <div style={{ display: 'grid', gap: 16 }}>
          <p className="k-eyebrow" style={{ margin: 0 }} data-reveal="fade">For curators</p>
          <h2 className="k-h2" data-split>From gift to <em>storefront</em></h2>
        </div>
        <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--plum" data-reveal>Start your application <ArrowUpRight size={18} /></a>
      </div>
      <ol className="k-steps" style={{ '--steps': 4 }} data-reveal-group>
        {STEPS.map(([t, b]) => <li key={t}><h3>{t}</h3><p>{b}</p></li>)}
      </ol>
    </section>

    {/* Founder — a small insert; her full story lives on the Collective */}
    <section className="k-section k-section--tight">
      <div style={{ display: 'grid', justifyItems: 'center' }}><FounderNote /></div>
    </section>

    {/* Contact + CTA */}
    <section className="k-section k-section--mist">
      <div className="k-split" style={{ alignItems: 'start' }}>
        <div className="k-head" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Direct inquiries</p>
          <h2 className="k-h2" data-split>Let’s <em>talk</em></h2>
          <p className="k-lede" data-reveal>Questions about markets, curating or partnering — we’d love to hear from you.</p>
        </div>
        <div className="k-contact" data-reveal-group>
          <a href="tel:14705622852"><Phone size={18} /> 1 (470) 562-2852</a>
          <a href="mailto:proverbs31markets@gmail.com"><Mail size={18} /> proverbs31markets@gmail.com</a>
          <div><MapPin size={18} /> Atlanta, GA — touring</div>
        </div>
      </div>
    </section>

    <section className="k-section k-section--tight">
      <div className="k-cta k-dark" data-reveal="scale">
        <img src={gatherImg} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18, zIndex: -2 }} />
        <p className="k-eyebrow">Your seat at the table</p>
        <h2 className="k-h2">Your gifts deserve a <em>stage.</em></h2>
        <p className="k-lede">Apply to curate, or join the collective to hear about the next market first.</p>
        <div className="k-actions">
          <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--gold">Become a curator <ArrowUpRight size={18} /></a>
          <button type="button" className="k-btn k-btn--light" onClick={openJoin}>Join the collective</button>
        </div>
      </div>
    </section>
  </div>
);

export default About;
