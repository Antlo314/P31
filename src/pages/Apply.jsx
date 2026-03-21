import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Apply.css';

const Apply = () => {
  const containerRef = useRef(null);
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    website: '',
    category: '',
    description: ''
  });

  useEffect(() => {
    let ctx = gsap.context(() => {
      gsap.fromTo('.apply-hero-text', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out' });
      gsap.fromTo('.apply-form-container', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 1, delay: 0.3, ease: 'power3.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`New Vendor Application: ${formData.businessName}`);
    const body = encodeURIComponent(`
Full Name: ${formData.fullName}
Business Name: ${formData.businessName}
Email: ${formData.email}
Phone: ${formData.phone}
Website/Social: ${formData.website}
Category: ${formData.category}

Description of Products:
${formData.description}
    `);
    
    window.location.href = `mailto:proverbs31markets@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="apply-page" ref={containerRef}>
      <section className="apply-hero">
        <div className="apply-hero-gradient"></div>
        <div className="apply-hero-text">
           <h4 className="overline-gold">Join The Collection</h4>
           <h1 className="apply-title">Apply as a Curator</h1>
           <p className="apply-subtitle">Proverbs 31 Marketplace is a traveling sanctuary for women creatives, artisans, and visionaries. Submit your application below to feature your divine gifts.</p>
        </div>
      </section>

      <section className="apply-form-section section-padded">
         <div className="apply-form-container shadow-lg">
            <h2 className="form-header">Vendor Intake Portal</h2>
            <div className="divider-gold" style={{margin: '0 auto 2rem auto'}}></div>
            
            <form onSubmit={handleSubmit} className="premium-form">
               <div className="form-row">
                 <div className="form-group">
                   <label>Full Name *</label>
                   <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Jane Doe" />
                 </div>
                 <div className="form-group">
                   <label>Business Name *</label>
                   <input type="text" name="businessName" required value={formData.businessName} onChange={handleChange} placeholder="Luxe Creations" />
                 </div>
               </div>

               <div className="form-row">
                 <div className="form-group">
                   <label>Email Address *</label>
                   <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="hello@example.com" />
                 </div>
                 <div className="form-group">
                   <label>Phone Number *</label>
                   <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" />
                 </div>
               </div>

               <div className="form-group">
                 <label>Website or Social Media Link *</label>
                 <input type="url" name="website" required value={formData.website} onChange={handleChange} placeholder="https://instagram.com/yourbrand" />
               </div>

               <div className="form-group">
                 <label>Category of Excellence *</label>
                 <select name="category" required value={formData.category} onChange={handleChange}>
                   <option value="" disabled>Select a Category...</option>
                   <option value="Art">Art & Decor</option>
                   <option value="Wellness">Wellness & Skincare</option>
                   <option value="Clothing">Clothing & Apparel</option>
                   <option value="Food">Food & Beverage</option>
                   <option value="Literature">Literature</option>
                   <option value="Community">Community / Service</option>
                 </select>
               </div>

               <div className="form-group">
                 <label>Description of Products/Services *</label>
                 <textarea name="description" required rows="5" value={formData.description} onChange={handleChange} placeholder="Tell us about the gifts you want to share with the marketplace..."></textarea>
               </div>

               <button type="submit" className="btn-solid-gold full-width-btn">Submit Application</button>
               <p className="form-helper">This will open your default email client to send your securely formatted application directly to our team.</p>
            </form>
         </div>
      </section>
    </div>
  );
};

export default Apply;
