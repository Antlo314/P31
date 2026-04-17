import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
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
            <h1 className="font-headline text-primary">Curator <span className="text-gold">Studio</span></h1>
            <p className="login-subtitle">Sign in to your professional sanctuary.</p>
          </div>

          <form onSubmit={handleSubmit} className="premium-form">
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
                {loading ? 'Verifying...' : 'Unlock Studio'} <ArrowRight size={18} />
              </button>
            </div>

            <div className="login-footer mt-6">
              <p>Not yet a curator? <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="text-gold font-bold">Apply via the Google Form.</a></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
