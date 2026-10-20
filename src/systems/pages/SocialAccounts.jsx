import React, { useCallback, useEffect, useState } from 'react';
import { Instagram, Facebook, RefreshCw, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Plug, KeyRound, Webhook } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/academy';

// The TikTok mark from the site header and footer (lucide has none).
const TikTok = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.5z" />
  </svg>
);
const ICON = { instagram: Instagram, facebook: Facebook, tiktok: TikTok };
const PLATFORM = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const BRAND = { market: 'Marketplace', collective: 'Collective' };
const EVENT = { 'message.received': 'new DMs', 'message.sent': 'replies sent from the apps', 'comment.received': 'new comments', 'review.new': 'Google reviews' };
const DID = { created: 'Set up a new webhook to Carla.', updated: 'Completed the webhook to Carla', unchanged: 'The webhook to Carla was already complete.', shared: '', none: '', failed: 'Could not finish:' };

const nameOf = (a) => (a.platform === 'facebook' ? a.displayName || 'Facebook page' : `@${a.username || PLATFORM[a.platform]}`);

const DEPLOY_FIRST = 'Deploy the latest watchdog function first (see the build notes).';

/**
 * Ask the watchdog function (admins only). Throws with a friendly message. `needs` is the list the
 * answer must carry: an older watchdog does not know these actions and answers with a check run.
 */
async function watchdog(action, needs) {
  const { data, error } = await supabase.functions.invoke('watchdog', { body: { action } });
  let msg = error?.message || data?.error;
  if (error) { try { msg = (await error.context.json()).error || msg; } catch { /* keep */ } }
  if (msg) throw new Error(/not found|Failed to send/i.test(msg) ? DEPLOY_FIRST : msg);
  if (!Array.isArray(data?.[needs])) throw new Error(DEPLOY_FIRST);
  return data;
}

/** One connected account: the brand it answers for, and anything that keeps Carla or posting from working. `now` is when it was checked. */
const Account = ({ a, now }) => {
  const Icon = ICON[a.platform] || Plug;
  const notes = [];
  if (a.needsReconnection || !a.active) notes.push({ bad: true, text: 'Needs reconnecting in Zernio: posts to it and Carla’s replies stop until then.' });
  else if (a.tokenExpiresAt && new Date(a.tokenExpiresAt).getTime() - now < 14 * 864e5) notes.push({ bad: true, text: `Login expires ${fmtDateTime(a.tokenExpiresAt)}. Reconnect it in Zernio before then.` });
  if (a.platform === 'tiktok') {
    if (a.integrationLane === 'business') notes.push({ text: 'Connected through TikTok for Business, so Carla can read and answer its DMs and comments.' });
    else if (a.integrationLane === 'developer') notes.push({ bad: true, text: 'Connected through TikTok’s developer app, which sends no DMs or comments. Reconnect it in Zernio through TikTok for Business.' });
    else notes.push({ text: 'Zernio did not say how it is connected (TikTok for Business is the one that brings DMs and comments).' });
    if (a.tiktokAccountType === 'personal') notes.push({ bad: true, text: 'A personal TikTok account: TikTok only allows DMs on Business accounts (switch it to Business in the TikTok app).' });
    if (a.tiktokAccountType === 'business') notes.push({ text: 'TikTok Business account. TikTok lets a business reply to DMs but never start one.' });
  }
  if (a.carlaListening === false) notes.push({ bad: true, text: 'Carla’s own account list (the DM_AGENT_ACCOUNT_IDS secret) leaves this account out, so she ignores it. Add its id there, or clear that secret.' });
  return (
    <li className="sa-acct">
      <span className={`sa-acct__icon sa-acct__icon--${a.platform}`}><Icon size={18} /></span>
      <div className="sa-acct__main">
        <div className="sa-acct__top">
          <strong>{nameOf(a)}</strong>
          <span className="sys-muted">{PLATFORM[a.platform] || a.platform}</span>
          <span className={`sys-site sys-site--${a.site}`}>Answers for the {BRAND[a.site]}</span>
        </div>
        {notes.map((n) => <small key={n.text} className={n.bad ? 'sa-bad' : ''}>{n.bad ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />} {n.text}</small>)}
        <small className="sa-id">Zernio id {a.id}</small>
      </div>
    </li>
  );
};

/** The webhook that brings a workspace's DMs and comments to Carla, in plain words. */
const Hook = ({ h }) => (
  <div className="sa-hook">
    <p><Webhook size={14} /> <strong>{h.name || 'Webhook'}</strong> · {h.isActive ? 'switched on' : 'switched off'} · {h.secretMatches ? 'signed with Carla’s secret'
      : h.secretMatches == null ? 'Zernio doesn’t show its secret (the Connect button’s test message checks it)'
        : h.hasSecret === false ? 'not signed' : 'signed with a different secret'}</p>
    <small>Sends {h.events.filter((e) => EVENT[e]).map((e) => EVENT[e]).join(', ') || 'nothing Carla uses'}{h.missingEvents.length ? `; not ${h.missingEvents.map((e) => EVENT[e]).join(', ')}` : ''}.</small>
    <small>{h.accountIds.length ? `Only for ${h.accounts.join(', ')}.` : 'For every account in this Zernio account.'}{h.profileCount ? ` Limited to ${h.profileCount} Zernio profile${h.profileCount === 1 ? '' : 's'}.` : ''}</small>
    <small>{h.lastFiredAt ? `Last delivered ${fmtDateTime(h.lastFiredAt)}.` : 'No delivery yet.'}{h.failureCount ? ` ${h.failureCount} failed in a row.` : ''}</small>
    {h.failures.length > 0 && (
      <details className="sa-fails">
        <summary>Recent failed deliveries ({h.failures.length})</summary>
        <ul>{h.failures.map((f, i) => <li key={i}>{f.at ? fmtDateTime(f.at) : ''} · {EVENT[f.event] || f.event}{f.test ? ' (test)' : ''} · {f.statusCode ? `Carla answered ${f.statusCode}` : 'no answer'}{f.statusCode === 401 ? ' (secret did not match)' : ''}{f.error ? ` · ${f.error}` : ''}</li>)}</ul>
      </details>
    )}
    {h.failuresError && <small className="sys-muted">Delivery log unavailable: {h.failuresError}</small>}
  </div>
);

/**
 * Systems → Social accounts: the two Zernio accounts (one key each) behind P31's socials, the brand
 * each profile answers for, and whether Carla gets their DMs and comments. Reading is safe; only
 * the Connect button changes anything in Zernio, and it only adds.
 */
const SocialAccounts = () => {
  const [setup, setSetup] = useState(null);
  const [busy, setBusy] = useState('load');
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const load = useCallback(async () => {
    setBusy('load'); setError('');
    try { setSetup(await watchdog('socialSetup', 'workspaces')); } catch (err) { setError(err.message); }
    setBusy('');
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const connect = async () => {
    if (!window.confirm('Connect Carla to both Zernio accounts? This sets up (or completes) the webhook in each one. It only adds what is missing, never removes anything, and then sends Zernio’s test message to Carla.')) return;
    setBusy('connect'); setError(''); setResults(null);
    try {
      const out = await watchdog('connectWebhooks', 'results');
      setResults(out.results || []);
      if (out.setup) setSetup(out.setup);
    } catch (err) { setError(err.message); }
    setBusy('');
  };

  const ready = setup?.workspaces?.filter((w) => w.keySet) || [];
  const trouble = ready.filter((w) => !w.accountsOk || !w.webhooksOk || w.problems?.length);
  const hookById = Object.fromEntries((setup?.webhooks || []).map((h) => [h.id, h]));
  const shown = new Set();

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Social accounts</p>
        <h1>Social accounts</h1>
        <p className="sys-muted">P31’s socials live in two Zernio accounts, one key each. Here is every profile, the brand it answers for, and whether Carla gets its DMs and comments. Looking is safe; only the Connect button changes anything in Zernio.</p>
      </header>

      <section className={`sys-card wd ${!setup ? '' : trouble.length || !ready.length ? 'wd--alert' : 'wd--ok'}`}>
        <div className="wd-head">
          <span className="wd-badge">{trouble.length || !ready.length ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}</span>
          <div>
            <h2>{!setup ? (busy === 'load' ? 'Checking…' : 'Not checked yet')
              : !ready.length ? 'No Zernio key is set up'
                : trouble.length ? `Carla is missing messages from the ${trouble.map((w) => w.label).join(' and ')} Zernio account${trouble.length === 1 ? '' : 's'}`
                  : `Zernio sends Carla the DMs and comments from ${ready.length === 2 ? 'both Zernio accounts' : `the ${ready[0].label} Zernio account`}`}</h2>
            <p className="sys-muted">{setup?.checkedAt ? `Checked ${fmtDateTime(setup.checkedAt)}.` : ''} The button sets up the webhook in each Zernio account, or adds what one is missing (events, accounts, the signing secret), then sends Zernio’s test message.</p>
          </div>
          <div className="sa-actions">
            <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={load} disabled={!!busy}>{busy === 'load' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Check again</button>
            <button type="button" className="sys-btn sys-btn--gold sys-btn--sm" onClick={connect} disabled={!!busy || !ready.length}>{busy === 'connect' ? <Loader2 size={14} className="spin" /> : <Plug size={14} />} Connect Carla to both accounts</button>
          </div>
        </div>
        {error && <p className="sys-error" role="alert">{error}</p>}
        {results && (
          <ul className="sa-results" role="status">
            {results.map((r) => (
              <li key={r.workspace} className={r.ok && r.test?.ok !== false ? '' : 'sa-bad'}>
                <strong>{BRAND[r.workspace]} key:</strong> {DID[r.action] || ''}{r.action === 'updated' && r.changed?.length ? ` (${r.changed.join(', ')}).` : ''} {r.note || ''} {r.test?.note || ''}
              </li>
            ))}
          </ul>
        )}
        {setup?.sharedTeam && <p className="sys-muted sa-note">Both keys belong to the same Zernio team, so they share one webhook to Carla.</p>}
        {setup?.secrets && !setup.secrets.ZERNIO_WEBHOOK_SECRET && <p className="sys-alert">The ZERNIO_WEBHOOK_SECRET secret is not set in Supabase. Carla checks every delivery against it, so add it before connecting.</p>}
        {setup?.secrets?.ZERNIO_WEBHOOK_SECRET && !setup.secrets.ZERNIO_COLLECTIVE_WEBHOOK_SECRET && <p className="sys-muted sa-note">The Collective account’s webhook signs with the same secret as the Marketplace’s (ZERNIO_COLLECTIVE_WEBHOOK_SECRET is not set, which is fine).</p>}
      </section>

      {(setup?.workspaces || []).map((w) => {
        const hooks = (w.webhookIds || []).map((id) => hookById[id]).filter(Boolean);
        return (
          <section key={w.workspace} className="sys-card sa-ws">
            <div className="sa-ws__head">
              <h2><KeyRound size={18} /> {w.label} Zernio account</h2>
              <span className="sys-muted">{w.keyName}</span>
            </div>
            {!w.keySet ? <p className="sys-alert">No key is set. Add {w.keyName} in Supabase › Edge Functions › Secrets (Zernio › Settings › API keys makes one).</p> : (
              <>
                {!w.accountsOk && <p className="sys-error">Zernio would not list this account’s profiles ({w.accountsError}). Check that {w.keyName} is still a working key.</p>}
                {w.accountsOk && (w.accounts.length
                  ? <ul className="sa-accts">{w.accounts.map((a) => <Account key={a.id} a={a} now={new Date(setup.checkedAt).getTime()} />)}</ul>
                  : <p className="sys-muted">No Instagram, Facebook or TikTok profile is connected here.</p>)}

                <h3 className="sys-subhead">Carla’s webhook</h3>
                {!w.webhooksOk ? <p className="sys-error">Zernio would not list the webhooks ({w.webhooksError}).</p>
                  : w.problems.length ? <ul className="sa-problems">{w.problems.map((p) => <li key={p}><AlertTriangle size={14} /> {p}.</li>)}</ul>
                    : w.accounts?.length ? <p className="sa-good"><CheckCircle2 size={14} /> The webhook sends these profiles’ DMs and comments to Carla.</p> : null}
                {hooks.map((h) => {
                  if (shown.has(h.id)) return <p key={h.id} className="sys-muted sa-note">Same webhook as above (one shared Zernio team).</p>;
                  shown.add(h.id);
                  return <Hook key={h.id} h={h} />;
                })}

                {w.collisions?.map((c) => <p key={c} className="sys-alert"><AlertTriangle size={14} /> {c}</p>)}
                {w.automationsError && <p className="sys-muted sa-note">Could not check Zernio’s own automations and workflows ({w.automationsError}).</p>}
                {!w.automationsError && !w.collisions?.length && <p className="sys-muted sa-note">No Zernio automations or workflows are switched on, so only Carla answers.</p>}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default SocialAccounts;
