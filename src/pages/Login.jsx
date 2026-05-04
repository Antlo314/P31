import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', bizName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/register') setIsSignUp(true);
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        // 1. Sign Up
        const { data: signUpData, error: regError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName
            }
          }
        });

        if (regError) throw regError;

        if (signUpData.user) {
          const userId = signUpData.user.id;
          
          // Check for pre-approval
          const { data: approvedRecord } = await supabase
            .from('vendor_approvals')
            .select('*')
            .eq('email', formData.email.toLowerCase().trim())
            .single();

          const isAutoApproved = !!approvedRecord;

          // Create profile
          await supabase.from('profiles').insert([{ 
            id: userId, 
            full_name: formData.fullName, 
            email: formData.email 
          }]);
          
          // Create curator data
          await supabase.from('curator_data').insert([{ 
            id: userId, 
            business_name: formData.bizName || 'My Sanctuary',
            status: isAutoApproved ? 'approved' : 'pending',
            is_paid: isAutoApproved,
            is_published: isAutoApproved
          }]);
        }
        alert('Welcome to the Collective. Sanctuary established.');
        navigate('/dashboard');
      } else {
        // 2. Standard Login
        const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        // Admin Auto-Provisioning Fallback
        const adminEmails = ['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'];
        if (authError && adminEmails.includes(formData.email.toLowerCase()) && formData.password === '123456') {
          const { data: signUpData, error: adminRegError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
          });

          if (adminRegError) throw adminRegError;

          if (signUpData.user) {
            const userId = signUpData.user.id;
            await supabase.from('profiles').upsert([{ 
              id: userId, 
              full_name: 'Master Architect', 
              email: formData.email 
            }]);
            
            await supabase.from('curator_data').upsert([{ 
              id: userId, 
              business_name: 'P31 Foundation', 
              is_paid: true,
              status: 'approved'
            }]);
          }
          navigate('/dashboard');
          return;
        }

        if (authError) throw authError;
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials' 
        ? 'Verification failed. Please check your credentials.' 
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card glass-card shadow-lg">
          <div className="login-header">
            <ShieldCheck size={48} className="text-gold mb-4" style={{margin: '0 auto 1.5rem auto'}} />
            <h1 className="font-headline text-primary">{isSignUp ? 'Join the' : 'Curator'} <span className="text-gold">{isSignUp ? 'Collective' : 'Studio'}</span></h1>
            <p className="login-subtitle">{isSignUp ? 'Enter the sanctuary of Proverbs 31 Marketplace.' : 'Sign in to your professional sanctuary.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="premium-form">
            {isSignUp && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Jane Doe"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Business Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Botanical Alchemy"
                    value={formData.bizName}
                    onChange={(e) => setFormData({ ...formData, bizName: e.target.value })}
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  required 
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  required 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            {error && <p className="error-text text-center mt-2" style={{color: '#ff4b4b', fontWeight: '600', fontSize: '0.85rem'}}>{error}</p>}

            <div className="login-actions">
              <button type="submit" className="btn-solid-gold full-width-btn" disabled={loading}>
                {loading ? 'Processing...' : (isSignUp ? 'Establish Sanctuary' : 'Unlock Studio')} <ArrowRight size={18} />
              </button>
            </div>

            <div className="login-footer mt-6 text-center">
              {isSignUp ? (
                <p>Already a curator? <button type="button" onClick={() => setIsSignUp(false)} className="text-gold font-bold bg-transparent border-none cursor-pointer">Log in here.</button></p>
              ) : (
                <p>Not yet a curator? <button type="button" onClick={() => setIsSignUp(true)} className="text-gold font-bold bg-transparent border-none cursor-pointer">Join the Collective.</button></p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
