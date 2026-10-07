import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Store, UserRound, Check } from 'lucide-react';
import LazyVideo from '../components/LazyVideo';
import './Login.css';

import curatorVid from '../assets/web/curator.mp4';
import curatorPoster from '../assets/web/curator-poster.webp';

const PERKS = ['Unlimited products, variants & inventory', 'Six storefront designs', 'Photo & Clip Studio on your phone', 'Orders, discounts & payouts in one place'];

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '', bizName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
          
          // Create profile
          await supabase.from('profiles').insert([{ 
            id: userId, 
            full_name: formData.fullName, 
            email: formData.email 
          }]);
          
          // Create curator data
          await supabase.from('curator_data').insert([{ 
            id: userId, 
            // Approval, payment and publishing are decided by the database
            // (pre-approved vendors are unlocked automatically). See v16.
            business_name: formData.bizName || 'My Sanctuary'
          }]);
        }
        navigate('/dashboard');
      } else {
        // 2. Standard Login
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

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
    <div className="lg k-dark">
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__inner">
        <section className="lg__story">
          <p className="k-eyebrow" data-intro="0">Curator Portal</p>
          <h1 className="k-h1" data-split="intro">Your studio <em>awaits.</em></h1>
          <p className="k-lede" data-intro="0.25">Run your Proverbs 31 storefront from anywhere — products, orders, payouts and creative tools in one beautiful place.</p>
          <ul className="k-checks lg__perks" data-intro="0.35">
            {PERKS.map((p) => <li key={p}><Check size={18} /> {p}</li>)}
          </ul>
          <div className="lg__media" data-reveal="clip">
            <LazyVideo src={curatorVid} poster={curatorPoster} eager />
          </div>
        </section>

        <div className="lg__card" data-intro="0.15">
          <span className="lg__badge"><Store size={22} /></span>
          <h2 className="k-h2 lg__title">{isSignUp ? <>Open your <em>storefront</em></> : <>Welcome <em>back</em></>}</h2>
          <p className="lg__sub">{isSignUp ? 'Create your Proverbs 31 Marketplace studio.' : 'Sign in to manage your shop, products and studio.'}</p>

          <div className="lg__switch" role="tablist">
            <button type="button" role="tab" aria-selected={!isSignUp} onClick={() => setIsSignUp(false)}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignUp} onClick={() => setIsSignUp(true)}>Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="lg__form">
            {isSignUp && (
              <>
                <label className="lg__field">
                  <span>Full name</span>
                  <div className="lg__input"><UserRound size={18} />
                    <input type="text" required autoComplete="name" placeholder="Jane Doe" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                  </div>
                </label>
                <label className="lg__field">
                  <span>Business name</span>
                  <div className="lg__input"><Store size={18} />
                    <input type="text" required autoComplete="organization" placeholder="Botanical Alchemy" value={formData.bizName} onChange={(e) => setFormData({ ...formData, bizName: e.target.value })} />
                  </div>
                </label>
              </>
            )}
            <label className="lg__field">
              <span>Email</span>
              <div className="lg__input"><Mail size={18} />
                <input type="email" required autoComplete="email" inputMode="email" placeholder="name@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </label>
            <label className="lg__field">
              <span>Password</span>
              <div className="lg__input"><Lock size={18} />
                <input type={showPassword ? 'text' : 'password'} required autoComplete={isSignUp ? 'new-password' : 'current-password'} placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                <button type="button" className="lg__eye" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <p className="k-error" role="alert">{error}</p>}

            <button type="submit" className="k-btn k-btn--plum k-btn--lg k-btn--block" disabled={loading}>
              {loading ? 'One moment…' : isSignUp ? 'Create my studio' : 'Sign in'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="lg__foot">
            Not approved yet? <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noopener noreferrer">Apply to become a curator</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
