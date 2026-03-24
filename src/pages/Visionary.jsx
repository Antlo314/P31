import React from 'react';
import '../pages/Home.css';
import visionaryVid from '../assets/visionary.mp4';

const Visionaries = () => {
  return (
    <div className="visionaries-page" style={{ paddingTop: '100px', backgroundColor: '#050505', minHeight: '100vh', paddingBottom: '100px', color: 'white' }}>
      <div className="container-fluid text-center">
        <h1 style={{ marginTop: '40px', marginBottom: '20px', fontSize: '3rem', fontWeight: 300, color: 'white' }}>Our Visionaries</h1>
        <p className="about-lead" style={{ maxWidth: '800px', margin: '0 auto 80px auto' }}>
          Meet the minds and hearts driving the Proverbs 31 Marketplace movement.
        </p>
      </div>

      <section className="about-cinematic section-padded" style={{display: 'block'}}>
        <style>{`
          .visionary-video-float {
            float: left;
            width: 350px;
            aspect-ratio: 9/16;
            margin-right: 3rem;
            margin-bottom: 2rem;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            overflow: hidden;
            background: #111;
          }
          @media (max-width: 900px) {
            .visionary-video-float {
              float: none;
              width: 100%;
              max-width: 400px;
              margin: 0 auto 3rem auto;
            }
          }
        `}</style>
        <div className="container-fluid" style={{maxWidth: '1200px', margin: '0 auto'}}>
          <div className="visionary-content-wrapper">
            <div className="visionary-video-float cinematic-reveal">
              <video src={visionaryVid} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            
            <div className="visionary-text-content cinematic-reveal" style={{paddingTop: '1rem'}}>
              <h4 className="overline-gold" style={{color: 'var(--metallic-gold)', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '0.85rem'}}>The Visionary</h4>
              <h2 className="margin-bottom-large font-headline" style={{marginBottom: "2rem", fontSize: '2.5rem', color: 'white'}}>Melanie Jeffers-Cameron</h2>
              
              <p className="about-lead" style={{fontSize: '1.25rem', color: 'rgba(255,255,255,0.9)', marginBottom: '1.5rem', lineHeight: 1.6}}>
                A visionary leader, faith-driven mentor, and purpose-driven entrepreneur dedicated to guiding others toward healing, restoration, and divine alignment.
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                In 2019, Melanie received a God-given assignment—to heal from her trauma and use her testimonies to become and create everything she once needed. She’s been obedient since. When asked why she kept building, her response is simple: <span className="quote-inline" style={{fontStyle: 'italic', color: 'var(--metallic-gold)'}}>“Purpose saved my life. God’s not done with me yet.”</span>
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                As the founder of <a href="https://www.nebaministry.org/" target="_blank" rel="noreferrer" className="link-gold-inline" style={{color: 'var(--metallic-gold)', textDecoration: 'underline'}}>NEBA Ministry</a>, she has created a sacred space for deep mentorship, accountability, and breaking generational cycles alongside her team's outreach. She is also the CEO of <a href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="link-gold-inline" style={{color: 'var(--metallic-gold)', textDecoration: 'underline'}}>Incandescent Lily Collection</a>, a luxury boutique reflecting her passion for holistic wellness and the belief that self-care is an extension of self-worth.
              </p>
              
              <p style={{marginBottom: '1.5rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.7)'}}>
                Through P31 Marketplace, her perspicacious leadership, and her ongoing ministry, Melanie is dedicated to helping individuals walk in their God-given gifts—healing, realigning, and rising into the fullness of their purpose.
              </p>
            </div>
            
            <div style={{clear: 'both'}}></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Visionaries;
