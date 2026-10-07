import React, { useEffect, useMemo, useState } from 'react';
import { Search, ExternalLink, Bookmark, BookmarkCheck, Download, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AiAssist from '../../components/AiAssist';

const SOURCES = [
  { id: 'facebook_groups', label: 'Facebook groups', hint: 'women entrepreneurs Atlanta' },
  { id: 'instagram_people', label: 'Instagram people', hint: 'atlanta handmade jewelry' },
  { id: 'instagram_hashtag', label: 'Instagram hashtag', hint: '#blackwomenowned' },
  { id: 'tiktok_creators', label: 'TikTok creators', hint: 'faith based small business' },
  { id: 'meetup_groups', label: 'Meetup groups', hint: 'women in business Georgia' },
  { id: 'linkedin_groups', label: 'LinkedIn groups', hint: 'female founders network' },
  { id: 'eventbrite', label: 'Eventbrite events', hint: 'vendor market Atlanta' },
  { id: 'web', label: 'Whole web', hint: 'Christian women business association Georgia' },
];

const STATUSES = ['new', 'contacted', 'joined', 'partner', 'ignore'];

const fmt = (n) => (n == null ? null : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n));

const csv = (rows) => {
  const cols = ['platform', 'kind', 'name', 'url', 'audience_size', 'status', 'notes', 'source_query', 'created_at'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

const Growth = () => {
  const [tab, setTab] = useState('search');
  const [source, setSource] = useState(SOURCES[0].id);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [saved, setSaved] = useState([]);
  const [filter, setFilter] = useState('active');

  const savedUrls = useMemo(() => new Set(saved.map((p) => p.url)), [saved]);
  const hint = SOURCES.find((s) => s.id === source)?.hint;

  const loadSaved = () =>
    supabase.from('social_prospects').select('*').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setSaved(data || []));

  useEffect(() => { loadSaved(); }, []);

  const runSearch = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setResults([]);
    const { data, error: fnError } = await supabase.functions.invoke('social-search', {
      body: { action: 'search', source, query, limit },
    });
    setBusy(false);
    if (fnError) return setError('Search service isn’t reachable — deploy the social-search function.');
    if (data?.error) return setError(data.error);
    setResults(data.results || []);
    if (!data.results?.length) setError('No results — try broader words.');
  };

  const save = async (p) => {
    const { error: saveError } = await supabase.from('social_prospects').upsert({
      platform: p.platform, kind: p.kind, name: p.name, url: p.url,
      audience_size: p.audience_size, description: p.description, source_query: query,
    }, { onConflict: 'url' });
    if (!saveError) loadSaved();
  };

  const update = async (id, patch) => {
    setSaved((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await supabase.from('social_prospects').update(patch).eq('id', id);
  };

  const shown = saved.filter((p) => (filter === 'active' ? p.status !== 'ignore' : filter === 'all' ? true : p.status === filter));

  const exportCsv = () => {
    const blob = new Blob([csv(shown)], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'p31-prospects.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Growth</p>
        <h1>Find your people</h1>
        <p className="sys-muted">Search public groups, creators and events that fit P31, then track outreach.</p>
      </header>

      <div className="sys-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'search'} onClick={() => setTab('search')}><Search size={16} /> Search</button>
        <button role="tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}><Users size={16} /> Prospects <span className="sys-pill">{saved.length}</span></button>
      </div>

      {tab === 'search' && (
        <>
          <form className="sys-card sys-form" onSubmit={runSearch}>
            <div className="sys-chips" role="radiogroup" aria-label="Where to search">
              {SOURCES.map((s) => (
                <button type="button" key={s.id} role="radio" aria-checked={source === s.id}
                  className={`sys-chip ${source === s.id ? 'is-on' : ''}`} onClick={() => setSource(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="sys-row">
              <label className="sys-field sys-grow">
                <span>Search for</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`e.g. ${hint}`} required />
              </label>
              <label className="sys-field">
                <span>Results</span>
                <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <button className="sys-btn sys-btn--gold" disabled={busy}>
              {busy ? 'Searching… (up to 2 min)' : <><Search size={16} /> Search</>}
            </button>
            {error && <p className="sys-error">{error}</p>}
          </form>

          <div className="sys-results">
            {results.map((p) => (
              <article className="sys-result" key={p.url}>
                <div className="sys-result__main">
                  <span className="sys-pill">{p.platform} · {p.kind}</span>
                  <h3>{p.name || p.url}</h3>
                  {p.description && <p>{p.description}</p>}
                  <div className="sys-result__meta">
                    {fmt(p.audience_size) && <span>{fmt(p.audience_size)} followers</span>}
                    <a href={p.url} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a>
                  </div>
                </div>
                <button className={`sys-icon-btn ${savedUrls.has(p.url) ? 'is-on' : ''}`} onClick={() => save(p)}
                  aria-label={savedUrls.has(p.url) ? 'Saved' : 'Save prospect'} disabled={savedUrls.has(p.url)}>
                  {savedUrls.has(p.url) ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      {tab === 'saved' && (
        <>
          <div className="sys-row sys-row--center">
            <div className="sys-chips">
              {['active', ...STATUSES, 'all'].map((s) => (
                <button key={s} className={`sys-chip ${filter === s ? 'is-on' : ''}`} onClick={() => setFilter(s)}>{s}</button>
              ))}
            </div>
            <button className="sys-btn sys-btn--ghost" onClick={exportCsv} disabled={!shown.length}><Download size={16} /> CSV</button>
          </div>

          {shown.length === 0 && <p className="sys-empty">No prospects here yet — save some from Search.</p>}

          <div className="sys-results">
            {shown.map((p) => (
              <article className="sys-result" key={p.id}>
                <div className="sys-result__main">
                  <span className="sys-pill">{p.platform} · {p.kind}</span>
                  <h3>{p.name || p.url}</h3>
                  {p.description && <p>{p.description}</p>}
                  <div className="sys-result__meta">
                    {fmt(p.audience_size) && <span>{fmt(p.audience_size)} followers</span>}
                    {p.source_query && <span>“{p.source_query}”</span>}
                    <a href={p.url} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a>
                  </div>
                  <div className="sys-row">
                    <select value={p.status} onChange={(e) => update(p.id, { status: e.target.value })} aria-label="Status">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                                        <input className="sys-grow" defaultValue={p.notes || ''} placeholder="Notes"
                      onBlur={(e) => e.target.value !== (p.notes || '') && update(p.id, { notes: e.target.value })} />
                  </div>
                  <AiAssist compact task="outreach" label="Draft outreach message"
                    getInput={() => ({ name: p.name, platform: p.platform, about: p.description || p.source_query })} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Growth;
