import React from 'react';
import '../pages/Home.css';
import melanieNewImg from '../assets/melanie23_rm.png';

const Visionaries = () => {
  return (
    <div className="visionaries-page font-body" style={{ minHeight: '100vh', backgroundColor: 'var(--surface)', color: 'var(--on-surface)', overflowX: 'hidden' }}>
      
      {/* Header Section */}
      <section className="text-center" style={{ padding: '15vh 5vw 10vh' }}>
        <h1 className="font-headline text-primary" style={{ fontSize: 'clamp(3.5rem, 8vw, 6rem)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
          Our Visionary.
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--on-surface-variant)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          Meet the minds and hearts driving the Proverbs 31 Marketplace collective.
        </p>
      </section>

      {/* Main Content */}
      <section className="container-fluid" style={{ paddingBottom: '15vh', maxWidth: '1400px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6vw', alignItems: 'center' }}>
          
          {/* Image Left Side */}
          <div className="visionary-img-wrap glass-border" style={{ flex: '1 1 400px', position: 'relative', aspectRatio: '4/5', overflow: 'hidden', minWidth: '300px' }}>
            <img 
              src={melanieNewImg} 
              alt="Melanie Jeffers-Cameron" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }} 
            />
          </div>
          
          {/* Text Right Side */}
          <div className="visionary-text-content glass-card shadow-lg" style={{ flex: '1.5 1 500px', padding: '4rem 3rem' }}>
            <h4 className="overline-gold font-label text-gold" style={{ letterSpacing: '2px', marginBottom: '1.5rem' }}>
              The Visionary
            </h4>
            <h2 className="font-headline text-primary" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.1, marginBottom: '2rem' }}>
              Melanie Jeffers-Cameron
            </h2>
            
            <p style={{ fontSize: '1.15rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem', lineHeight: 1.7, fontWeight: 600 }}>
              A visionary leader, faith-driven mentor, and purpose-driven entrepreneur dedicated to guiding others toward healing, restoration, and divine alignment.
            </p>
            
            <p style={{ fontSize: '1.05rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem', lineHeight: 1.8 }}>
              In 2019, Melanie received a God-given assignment—to heal from her trauma and use her testimonies to become and create everything she once needed. She’s been obedient since. When asked why she kept building, her response is simple: <br />
              <span className="quote-inline text-gold" style={{ fontStyle: 'italic', display: 'inline-block', marginTop: '0.5rem', fontWeight: 600 }}>“Purpose saved my life. God’s not done with me yet.”</span>
            </p>
            
            <p style={{ fontSize: '1.05rem', color: 'var(--on-surface-variant)', marginBottom: '1.5rem', lineHeight: 1.8 }}>
              As the founder of <a href="https://www.nebaministry.org/" target="_blank" rel="noreferrer" className="text-gold" style={{ textDecoration: 'underline', fontWeight: 600 }}>NEBA Ministry</a>, she has created a sacred space for deep mentorship, accountability, and breaking generational cycles alongside her team's outreach. She is also the CEO of <a href="https://www.nebaministry.org/ilcollection" target="_blank" rel="noreferrer" className="text-gold" style={{ textDecoration: 'underline', fontWeight: 600 }}>Incandescent Lily Collection</a>, a luxury boutique reflecting her passion for holistic wellness and the belief that self-care is an extension of self-worth.
            </p>
            
            <p style={{ fontSize: '1.05rem', color: 'var(--on-surface-variant)', lineHeight: 1.8 }}>
              Through P31 Marketplace, her perspicacious leadership, and her ongoing ministry, Melanie is dedicated to helping individuals walk in their God-given gifts—healing, realigning, and rising into the fullness of their purpose.
            </p>
          </div>
          
        </div>
      </section>
    </div>
  );
};

export default Visionaries;
