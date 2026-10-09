import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Video, AlertTriangle, PhoneOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAcademy } from './data';
import './live.css';

const fnError = async (error) => {
  try { return (await error.context?.json())?.error || error.message; } catch { return error.message; }
};

/**
 * /academy/:program/live/:sessionId — the class happens right here.
 * daily-room checks access, logs attendance and returns a personal pass.
 */
const LiveRoom = () => {
  const { sessionId } = useParams();
  const { program } = useAcademy();
  const host = useRef(null);
  const callRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', title: '', error: '', mentor: false }); // loading | live | left | error

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.functions.invoke('daily-room', { body: { action: 'join', session_id: sessionId } });
      if (!alive) return;
      if (error || !data?.token) { setState({ status: 'error', title: '', error: error ? await fnError(error) : 'Couldn’t open the room.' }); return; }
      const { default: Daily } = await import('@daily-co/daily-js');
      if (!alive || !host.current) return;
      const call = Daily.createFrame(host.current, {
        iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '18px', background: '#12081d' },
        showLeaveButton: true,
        showFullscreenButton: true,
        theme: { colors: { accent: '#D9A93A', accentText: '#2a1a00', background: '#12081d', backgroundAccent: '#22123a', baseText: '#FFFFFF', border: '#3a2457', mainAreaBg: '#0d0616', mainAreaBgAccent: '#22123a', mainAreaText: '#FFFFFF', supportiveText: '#c9b8dc' } },
      });
      callRef.current = call;
      // Keep Daily's own reason when it closes the call, so problems are easy to fix.
      let reason = '';
      call.on('error', (e) => {
        reason = e?.errorMsg || e?.error?.msg || e?.error?.type || 'The video service closed the call.';
        console.error('Daily error:', e);
        if (alive) setState((st) => ({ ...st, status: 'error', error: reason }));
      });
      call.on('camera-error', (e) => {
        console.warn('Daily camera error:', e);
        if (alive) setState((st) => ({ ...st, notice: 'Your camera or microphone is blocked. Tap the lock icon by the web address, allow Camera and Microphone, then reload.' }));
      });
      call.on('nonfatal-error', (e) => console.warn('Daily notice:', e));
      call.on('left-meeting', () => alive && !reason && setState((st) => ({ ...st, status: 'left' })));
      setState({ status: 'live', title: data.title, error: '', mentor: !!data.mentor });
      try { await call.join({ url: data.url, token: data.token }); } catch (e) { if (alive) setState({ status: 'error', title: data.title, error: e?.message || 'Couldn’t join the room.' }); }
    })();
    return () => {
      alive = false;
      const call = callRef.current;
      callRef.current = null;
      if (call) call.leave().catch(() => {}).finally(() => call.destroy());
    };
  }, [sessionId]);

  const endForAll = async () => {
    if (!window.confirm('End this class for everyone?')) return;
    await supabase.functions.invoke('daily-room', { body: { action: 'end', session_id: sessionId } });
    await callRef.current?.leave().catch(() => {});
  };

  return (
    <div className="lv">
      <div className="lv-bar">
        <Link to={`/academy/${program.slug}/sessions`} className="k-link"><ArrowLeft size={16} /> Sessions</Link>
        <strong><Video size={16} /> {state.title || 'Live class'}</strong>
        {state.mentor && state.status === 'live' && <button className="k-btn k-btn--sm k-btn--ghost" onClick={endForAll}><PhoneOff size={15} /> End for everyone</button>}
      </div>
      {state.notice && <div className="ds-banner">{state.notice}</div>}
      <div className={`lv-stage ${state.status === 'live' ? '' : 'is-idle'}`}>
        <div ref={host} className="lv-frame" />
        {state.status === 'loading' && <div className="lv-msg"><span className="lv-spin" /> Opening your class…</div>}
        {state.status === 'left' && (
          <div className="lv-msg"><Video size={26} /><strong>You’ve left the class.</strong>
            <div className="k-actions"><button className="k-btn k-btn--gold" onClick={() => window.location.reload()}>Rejoin</button>
              <Link to={state.mentor ? `/academy/${program.slug}/teach/sessions` : `/academy/${program.slug}/sessions`} className="k-btn k-btn--ghost">{state.mentor ? 'Sessions & call reports' : 'Back to sessions'}</Link></div></div>
        )}
        {state.status === 'error' && (
          <div className="lv-msg"><AlertTriangle size={26} /><strong>{state.error}</strong>
            <p>Rooms open 30 minutes before class. If it’s time and this keeps happening, send this message to your mentor or the P31 team.</p>
            <button className="k-btn k-btn--gold" onClick={() => window.location.reload()}>Try again</button>
            <Link to={`/academy/${program.slug}/sessions`} className="k-btn k-btn--ghost">Back to sessions</Link></div>
        )}
      </div>
    </div>
  );
};

export default LiveRoom;
