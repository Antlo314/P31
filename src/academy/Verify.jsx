import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck, Search, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/academy';
import mark from '../assets/academy/collective-mark.png';
import '../pages/Login.css';
import './mentorship.css';

// /verify/:serial — anyone can confirm a Proverbs 31 Collective certificate.
const Verify = () => {
  const { serial } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(serial || '');
  const [state, setState] = useState({ status: serial ? 'loading' : 'idle', cert: null });

  useEffect(() => {
    if (!serial) return;
    let live = true;
    supabase.rpc('academy_verify_certificate', { p_serial: serial }).then(({ data }) => {
      if (live) setState({ status: data?.length ? 'found' : 'missing', cert: data?.[0] || null });
    });
    return () => { live = false; };
  }, [serial]);

  const c = state.cert;
  return (
    <div className="lg k-dark">
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__inner" style={{ gridTemplateColumns: '1fr', maxWidth: 640 }}>
        <div className="lg__card" style={{ textAlign: 'center', justifyItems: 'center', display: 'grid', gap: 14 }}>
          <img src={mark} alt="" className="mt-mark" />
          <p className="k-eyebrow k-eyebrow--center" style={{ margin: 0 }}>Certificate verification</p>
          {state.status === 'found' && c && <>
            <ShieldCheck size={34} color="#17A673" />
            <h1 className="k-h2 lg__title" style={{ margin: 0 }}><em>{c.recipient_name}</em></h1>
            <p className="lg__sub" style={{ margin: 0 }}>was awarded the <strong>{c.title}</strong> for the <strong>{c.program_title}</strong> on {fmtDate(c.issued_at, { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p className="k-fine">Certificate #{serial.toUpperCase()} · issued by The Proverbs 31 Collective</p>
          </>}
          {state.status === 'missing' && <><XCircle size={34} color="#b42318" /><h1 className="k-h2 lg__title" style={{ margin: 0 }}>Not <em>found</em></h1><p className="lg__sub" style={{ margin: 0 }}>No certificate matches #{serial.toUpperCase()}. Check the number and try again.</p></>}
          {state.status === 'loading' && <p className="lg__sub">Checking…</p>}
          <form className="lg__form" style={{ width: '100%' }} onSubmit={(e) => { e.preventDefault(); if (code.trim()) navigate(`/verify/${code.trim().toUpperCase()}`); }}>
            <label className="lg__field"><span>Certificate number</span>
              <div className="lg__input"><Search size={18} /><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 7F3A9C21B4" autoCapitalize="characters" /></div>
            </label>
            <button className="k-btn k-btn--gold k-btn--block">Verify</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Verify;
