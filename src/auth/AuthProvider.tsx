import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../lib/types';

interface AuthState {
  session: Session | null;
  /** The matched, active row from the users table, or null if no access. */
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function fetchAppUser(email: string | undefined): Promise<AppUser | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, product_role, consultant_id, is_active')
    .ilike('email', email)
    .eq('is_active', true)
    .maybeSingle();
  if (error) {
    console.error('Failed to load user record:', error.message);
    return null;
  }
  return (data as AppUser) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Only update the session here. Crucially, do NOT call other supabase methods
  // (or await anything) inside this callback: the client holds an internal lock
  // during auth events, and calling back into it here can deadlock the whole app.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the app user separately, whenever the signed-in email changes. This runs
  // outside the auth callback, so it cannot deadlock. A background token refresh
  // does not change the email, so it does not trigger a refetch.
  const email = session?.user?.email;
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    if (!email) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchAppUser(email).then((u) => {
      if (!active) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authReady, email]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      loading,
      signIn: async () => {
        await supabase.auth.signInWithOAuth({
          provider: 'azure',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            scopes: 'openid profile email',
          },
        });
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
