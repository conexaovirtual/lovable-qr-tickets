import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export interface UserProfile {
  id: string;
  nome: string;
  telefone: string | null;
  role: 'admin_provedor' | 'tecnico' | 'gestor_cliente' | 'solicitante'; // Kept for backwards compatibility
  company_id: string | null;
  avatar_url: string | null;
  roles?: string[]; // New: primary roles from user_roles table
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST (non-async to prevent deadlock)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      if (import.meta.env.DEV) {
        console.log('[useAuth] Fetching profile for user:', userId);
      }
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (import.meta.env.DEV) {
        console.log('[useAuth] Profile data:', profileData);
        console.log('[useAuth] Profile error:', profileError);
      }
      
      if (profileError) throw profileError;
      
      // Fetch roles from user_roles table (SECURITY: Using separate table to prevent privilege escalation)
      if (import.meta.env.DEV) {
        console.log('[useAuth] Fetching roles for user:', userId);
      }
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (import.meta.env.DEV) {
        console.log('[useAuth] Roles data:', rolesData);
        console.log('[useAuth] Roles error:', rolesError);
      }
      
      if (rolesError && rolesError.code !== 'PGRST116') {
        console.error('[useAuth] Error fetching roles:', rolesError);
      }
      
      if (profileData) {
        const userProfile = {
          ...profileData,
          roles: rolesData?.map(r => r.role) || []
        };
        if (import.meta.env.DEV) {
          console.log('[useAuth] Setting profile:', userProfile);
        }
        setProfile(userProfile);
      } else {
        if (import.meta.env.DEV) {
          console.warn('[useAuth] No profile data found for user:', userId);
        }
        setProfile(null);
      }
    } catch (error) {
      console.error('[useAuth] Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const hasRole = (role: string): boolean => {
    return profile?.roles?.includes(role) || false;
  };

  const isAdmin = (): boolean => {
    return hasRole('admin_provedor');
  };

  return {
    user,
    session,
    profile,
    loading,
    signOut,
    isAuthenticated: !!user,
    hasRole,
    isAdmin,
  };
}
