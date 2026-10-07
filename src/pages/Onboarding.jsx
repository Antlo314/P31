import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, User, Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import './Login.css';

const Onboarding = () => {
  const [step, setStep] = useState(1); // 1: Password, 2: Register
  const [accessPassword, setAccessPassword] = useState('');
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // The access code is checked by the database (see v16), so it never
  // appears in the site's JavaScript.
  const handlePasswordCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: valid, error: rpcError } = await supabase.rpc('check_onboarding_code', { p_code: accessPassword.trim() });
    setLoading(false);
    if (!rpcError && valid) {
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
          slug: initialSlug
        }]);

      if (curatorError) throw curatorError;

      // Holders of the access token are vetted — unlock the studio so they
      // can build their store immediately. The database re-checks the code.
      const { error: redeemError } = await supabase.rpc('redeem_onboarding_code', { p_code: accessPassword.trim() });
      if (redeemError) throw redeemError;

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg k-dark">
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__inner">
        <section className="lg__story">
          <p className="k-eyebrow" data-intro="0">By invitation</p>
          <h1 className="k-h1" data-split="intro">Welcome to the <em>collective.</em></h1>
          <p className="k-lede" data-intro="0.25">You’ve been personally invited to open a storefront on Proverbs 31 Marketplace. Two quick steps and your studio is ready.</p>
          <ol className="k-steps lg__perks" style={{ '--steps': 2 }} data-intro="0.35">
            <li><h3>Unlock</h3><p>Enter the access code you were given.</p></li>
            <li><h3>Create</h3><p>Set up your account — your shop opens instantly.</p></li>
          </ol>
        </section>

        <div className="lg__card" data-intro="0.15">
          <span className="lg__badge">{step === 1 ? <ShieldCheck size={22} /> : <KeyRound size={22} />}</span>
          {step === 1 && (
            <form onSubmit={handlePasswordCheck} className="lg__form">
              <h2 className="k-h2 lg__title">Elite <em>access</em></h2>
              <p className="lg__sub">Enter your access code to begin.</p>
              <label className="lg__field">
                <span>Access code</span>
                <div className="lg__input"><Lock size={18} />
                  <input type="password" placeholder="••••••••" autoComplete="off" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} required />
                </div>
              </label>
              {error && <p className="k-error" role="alert">{error}</p>}
              <button type="submit" className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={loading}>
                {loading ? 'Checking…' : <>Unlock onboarding <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="lg__form">
              <h2 className="k-h2 lg__title">Open your <em>studio</em></h2>
              <p className="lg__sub">Create the account you’ll use to run your shop.</p>
              <label className="lg__field">
                <span>Full name</span>
                <div className="lg__input"><User size={18} />
                  <input type="text" required autoComplete="name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                </div>
              </label>
              <label className="lg__field">
                <span>Email</span>
                <div className="lg__input"><Mail size={18} />
                  <input type="email" required autoComplete="email" inputMode="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </label>
              <label className="lg__field">
                <span>Choose a password</span>
                <div className="lg__input"><Lock size={18} />
                  <input type="password" required minLength="8" autoComplete="new-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                </div>
              </label>
              {error && <p className="k-error" role="alert">{error}</p>}
              <button type="submit" className="k-btn k-btn--plum k-btn--lg k-btn--block" disabled={loading}>
                {loading ? 'Creating your studio…' : <>Create my studio <ArrowRight size={18} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
