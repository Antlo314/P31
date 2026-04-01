import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import './LeadPopup.css';

const LeadPopup = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    // Check if the popup has been shown before in this session
    const hasSeenPopup = sessionStorage.getItem('p31_lead_popup_seen');
    if (!hasSeenPopup) {
      // Delay slightly for better UX (e.g., 1.5 seconds)
      const timer = setTimeout(() => {
        setIsVisible(true);
        sessionStorage.setItem('p31_lead_popup_seen', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`New P31 Subscriber: ${formData.fullName}`);
    const body = encodeURIComponent(`
New Contact Info Collected:

Name: ${formData.fullName}
Email: ${formData.email}
Phone: ${formData.phone || 'Not provided'}
    `);
    
    window.location.href = `mailto:proverbs31markets@gmail.com?subject=${subject}&body=${body}`;
    setIsVisible(false); // Close after submit
  };

  if (!isVisible) return null;

  return (
    <div className="lead-popup-overlay">
      <div className="lead-popup-content shadow-lg">
        <button className="lead-popup-close-btn" onClick={() => setIsVisible(false)}>
          <X size={24} />
        </button>
        
        <div className="lead-popup-header">
          <span className="material-symbols-outlined text-gold" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>auto_awesome</span>
          <h2 className="font-headline text-primary" style={{ fontSize: '2.2rem', margin: '0 0 0.5rem 0' }}>Join the Collective</h2>
          <p style={{ color: 'var(--on-surface)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: '1.6' }}>
            Enter your details below to stay updated on our upcoming markets, exclusive events, and the latest from Proverbs 31 Marketplace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="premium-form">
          <div className="form-group">
            <label>Full Name *</label>
            <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Jane Doe" />
          </div>
          
          <div className="form-group">
            <label>Email Address *</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="hello@example.com" />
          </div>

          <div className="form-group">
            <label>Phone Number (Optional)</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" />
          </div>

          <button type="submit" className="btn-solid-gold full-width-btn" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            Notify Me <Sparkles size={18} />
          </button>
          <p className="form-helper" style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '1rem', color: 'var(--outline)' }}>
            This will open your email client to securely send your details to our team.
          </p>
        </form>
      </div>
    </div>
  );
};

export default LeadPopup;
