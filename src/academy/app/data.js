import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// { program: {id, slug, title}, user, isMentor, isAdmin, preview }
export const AcademyContext = createContext(null);
export const useAcademy = () => useContext(AcademyContext);

/**
 * Load rows from Supabase and keep them fresh.
 *   const { data, loading, error, reload } = useRows(() => supabase.from(...)..., [deps])
 * The query runs only when every dependency is truthy-or-zero (skips while ids are unknown).
 */
export function useRows(query, deps, { initial = [] } = {}) {
  const [state, setState] = useState({ data: initial, loading: true, error: null });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(deps);
  useEffect(() => {
    let live = true;
    const ready = deps.every((d) => d !== null && d !== undefined && d !== '');
    if (!ready) {
      Promise.resolve().then(() => live && setState({ data: initial, loading: false, error: null }));
      return () => { live = false; };
    }
    Promise.resolve(query()).then(({ data, error }) => {
      if (live) setState({ data: data ?? initial, loading: false, error: error ? error.message : null });
    });
    return () => { live = false; };
  }, [key, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

/** The current time, refreshed every minute (for "live now" badges). */
export function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Run a write and surface a friendly error. Returns { data, error }. */
export async function write(promise) {
  const { data, error } = await promise;
  if (error) console.warn('academy write:', error.message);
  return { data, error: error ? (error.message.includes('row-level security') ? 'You don’t have permission to do that.' : error.message) : null };
}

/** Live-update a table filtered to one column value. */
export function useRealtime(table, column, value, onChange) {
  useEffect(() => {
    if (!value) return undefined;
    const ch = supabase.channel(`${table}:${column}:${value}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `${column}=eq.${value}` }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table, column, value, onChange]);
}
