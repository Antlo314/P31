import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Services.css';

const Services = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.fromTo('.services-hero__content', 
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' }
      );
      
      gsap.fromTo('.service-card',
        { opacity: 0, y: 40 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 1, 
          stagger: 0.2, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.services-grid',
            start: 'top 80%',
          }
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const servicesList = [
    {
      title: "Bespoke Brand Curation",
      desc: "For the established artisan looking to elevate their digital Presence. We provide end-to-end strategic refinement to ensure your gifts make room in the highest circles.",
      icon: "diversity_3"
    },
    {
      title: "Sanctuary Design",
      desc: "Architectural consultation for physical market spaces and digital storefronts. We create atmospheres where luxury and purpose converge.",
      icon: "architecture"
    },
    {
      title: "Curator Coaching",
      desc: "One-on-one mentorship for the Proverbs 31 woman of influence. Mastering the balance of entrepreneurial excellence and divine purpose.",
      icon: "auto_awesome"
    }
  ];

  return (
    <div className="services-page" ref={containerRef}>
      <section className="services-hero">
        <div className="services-hero__overlay" />
        <div className="services-hero__content">
          <span className="eyebrow-label text-gold">Divine Offerings</span>
          <h1 className="services-headline">Services & <br /><em>Strategic Curation.</em></h1>
          <p className="services-sub">
            Tailored experiences and strategic support for the modern woman of influence. 
            Currently refining our full suite of artisan services.
          </p>
        </div>
      </section>

      <section className="services-intro">
        <div className="container">
          <div className="services-grid">
            {servicesList.map((service, idx) => (
              <div className="service-card glass-card" key={idx}>
                <span className="material-symbols-outlined service-icon">{service.icon}</span>
                <h3 className="service-title">{service.title}</h3>
                <p className="service-desc">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="services-cta py-24">
        <div className="container text-center">
          <h2 className="cta-headline font-headline text-primary mb-6">Interested in Bespoke Support?</h2>
          <p className="cta-body mb-10 opacity-70">
            Our full services catalog is launching soon. Connect with our concierge to be among the first to experience the new P31 strategic suite.
          </p>
          <a href="mailto:proverbs31markets@gmail.com" className="btn-solid-gold">Inquire with Concierge</a>
        </div>
      </section>
    </div>
  );
};

export default Services;
