import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle, Leaf } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './LeadPopup.css';

const LeadPopup = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: ''
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('leads')
        .insert([{
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone
        }]);

      if (error) throw error;
      
      setIsSubmitted(true);
      // Auto-close after a few seconds
      setTimeout(() => setIsVisible(false), 5000);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.className.includes('lead-popup-overlay')) {
      setIsVisible(false);
    }
  };

  // Never show for logged-in users
  if (!isVisible || user) return null;

  return (
    <div className="lead-popup-overlay" onClick={handleOverlayClick}>
      <div className="lead-popup-content shadow-lg">
        <button className="lead-popup-close-btn" onClick={() => setIsVisible(false)}>
          <X size={24} />
        </button>
        
        {isSubmitted ? (
          <div className="lead-success-state text-center py-8">
            <div className="success-icon-wrapper mb-6">
              <Leaf size={48} className="text-gold animate-bounce" />
            </div>
            <h2 className="font-headline text-primary mb-4">Gratitude & Growth.</h2>
            <p className="text-forest opacity-80 mb-6">
              Thank you for joining the P31 Collective. Your information has been securely received by our architects.
            </p>
            <div className="divider-thistle mb-6"></div>
            <p className="text-xs italic opacity-60">"She watches over the affairs of her household and does not eat the bread of idleness."</p>
            <button onClick={() => setIsVisible(false)} className="btn-outline-primary mt-8">Continue Browsing</button>
          </div>
        ) : (
          <>
            <div className="lead-popup-header">
              <span className="material-symbols-outlined text-gold" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>auto_awesome</span>
              <h2 className="font-headline text-primary" style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>Join the Collective</h2>
              <p style={{ color: 'var(--on-surface)', marginBottom: '1.5rem', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Enter your details below to stay updated on our upcoming markets, exclusive events, and the latest from Proverbs 31 Marketplace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="premium-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} placeholder="Jane Doe" disabled={loading} />
              </div>
              
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="hello@example.com" disabled={loading} />
              </div>

              <div className="form-group">
                <label>Phone Number (Optional)</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="(555) 123-4567" disabled={loading} />
              </div>

              <button type="submit" className="btn-solid-gold full-width-btn" disabled={loading} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                {loading ? 'Subscribing...' : <>Notify Me <Sparkles size={18} /></>}
              </button>
              <p className="form-helper" style={{ textAlign: 'center', fontSize: '0.75rem', marginTop: '1rem', color: 'var(--outline)' }}>
                Your details are securely transmitted to the P31 Management Team.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default LeadPopup;
