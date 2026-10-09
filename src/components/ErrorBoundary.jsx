import React from 'react';

import { CHUNK_ERROR, reloadOnceForNewVersion } from '../lib/reload';

/** Shows a friendly message (with the actual error) instead of a blank page. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page error:', error, info?.componentStack);
    if (CHUNK_ERROR.test(String(error?.message || error))) reloadOnceForNewVersion();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#12081d', color: '#fff', fontFamily: 'Manrope, system-ui, sans-serif' }}>
        <div style={{ maxWidth: 460, textAlign: 'center', display: 'grid', gap: 14 }}>
          <h1 style={{ margin: 0, fontFamily: '"Noto Serif", serif', fontWeight: 400, fontSize: '2rem' }}>Something went <em style={{ color: '#F2CE4D' }}>wrong</em></h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,.75)' }}>Reloading usually fixes it. If it keeps happening, send this message to the P31 team:</p>
          <code style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,.08)', padding: '10px 12px', borderRadius: 12, color: '#F2CE4D', overflowWrap: 'anywhere' }}>{String(error?.message || error).slice(0, 300)}</code>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 22px', borderRadius: 999, border: 0, fontWeight: 800, background: '#F2CE4D', color: '#2a1a00', cursor: 'pointer' }}>Reload</button>
            <a href="/portal?choose" style={{ padding: '12px 22px', borderRadius: 999, fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,.3)', textDecoration: 'none' }}>My dashboards</a>
          </div>
        </div>
      </div>
    );
  }
}
