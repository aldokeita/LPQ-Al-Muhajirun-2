
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigurationMessage } from '@/lib/customSupabaseClient';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSession = useCallback(async (currentSession) => {
    try {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      
      let userRole = null;
      if (currentUser) {
        // Detects guru role from auth.users raw_user_meta_data safely
        userRole = currentUser.user_metadata?.role || 
                   currentUser.app_metadata?.role || 
                   (currentUser.email?.includes('admin') ? 'admin' : null);
        
        console.log('[AuthContext] Auth state updated: User logged in', { 
          id: currentUser.id, 
          extractedRole: userRole,
          rawMetadata: currentUser.user_metadata,
          email: currentUser.email
        });
      } else {
        console.log('[AuthContext] Auth state updated: No user session');
      }
      
      setRole(userRole);
    } catch (error) {
      console.error('[AuthContext] Error handling session:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.warn('[AuthContext] Supabase is not configured. Auth session loading is skipped.');
      setLoading(false);
      return undefined;
    }

    const getSession = async () => {
      try {
        console.log('[AuthContext] Initializing auth session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        await handleSession(session);
      } catch (error) {
        console.error('[AuthContext] Failed to get initial session:', error);
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log(`[AuthContext] Auth event triggered: ${event}`);
        await handleSession(currentSession);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const signUp = useCallback(async (email, password, options) => {
    if (!isSupabaseConfigured) {
      const error = new Error(supabaseConfigurationMessage);
      toast({
        variant: "destructive",
        title: "Supabase belum dikonfigurasi",
        description: error.message,
      });
      return { error };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign up Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) {
      const error = new Error(supabaseConfigurationMessage);
      toast({
        variant: "destructive",
        title: "Supabase belum dikonfigurasi",
        description: error.message,
      });
      return { error, user: null };
    }

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in Failed",
        description: error.message || "Something went wrong",
      });
    }

    return { error, user: data?.user };
  }, [toast]);

  // Custom Sign In to handle email auth and santri username via RPC.
  const signInWithUsername = useCallback(async (rawUsername, rawPassword) => {
    try {
      const username = rawUsername.trim();
      const password = rawPassword.trim();
      console.log('[AuthContext] Login attempt:', { username });

      if (!isSupabaseConfigured) {
        throw new Error(supabaseConfigurationMessage);
      }
      
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username);

      // Step 1: Standard Auth (Email) strictly for admin/guru registered via Supabase Auth
      if (isEmail) {
        console.log('[AuthContext] Input is email, attempting standard auth...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: username,
          password: password,
        });

        console.log('signInWithPassword response:', { data, error });

        if (error) {
          throw new Error('Email atau Password Salah');
        }

        if (data?.user) {
          return { user: data.user, error: null };
        }
      }

      // Step 2: Try RPC signin_with_username for santri Nomor Induk Qiroati + password.
      console.log('[AuthContext] Attempting RPC signin_with_username...');
      const { data: rpcData, error: rpcError } = await supabase.rpc('signin_with_username', {
        p_username: username,
        p_password: password
      });

      console.log('RPC signin_with_username response:', { rpcData, rpcError });

      if (rpcError) {
        throw new Error(rpcError.message || 'RPC signin_with_username belum tersedia.');
      }

      if (rpcData && rpcData.access_token) {
        const sessionObject = {
          access_token: rpcData.access_token,
          refresh_token: rpcData.refresh_token
        };

        const { data: sessionData, error: sessionError } = await supabase.auth.setSession(sessionObject);
        
        if (!sessionError && sessionData?.user) {
          console.log('Session created via RPC:', sessionData.session);
          return { user: sessionData.user, error: null };
        }
      }

      throw new Error('Nomor Induk Qiroati atau password salah, atau RPC signin_with_username belum tersedia.');

    } catch (error) {
      console.error('Login Error:', error);
      return { user: null, error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      // Manually trigger handle session to clear UI immediately if there was a mock session
      await handleSession(null);

      if (error) {
        console.warn('[AuthContext] Supabase signout note:', error.message);
      }
      console.log('[AuthContext] User signed out successfully');
    } catch (error) {
      console.error('[AuthContext] Error signing out:', error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message || "Something went wrong",
      });
      return { error };
    }
    return { error: null };
  }, [toast, handleSession]);

  const value = useMemo(() => ({
    user,
    session,
    role,
    loading,
    signUp,
    signIn,
    signInWithUsername,
    signOut,
  }), [user, session, role, loading, signUp, signIn, signInWithUsername, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
