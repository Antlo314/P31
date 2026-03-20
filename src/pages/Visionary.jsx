import React from 'react';
import '../pages/Home.css';
import founderVid from '../assets/melanie.mp4';

const Visionaries = () => {
  return (
    <div className="visionaries-page" style={{ paddingTop: '100px', backgroundColor: '#050505', minHeight: '100vh', paddingBottom: '100px', color: 'white' }}>
      <div className="container-fluid text-center">
        <h1 style={{ marginTop: '40px', marginBottom: '20px', fontSize: '3rem', fontWeight: 300, color: 'white' }}>Our Visionaries</h1>
        <p className="about-lead" style={{ maxWidth: '800px', margin: '0 auto 80px auto' }}>
          Meet the minds and hearts driving the Proverbs 31 Marketplace movement.
        </p>
      </div>

      <section className="about-cinematic section-padded">
        <div className="container-fluid flex-center column">
          <div className="about-grid">
            <div className="about-img-container cinematic-reveal">
              <div className="founder-img-wrapper">
                <video src={founderVid} autoPlay loop muted playsInline className="img-parallax cinematic-founder-img" style={{ width: '100%', height: '120%', objectFit: 'cover' }} />
                <div className="founder-img-overlay"></div>
              </div>
            </div>
            
            <div className="about-text-container cinematic-reveal">
              <h4 className="overline-gold">The Visionary</h4>
              <h2 className="margin-bottom-large" style={{marginBottom: "2rem"}}>Melanie Jeffers-Cameron</h2>
              
              <p className="about-lead">
                A visionary leader, faith-driven mentor, and purpose-driven entrepreneur dedicated to guiding others toward healing, restoration, and divine alignment.
              </p>
              
              <p>
                In 2019, Melanie received a God-given assignment—to heal from her trauma and use her testimonies to become and create everything she once needed. She’s been obedient since. When asked why she kept building, her response is simple: <span className="quote-inline">“Purpose saved my life. God’s not done with me yet.”</span>
              </p>
              
              <p>
                As the founder of <a href="https://www.nebaministry.org/" target="_blank" rel="noreferrer" className="link-gold-inline">NEBA Ministry</a>, she has created a sacred space for deep mentorship, accountability, and breaking generational cycles alongside her team's outreach. She is also the CEO of <a href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="link-gold-inline">Incandescent Lily Collection</a>, a luxury boutique reflecting her passion for holistic wellness and the belief that self-care is an extension of self-worth.
              </p>
              
              <p>
                Through P31 Marketplace, her perspicacious leadership, and her ongoing ministry, Melanie is dedicated to helping individuals walk in their God-given gifts—healing, realigning, and rising into the fullness of their purpose.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Visionaries;
