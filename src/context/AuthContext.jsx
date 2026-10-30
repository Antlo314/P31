import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [curatorData, setCuratorData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  // Whose data is loaded: a token refresh or a tab coming back into focus re-sends "signed in" for the
  // same person, and reloading then would replace what a vendor is typing with the last saved copy.
  const loadedFor = useRef(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) { loadedFor.current = session.user.id; fetchUserData(session.user.id); }
      else setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Only a different person (or a profile change) needs a reload.
        if (loadedFor.current === session.user.id && event !== 'USER_UPDATED') return;
        loadedFor.current = session.user.id;
        fetchUserData(session.user.id);
      }
      else {
        loadedFor.current = null;
        setProfile(null);
        setCuratorData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Admins come from the database (site_admins, managed in Systems → Team access), not from this file.
  const fetchUserData = async (userId) => {
    try {
      const adminCheck = supabase.rpc('is_admin').then(({ data }) => setIsAdmin(data === true), () => setIsAdmin(false));
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, created_at')
        .eq('id', userId)
        .single();
      
      if (pError && pError.code !== 'PGRST116') {
        console.warn('Profile fetch error:', pError.message);
      }
      
      const { data: cData, error: cError } = await supabase
        .from('curator_data')
        .select('*')
        .eq('id', userId)
        .single();

      if (cError && cError.code !== 'PGRST116') {
        console.warn('Curator data fetch error:', cError.message);
      }
        
      await adminCheck;
      // Keep the same object when nothing changed, so screens built from it are not reset.
      setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(profileData || null) ? prev : profileData || null));
      setCuratorData((prev) => (JSON.stringify(prev) === JSON.stringify(cData || null) ? prev : cData || null));
    } catch (error) {
      console.error('Unexpected error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, curatorData, isAdmin, loading, signOut, fetchUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

// The hook lives beside its provider on purpose; fast refresh just reloads this file.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
