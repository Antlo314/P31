import React, { useMemo, useState } from 'react';
import { Compass, Play, ListOrdered, ArrowUpRight, ClipboardCheck, Printer, RotateCcw, Check } from 'lucide-react';
import { useRoles } from '../../lib/roles';
import { dashboardsOf } from '../../lib/dashboards';
import { hrefFor } from '../../lib/site';
import { startTour } from '../../components/tourEvents';
import { allChapters, CHAPTER_GROUPS } from '../walkthroughs';
import { TEST_RUNS, WHO } from '../../lib/testRuns';
import { SITES } from '../nav';

const KEY = 'p31_test_runs';
const readDone = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

const Chapter = ({ c, admin }) => {
  const external = !!c.href;
  const href = external ? hrefFor(c.href) : null;
  const sameSite = external && href === c.href;
  return (
    <article className="wk-card">
      <h3><Compass size={16} /> {c.title}</h3>
      <p>{c.blurb || c.steps?.[0]?.body || ''}</p>
      <span className="wk-card__meta">{c.site !== 'both' ? `${SITES[c.site]?.label} · ` : ''}{c.minutes} min{c.steps ? ` · ${c.steps.length} steps` : ''}{c.dash === 'admin' ? ' · admins' : ''}</span>
      <div className="wk-card__actions">
        {external ? (
          <a className="sys-btn sys-btn--gold sys-btn--sm" href={`${href}${href.includes('?') ? '&' : '?'}auto=1`}><Play size={13} /> Play{sameSite ? '' : ' there'} {!sameSite && <ArrowUpRight size={12} />}</a>
        ) : (
          <>
            <button type="button" className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => startTour(c.id, { autoplay: true })}><Play size={13} /> Play</button>
            <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => startTour(c.id)}><ListOrdered size={13} /> Step by step</button>
          </>
        )}
        {!admin && c.dash === 'admin' && <span className="sys-muted" style={{ fontSize: '0.78rem', alignSelf: 'center' }}>Admins only</span>}
      </div>
    </article>
  );
};

// Systems → Walkthroughs: every animated walkthrough, and the test runs that prove each function.
const Walkthroughs = () => {
  const { roles, status } = useRoles();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') === 'tests' ? 'tests' : 'learn');
  const [done, setDone] = useState(readDone);
  const admin = status === 'ready' && !!(roles.admin || roles.operator);
  const chapters = useMemo(() => {
    const mine = status === 'ready' ? dashboardsOf(roles) : [];
    return allChapters().filter((c) => admin || c.dash === 'team' || (c.dash !== 'admin' && mine.includes(c.dash)));
  }, [admin, status, roles]);
  const groups = CHAPTER_GROUPS.map((g) => [g, chapters.filter((c) => c.group === g)]).filter(([, list]) => list.length);
  const tests = TEST_RUNS.filter((t) => admin || t.who === 'team' || t.who === 'visitor' || t.who === 'vendor' || t.who === 'student');

  const save = (next) => { setDone(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode */ } };
  const toggleStep = (t, i) => save({ ...done, [`${t.id}:${i}`]: !done[`${t.id}:${i}`] });
  const markAll = (t, on) => save({ ...done, ...Object.fromEntries(t.steps.map((_, i) => [`${t.id}:${i}`, on])) });
  const countDone = (t) => t.steps.filter((_, i) => done[`${t.id}:${i}`]).length;
  const totalDone = tests.reduce((n, t) => n + (countDone(t) === t.steps.length ? 1 : 0), 0);
  const chapterOf = (id) => chapters.find((c) => c.id === id);

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Team</p>
        <h1>Walkthroughs</h1>
        <p className="sys-muted">Every function, shown in a minute: press Play and a pointer walks through the screen, or go step by step. Test runs are the scripts that prove each one works on the live sites.</p>
      </header>

      <div className="sys-chips" role="tablist" style={{ marginBottom: 16 }} data-tour="wk-tabs">
        <button role="tab" aria-selected={tab === 'learn'} className={`sys-chip ${tab === 'learn' ? 'is-on' : ''}`} onClick={() => setTab('learn')}><Compass size={14} /> Walkthroughs · {chapters.length}</button>
        <button role="tab" aria-selected={tab === 'tests'} className={`sys-chip ${tab === 'tests' ? 'is-on' : ''}`} onClick={() => setTab('tests')}><ClipboardCheck size={14} /> Test runs · {tests.length}</button>
      </div>

      {tab === 'learn' && (
        <div className="wk-groups">
          {groups.map(([g, list]) => (
            <section key={g} className="wk-group">
              <h2>{g}</h2>
              <div className="wk-grid">{list.map((c) => <Chapter key={c.id} c={c} admin={admin} />)}</div>
            </section>
          ))}
        </div>
      )}

      {tab === 'tests' && (
        <>
          <div className="wk-bar">
            <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => window.print()}><Printer size={14} /> Print the test sheet</button>
            <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => save({})}><RotateCcw size={14} /> Reset checklist</button>
            <span className="sys-muted">{totalDone} of {tests.length} test runs complete on this device. Use TEST in names so test rows are easy to find and remove.</span>
          </div>
          <div className="wk-tests">
            {tests.map((t) => {
              const n = countDone(t);
              const all = n === t.steps.length;
              const ch = t.tour ? chapterOf(t.tour) : null;
              return (
                <details key={t.id} className="wk-test">
                  <summary className="wk-test__sum">
                    <strong>{t.title}</strong>
                    <span className="sys-muted">{WHO[t.who]} · {t.site === 'both' ? 'both sites' : SITES[t.site]?.host} · about {t.minutes} min</span>
                    <span className={`wk-test__done ${all ? 'is-all' : ''}`}>{all ? <><Check size={12} /> Done</> : `${n}/${t.steps.length}`}</span>
                  </summary>
                  <div className="wk-test__body">
                    <div>
                      <h4>Do this</h4>
                      <ol className="wk-steps">
                        {t.steps.map((s, i) => (
                          <li key={i} className={done[`${t.id}:${i}`] ? 'is-done' : ''}>
                            <input type="checkbox" checked={!!done[`${t.id}:${i}`]} onChange={() => toggleStep(t, i)} aria-label={`Step ${i + 1} done`} />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div><h4>What should happen</h4><ul className="wk-expect">{t.expect.map((e) => <li key={e}>{e}</li>)}</ul></div>
                    <div><h4>Afterwards</h4><p className="sys-muted" style={{ margin: 0, fontSize: '0.88rem' }}>{t.cleanup}</p></div>
                    <div className="wk-card__actions">
                      <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => markAll(t, !all)}>{all ? 'Mark not done' : 'Mark all done'}</button>
                      {ch && (ch.href
                        ? <a className="sys-btn sys-btn--ghost sys-btn--sm" href={hrefFor(ch.href)}><Play size={13} /> Show me the screen</a>
                        : <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => startTour(ch.id, { autoplay: true })}><Play size={13} /> Show me the screen</button>)}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Walkthroughs;
