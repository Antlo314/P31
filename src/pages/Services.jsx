import React from 'react';
import { Crown, Ruler, GraduationCap, Mail, ArrowUpRight, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LazyVideo from '../components/LazyVideo';
import { openJoin } from '../lib/join';

import curatorVid from '../assets/web/curator.mp4';
import curatorPoster from '../assets/web/curator-poster.webp';
import productVid from '../assets/web/product.mp4';
import productPoster from '../assets/web/product-poster.webp';
import visionaryVid from '../assets/web/visionary.mp4';
import visionaryPoster from '../assets/web/visionary-poster.webp';
import { EMAIL } from '../lib/team';

const INQUIRE = `mailto:${EMAIL.assistantMarket}?subject=Bespoke%20services`;

const SERVICES = [
  {
    Icon: Crown, title: 'Bespoke brand', accent: 'curation', tag: 'Signature',
    body: 'For the established artisan ready to elevate her presence — end-to-end strategic refinement so your gifts make room in the highest circles.',
    points: ['Brand story & positioning', 'Collection and pricing review', 'Storefront styling on P31'],
    video: curatorVid, poster: curatorPoster,
  },
  {
    Icon: Ruler, title: 'Bespoke', accent: 'design',
    body: 'Consultation for physical market spaces and digital storefronts — atmospheres where luxury and purpose converge.',
    points: ['Booth & display design', 'Product photography direction', 'Packaging and print touchpoints'],
    video: productVid, poster: productPoster,
  },
  {
    Icon: GraduationCap, title: 'Curator', accent: 'coaching',
    body: 'One-on-one mentorship for the Proverbs 31 woman of influence — mastering entrepreneurial excellence with purposeful elegance.',
    points: ['Monthly 1:1 sessions', 'Growth & social strategy', 'Market-day readiness'],
    video: visionaryVid, poster: visionaryPoster,
  },
];

const Services = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Bespoke Offerings"
      title="Services &"
      accent="strategic curation"
      lead="Tailored experiences and strategic support for the modern woman of influence. Our full suite is launching soon — reserve a conversation today."
      media={{ src: curatorVid, poster: curatorPoster, video: true }}
      actions={<a href={INQUIRE} className="k-btn k-btn--gold"><Mail size={18} /> Inquire with our concierge</a>}
    />

    <section className="k-section">
      <div style={{ display: 'grid', gap: 'clamp(64px, 9vw, 128px)' }}>
        {SERVICES.map((s, i) => (
          <article className={`k-split ${i % 2 ? 'k-split--wide-left k-split--flip' : 'k-split--wide-right'}`} key={s.title}>
            <div className="k-arch k-arch--ring" data-reveal="clip" style={{ maxWidth: 440, width: '100%' }}>
              <LazyVideo src={s.video} poster={s.poster} />
            </div>
            <div className="k-head" style={{ marginBottom: 0 }}>
              <p className="k-eyebrow" data-reveal="fade">0{i + 1}{s.tag ? ` · ${s.tag}` : ''}</p>
              <h2 className="k-h2" data-split>{s.title} <em>{s.accent}</em></h2>
              <p className="k-lede" data-reveal>{s.body}</p>
              <ul className="k-checks" data-reveal-group>
                {s.points.map((p) => <li key={p}><Check size={18} /> {p}</li>)}
              </ul>
              <div className="k-actions" data-reveal>
                <a href={`${INQUIRE}%20%E2%80%94%20${encodeURIComponent(`${s.title} ${s.accent}`)}`} className="k-link">Ask about {`${s.title} ${s.accent}`.toLowerCase()} <ArrowUpRight size={16} /></a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="k-section k-section--night k-dark">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">How we work together</p>
        <h2 className="k-h2" data-split>A considered <em>process</em></h2>
      </div>
      <ol className="k-steps" data-reveal-group>
        <li><h3>Discovery</h3><p>A conversation about your gift, your goals and where your brand is today.</p></li>
        <li><h3>Strategy</h3><p>A tailored plan — story, presentation, pricing and the channels that fit you.</p></li>
        <li><h3>Elevation</h3><p>Hands-on refinement with check-ins until your brand shows up the way it should.</p></li>
      </ol>
    </section>

    <section className="k-section">
      <figure className="k-quote k-center" style={{ maxWidth: 900 }}>
        <blockquote data-scrub>Where entrepreneurial excellence and purposeful elegance converge.</blockquote>
        <figcaption data-reveal="fade">The P31 standard</figcaption>
      </figure>
    </section>

    <section className="k-section k-section--tight">
      <div className="k-cta k-dark" data-reveal="scale">
        <p className="k-eyebrow">Bespoke concierge</p>
        <h2 className="k-h2">Ready to <em>elevate?</em></h2>
        <p className="k-lede">Be among the first to experience the P31 strategic suite. Tell us a little about your brand and we’ll be in touch.</p>
        <div className="k-actions">
          <a href={INQUIRE} className="k-btn k-btn--gold"><Mail size={18} /> Inquire with our concierge</a>
          <button type="button" className="k-btn k-btn--light" onClick={openJoin}>Get launch updates</button>
        </div>
      </div>
    </section>
  </div>
);

export default Services;
