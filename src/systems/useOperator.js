import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// Systems logins are ordinary Supabase accounts named
// <username>@systems.p31market.com. Access is granted only by a row in
// system_operators (see storefront_v18), never by the address itself.
export const SYSTEMS_EMAIL_DOMAIN = 'systems.p31market.com';

export const usernameToEmail = (username) => {
  const u = username.trim();
  return u.includes('@') ? u.toLowerCase() : `${u.toLowerCase()}@${SYSTEMS_EMAIL_DOMAIN}`;
};

// status: 'loading' | 'signed-out' | 'not-operator' | 'operator'
export const useOperator = () => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'loading', operator: null });
  // Dev-only layout preview (?devOperator). Compiled out of production builds;
  // the database still treats the visitor as anonymous, so nothing is exposed.
  const devPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('devOperator');

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return undefined;

    if (devPreview) {
      Promise.resolve().then(() => !cancelled && setState({
        status: 'operator',
        operator: { user_id: 'dev', username: 'Preview', display_name: 'Preview', role: 'owner' },
      }));
      return () => { cancelled = true; };
    }

    if (!user) {
      Promise.resolve().then(() => !cancelled && setState({ status: 'signed-out', operator: null }));
      return () => { cancelled = true; };
    }

    supabase
      .from('system_operators')
      .select('user_id, username, display_name, role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setState(data
          ? { status: 'operator', operator: data }
          : { status: 'not-operator', operator: null });
      });

    return () => { cancelled = true; };
  }, [user, authLoading, devPreview]);

  return { ...state, user: user || (devPreview ? { id: 'dev' } : null) };
};
