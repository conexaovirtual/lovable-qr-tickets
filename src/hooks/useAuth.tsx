import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface UserProfile {
  id: string;
  nome: string;
  telefone: string | null;
  company_id: string | null;
  avatar_url: string | null;
  phone_visibility?: 'everyone' | 'managers_only' | 'private';
  roles: string[];
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError && rolesError.code !== 'PGRST116') {
        console.error('[useAuth] Error fetching roles:', rolesError);
      }

      if (profileData) {
        setProfile({
          ...profileData,
          roles: rolesData?.map((r) => r.role) || [],
        });
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('[useAuth] Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Defer Supabase calls to prevent deadlock
      if (newSession?.user) {
        setTimeout(() => {
          fetchUserProfile(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchUserProfile(existingSession.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  }, [navigate]);

  const hasRole = useCallback(
    (role: string): boolean => profile?.roles?.includes(role) || false,
    [profile?.roles]
  );

  const isAdmin = useCallback((): boolean => hasRole('admin_provedor'), [hasRole]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      loading,
      signOut,
      isAuthenticated: !!user,
      hasRole,
      isAdmin,
    }),
    [user, session, profile, loading, signOut, hasRole, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
