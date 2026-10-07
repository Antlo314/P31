import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailX, Check, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { openJoin } from '../lib/join';
import './Login.css';

// One-click unsubscribe from P31 emails (link in every campaign email).
const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get('t');
  const [state, setState] = useState(token ? 'working' : 'missing');

  useEffect(() => {
    if (!token) return;
    supabase.rpc('unsubscribe_lead', { p_token: token })
      .then(({ data, error }) => setState(!error && data ? 'done' : 'missing'));
  }, [token]);

  return (
    <div className="lg k-dark" style={{ display: 'grid', placeItems: 'center' }}>
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__card" data-intro="0" style={{ textAlign: 'center', justifyItems: 'center' }}>
        <span className="lg__badge">{state === 'done' ? <Check size={22} /> : <MailX size={22} />}</span>
        <h1 className="k-h2 lg__title">
          {state === 'done' ? <>You’re <em>unsubscribed</em></> : state === 'working' ? 'One moment…' : <>Link not <em>recognised</em></>}
        </h1>
        <p className="lg__sub">{state === 'done'
          ? 'You won’t receive P31 marketing emails anymore. Changed your mind? You can rejoin any time.'
          : state === 'working' ? 'Updating your preferences.' : 'This unsubscribe link is incomplete or has already been used.'}</p>
        <div className="k-actions" style={{ justifyContent: 'center' }}>
          <Link to="/" className="k-btn k-btn--plum">Back to the marketplace <ArrowRight size={18} /></Link>
          {state === 'done' && <button type="button" className="k-btn k-btn--ghost" onClick={openJoin}>Rejoin</button>}
        </div>
      </div>
    </div>
  );
};

export default Unsubscribe;
