import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [curatorData, setCuratorData] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const adminEmails = ['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'];

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsAdmin(adminEmails.includes(session.user.email?.toLowerCase()));
        fetchUserData(session.user.id);
      }
      else setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsAdmin(adminEmails.includes(session.user.email?.toLowerCase()));
        fetchUserData(session.user.id);
      }
      else {
        setProfile(null);
        setCuratorData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId) => {
    try {
      const { data: profileData, error: pError } = await supabase
        .from('profiles')
        .select('*')
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
        
      setProfile(profileData || null);
      setCuratorData(cData || null);
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

export const useAuth = () => useContext(AuthContext);
