import React from 'react';
import { ArrowUpRight, Instagram, Facebook } from 'lucide-react';
import { PODCAST } from '../lib/podcast';
import { isCollective } from '../lib/site';
import emblem from '../assets/podcast/emblem.webp';
import lotus from '../assets/podcast/lotus.webp';
import './PodcastFeature.css';

/**
 * The P31 Podcast band on both home pages: the emblem from the podcast flyer (crown, P31 and the
 * microphone, cut out so it sits on the section's own plum), with a light that glides across the
 * gold, sound waves from the microphone and a twinkle on the crown; beside it, the flyer's words.
 */
const PodcastFeature = () => {
  const listen = PODCAST.platforms.find((p) => p.url);
  const insta = PODCAST.social.instagram[isCollective ? 'collective' : 'market'];
  return (
    <section className="k-section k-section--night k-dark pod" id="podcast" aria-labelledby="pod-title">
      <div className="pod__inner">
        <div className="pod__art" data-reveal="fade">
          <div className="pod__float" style={{ '--pod-mask': `url(${emblem})` }}>
            <span className="pod__glow" aria-hidden="true" />
            <img src={emblem} alt="P31 Podcast, the Proverbs 31 Podcast" className="pod__emblem" width="668" height="660" loading="lazy" decoding="async" />
            <span className="pod__shine" aria-hidden="true" />
            <span className="pod__waves" aria-hidden="true"><i /><i /><i /></span>
            <span className="pod__twinkle pod__twinkle--crown" aria-hidden="true" />
            <span className="pod__twinkle pod__twinkle--one" aria-hidden="true" />
          </div>
        </div>

        <span className="pod__rule" aria-hidden="true" />

        <div className="pod__copy">
          <ul className="pod__platforms" aria-label="Where to listen" data-reveal-group>
            {PODCAST.platforms.map((p) => {
              const inner = <><img src={p.icon} alt="" width="40" height="38" loading="lazy" decoding="async" /><span>{p.label}</span></>;
              return (
                <li key={p.id}>
                  {p.url ? <a href={p.url} target="_blank" rel="noreferrer" aria-label={`Listen on ${p.label}`}>{inner}</a> : <span className="pod__platform">{inner}</span>}
                </li>
              );
            })}
          </ul>

          <div className="pod__series" data-reveal="fade">
            <p className="pod__eyebrow">Her podcast series</p>
            <span className="pod__divider" aria-hidden="true"><img src={lotus} alt="" width="30" height="22" /></span>
          </div>

          <p className="pod__themes" data-reveal>
            {PODCAST.themes.map((t) => <span key={t}>{t}</span>)}
          </p>

          <p className="pod__family" data-reveal="fade">
            {PODCAST.family.map((f, i) => <React.Fragment key={f}>{i > 0 && <b aria-hidden="true">•</b>}<span>{f}</span></React.Fragment>)}
          </p>

          <h2 className="pod__title" id="pod-title" data-reveal>Step into the <em>conversation.</em></h2>

          <p className="pod__host" data-reveal="fade"><small>With</small><span>{PODCAST.host}</span></p>

          <div className="pod__social" data-reveal="fade">
            <span>Follow along</span>
            <a href={insta.url} target="_blank" rel="noreferrer" aria-label={`Instagram ${insta.handle}`}><Instagram size={18} /> {insta.handle}</a>
            <a href={PODCAST.social.facebook.url} target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /> Facebook</a>
          </div>

          {listen && (
            <div className="k-actions pod__actions" data-reveal>
              <a href={listen.url} target="_blank" rel="noreferrer" className="k-btn k-btn--gold">Listen now <ArrowUpRight size={18} /></a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PodcastFeature;
