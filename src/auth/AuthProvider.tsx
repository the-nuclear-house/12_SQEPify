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
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setUser(await fetchAppUser(data.session?.user.email));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      setUser(await fetchAppUser(next?.user.email));
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
        setUser(null);
        setSession(null);
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
