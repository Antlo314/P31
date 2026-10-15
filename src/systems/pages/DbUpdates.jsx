import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, CircleAlert, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { dbStatus, pending } from '../../lib/dbStatus';

// The scripts themselves, loaded only when one is waiting (so the copy is exact and instant).
const SQL = {
  'storefront_v45_watchdog.sql': () => import('../../../storefront_v45_watchdog.sql?raw'),
  'storefront_v44_design_studio.sql': () => import('../../../storefront_v44_design_studio.sql?raw'),
  'storefront_v43_staff_powers.sql': () => import('../../../storefront_v43_staff_powers.sql?raw'),
  'storefront_v42_operations.sql': () => import('../../../storefront_v42_operations.sql?raw'),
  'storefront_v41_team_dashboards.sql': () => import('../../../storefront_v41_team_dashboards.sql?raw'),
  'storefront_catchup_v38_v40.sql': () => import('../../../storefront_catchup_v38_v40.sql?raw'),
};
const EDITOR = 'https://supabase.com/dashboard/project/xsnhxjttdizljaawpumz/sql/new';
const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Systems → Health: which database scripts have landed, and a copy button for the ones that have not. */
const DbUpdates = () => {
  const [status, setStatus] = useState(null);
  const [texts, setTexts] = useState({});
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  const load = () => dbStatus().then(setStatus).catch((e) => setError(e.message));
  useEffect(() => { Promise.resolve().then(load); }, []);
  // Load the text of every waiting script now, so Copy works in one tap.
  useEffect(() => {
    if (!status) return;
    pending(status).forEach((s) => {
      if (!SQL[s.file]) return;
      SQL[s.file]().then((m) => setTexts((t) => ({ ...t, [s.file]: m.default }))).catch(() => {});
    });
  }, [status]);

  const copy = async (s) => {
    const text = texts[s.file];
    if (!text) return setError('The script is still loading. Try again in a second.');
    try { await navigator.clipboard.writeText(text); setCopied(s.file); setError(''); setTimeout(() => setCopied(''), 4000); } catch { setError('Your browser blocked copying. Use the file from the project instead.'); }
  };

  const waiting = status ? pending(status) : [];
  return (
    <section className="sys-card db-card" data-tour="db-status">
      <div className="db-card__head">
        <h2><Database size={18} /> Database updates</h2>
        <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => { setStatus(null); load(); }}><RefreshCw size={14} /> Check again</button>
      </div>
      {error && <p className="sys-error">{error}</p>}
      {!status ? <p className="sys-muted">Checking the database…</p> : (
        <>
          <p className="sys-muted" style={{ margin: '0 0 10px' }}>
            {waiting.length
              ? `${waiting.length === 1 ? 'One script is' : `${waiting.length} scripts are`} waiting. Run ${waiting.length === 1 ? 'it' : 'them in this order'}: copy, open the SQL editor, press Ctrl+A then Ctrl+V, and click Run with nothing highlighted (confirm “Run this query” if Supabase asks). Then tap Check again.`
              : 'Every script the site needs is in the database.'}
          </p>
          <ul className="db-list">
            {status.map((s) => {
              const run = waiting.indexOf(s);
              return (
                <li key={`${s.v}-${s.file}`} className={`db-row ${s.landed ? 'is-ok' : 'is-waiting'}`}>
                  <span className="db-row__icon">{s.landed ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}</span>
                  <div className="db-row__main">
                    <strong>v{s.v} · {s.title}</strong>
                    <small>{s.landed ? `In the database${s.applied_at ? ` since ${fmt(s.applied_at)}` : ''}` : `Waiting${run >= 0 && waiting.length > 1 ? ` · run ${run + 1} of ${waiting.length}` : ''} · ${s.file}`}</small>
                    {!s.landed && <small>{s.what}</small>}
                    {!s.landed && s.expect && <small className="db-row__expect">When it works, the result is one row: {s.expect}</small>}
                    {!s.landed && <small>Or, on the computer with the project (no pasting): <code>npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f {s.file}</code></small>}
                  </div>
                  {!s.landed && SQL[s.file] && (
                    <span className="db-row__actions">
                      <button type="button" className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => copy(s)}>{copied === s.file ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy script</>}</button>
                      <a className="sys-btn sys-btn--ghost sys-btn--sm" href={EDITOR} target="_blank" rel="noreferrer">SQL editor <ExternalLink size={13} /></a>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
};

export default DbUpdates;
