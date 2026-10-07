import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usernameToEmail } from './useOperator';

const SystemsLogin = ({ notice }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setBusy(false);
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'That username and password don’t match.'
        : authError.message);
    }
    // On success the session listener in AuthContext picks it up and the
    // gate re-renders into the console. Supabase keeps the session in this
    // browser, so you stay signed in until you sign out.
  };

  return (
    <div className="sys-login">
      <Link to="/" className="sys-login__back"><ArrowLeft size={16} /> p31market.com</Link>
      <form className="sys-login__card" onSubmit={submit}>
        <span className="sys-login__lock"><Lock size={20} /></span>
        <p className="sys-eyebrow">Proverbs 31 Marketplace</p>
        <h1>Systems</h1>
        <p className="sys-muted">Team sign-in</p>

        {notice && <p className="sys-alert">{notice}</p>}

        <label className="sys-field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </label>

        <label className="sys-field">
          <span>Password</span>
          <div className="sys-field__pw">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error && <p className="sys-error" role="alert">{error}</p>}

        <button className="sys-btn sys-btn--gold sys-btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default SystemsLogin;
