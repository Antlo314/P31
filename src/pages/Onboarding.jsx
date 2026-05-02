import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, User, Mail, Lock, ArrowRight } from 'lucide-react';
import './Onboarding.css';

const Onboarding = () => {
  const [step, setStep] = useState(1); // 1: Password, 2: Register
  const [accessPassword, setAccessPassword] = useState('');
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePasswordCheck = (e) => {
    e.preventDefault();
    if (accessPassword === 'P31_EXCELLENCE_2026') {
      setStep(2);
      setError('');
    } else {
      setError('Invalid Access Token. Please verify with your Matriarch.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // 2. Create Profile & Curator Entry
      // Note: Supabase often handles profile creation via triggers, 
      // but we'll do manual inserts for the specific curator data here.
      const userId = authData.user.id;
      const initialSlug = formData.fullName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: userId, full_name: formData.fullName, email: formData.email }]);

      if (profileError) throw profileError;

      const { error: curatorError } = await supabase
        .from('curator_data')
        .insert([{ 
          id: userId, 
          business_name: `${formData.fullName}'s Sanctuary`, 
          slug: initialSlug,
          is_paid: false 
        }]);

      if (curatorError) throw curatorError;

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-page">
      <div className="onboarding-container glass-card shadow-lg">
        
        {step === 1 && (
          <form onSubmit={handlePasswordCheck} className="onboarding-step-1">
            <ShieldCheck size={48} className="text-gold mb-4" />
            <h1 className="font-headline text-primary">Elite Access</h1>
            <p className="mb-6">Please enter your specialized access token to begin curation.</p>
            
            <div className="form-group text-left">
              <label>Access Token</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-text">{error}</p>}
            
            <button type="submit" className="btn-solid-gold full-width-btn mt-4">
              Unlock Onboarding <ArrowRight size={18} />
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleRegister} className="onboarding-step-2">
            <h1 className="font-headline text-primary">Join the Collective</h1>
            <p className="mb-6">Initialize your professional presence in the P31 Marketplace.</p>

            <div className="form-group text-left">
              <label>Full Name</label>
              <div className="input-with-icon">
                <User size={16} />
                <input 
                  type="text" 
                  required 
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group text-left">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={16} />
                <input 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group text-left">
              <label>Choose a Secure Password</label>
              <div className="input-with-icon">
                <Lock size={16} />
                <input 
                  type="password" 
                  required 
                  minLength="6"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>

            {error && <p className="error-text">{error}</p>}

            <button type="submit" className="btn-solid-gold full-width-btn mt-4" disabled={loading}>
              {loading ? 'Initializing...' : 'Establish Registry'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Onboarding;
