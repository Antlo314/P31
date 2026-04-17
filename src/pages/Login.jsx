import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Sparkles, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // For now, this is a visual flow - we'll simulate a successful login
    console.log('Login attempt:', formData);
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card glass-card shadow-lg">
          <div className="login-header">
            <span className="material-symbols-outlined text-gold" style={{ fontSize: '3rem', marginBottom: '1rem' }}>key</span>
            <h1 className="font-headline text-primary">Curator <span className="text-gold">Portal</span></h1>
            <p className="login-subtitle">Access your traveling sanctuary dashboard.</p>
          </div>

          <form onSubmit={handleSubmit} className="premium-form">
            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={18} className="input-icon" />
                <input 
                  type="email" 
                  required 
                  placeholder="name@proverbs31.com"
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

            <div className="login-actions">
              <button type="submit" className="btn-solid-gold full-width-btn">
                Sign In to Sanctuary <span className="material-symbols-outlined">login</span>
              </button>
            </div>

            <div className="login-footer">
              <p>Approved curators only. <a href="/apply" className="text-gold">Not yet a curator? Apply here.</a></p>
            </div>
          </form>
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="login-bg-blob blob-1"></div>
      <div className="login-bg-blob blob-2"></div>
    </div>
  );
};

export default Login;
