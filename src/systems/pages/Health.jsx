import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, RotateCcw, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/academy';

const VIEWS = [['open', 'Open'], ['resolved', 'Fixed'], ['all', 'All']];
const KIND = { render: 'Page crashed', error: 'Script error', promise: 'Failed request or task', chunk: 'Old version after a deploy' };

// Systems → Health: crashes reported by visitors' browsers on both sites, grouped by error.
const Health = () => {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('open');
  const [site, setSite] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let q = supabase.from('app_errors').select('*').order('last_seen', { ascending: false }).limit(500);
    if (view === 'open') q = q.is('resolved_at', null);
    if (view === 'resolved') q = q.not('resolved_at', 'is', null);
    if (site !== 'all') q = q.eq('site', site);
    const { data, error: err } = await q;
    if (err) {
      setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v28_error_log.sql in Supabase to turn on error reporting.' : err.message);
      return;
    }
    setError(''); setRows(data || []);
  }, [view, site]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const setResolved = async (r, fixed) => {
    const { data: who } = await supabase.auth.getUser();
    await supabase.from('app_errors').update(fixed
      ? { resolved_at: new Date().toISOString(), resolved_by: who?.user?.id || null }
      : { resolved_at: null, resolved_by: null }).eq('id', r.id);
    load();
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Health</p>
        <h1>Site errors</h1>
        <p className="sys-muted">When a page breaks for anyone on p31market.com or thep31collective.org, it shows up here automatically, grouped so each problem appears once with a count. Mark it fixed once it’s handled; if it happens again, it reopens.</p>
      </header>
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-row sys-row--center" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div className="sys-chips" role="tablist">
          {VIEWS.map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} className={`sys-chip ${view === v ? 'is-on' : ''}`} onClick={() => setView(v)}>{l}</button>)}
        </div>
        <div className="sys-chips hl-sites" role="tablist" aria-label="Site">
          {[['all', 'Both sites'], ['market', 'p31market.com'], ['collective', 'thep31collective.org']].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={site === v} className={`sys-chip ${site === v ? 'is-on' : ''}`} onClick={() => setSite(v)}>{l}</button>
          ))}
        </div>
      </div>

      <ul className="sys-list">
        {rows.map((r) => (
          <li key={r.id} className="hl-row">
            <div className="hl-main">
              <span className={`hl-dot ${r.resolved_at ? 'is-fixed' : ''}`}><Activity size={14} /></span>
              <div className="sys-result__main">
                <h3 className="hl-msg">{r.message}</h3>
                <div className="sys-result__meta">
                  <span>{KIND[r.kind] || r.kind}</span>
                  <span>{r.site === 'collective' ? 'thep31collective.org' : r.site === 'market' ? 'p31market.com' : 'site'}{r.path}</span>
                  <span><b>{r.count}</b> time{r.count === 1 ? '' : 's'}</span>
                  <span>last {fmtDateTime(r.last_seen)}</span>
                  {r.release && <span>version {r.release}</span>}
                </div>
              </div>
              {r.resolved_at
                ? <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setResolved(r, false)}><RotateCcw size={14} /> Reopen</button>
                : <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => setResolved(r, true)}><CheckCircle2 size={14} /> Mark fixed</button>}
              <button className="sys-icon-btn" aria-expanded={openId === r.id} aria-label="Details" onClick={() => setOpenId(openId === r.id ? null : r.id)}><ChevronDown size={16} /></button>
            </div>
            {openId === r.id && (
              <div className="hl-detail">
                <p className="sys-muted">First seen {fmtDateTime(r.first_seen)}{r.resolved_at ? ` · marked fixed ${fmtDateTime(r.resolved_at)}` : ''}</p>
                {r.user_agent && <p className="sys-muted">Browser: {r.user_agent}</p>}
                {r.stack && <pre>{r.stack}</pre>}
                <p className="sys-muted">Send this to your developer if it keeps happening.</p>
              </div>
            )}
          </li>
        ))}
        {!rows.length && !error && <li className="sys-empty">{view === 'open' ? 'No open errors. Both sites are running clean.' : 'Nothing here.'}</li>}
      </ul>
    </div>
  );
};

export default Health;
