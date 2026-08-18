import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, setClientReadOnly } from '../lib/supabase';
import type { AppUser } from '../lib/types';

interface AuthState {
  session: Session | null;
  /**
   * Who the app should behave as. Normally the signed-in person, but while a
   * superadmin is viewing as someone else it is that person, so every screen,
   * tab and permission check follows without needing to know about view-as.
   */
  user: AppUser | null;
  /** Who is actually signed in. Only differs from `user` during view-as. */
  realUser: AppUser | null;
  /** The person being viewed as, or null. */
  viewAs: AppUser | null;
  isViewingAs: boolean;
  /** Superadmin only. Anyone else calling this is ignored. */
  startViewAs: (u: AppUser) => void;
  stopViewAs: () => void;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
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
  const appUser = (data as AppUser) ?? null;
  if (appUser) {
    // A user is a trainer if they're linked to a row on the Approved Trainers list.
    const { data: tr } = await supabase.from('trainers').select('id').eq('user_id', appUser.id).eq('is_active', true).limit(1);
    appUser.is_trainer = (tr?.length ?? 0) > 0;
  }
  return appUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [viewAs, setViewAs] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // View-as is read-only: the database session still belongs to the superadmin,
  // so any write would be recorded against the wrong person.
  useEffect(() => {
    setClientReadOnly(!!viewAs);
    return () => setClientReadOnly(false);
  }, [viewAs]);

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
      setViewAs(null);
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
      user: viewAs ?? user,
      realUser: user,
      viewAs,
      isViewingAs: !!viewAs,
      startViewAs: (u: AppUser) => {
        if (user?.product_role !== 'superadmin') return;
        if (u.id === user.id) return;
        setViewAs(u);
        // Resolve their trainer flag the same way a real sign-in would, so the
        // Deliveries tab appears exactly when it would for them.
        supabase
          .from('trainers')
          .select('id')
          .eq('user_id', u.id)
          .eq('is_active', true)
          .limit(1)
          .then(({ data }) =>
            setViewAs((cur) =>
              cur && cur.id === u.id ? { ...cur, is_trainer: (data?.length ?? 0) > 0 } : cur,
            ),
          );
      },
      stopViewAs: () => setViewAs(null),
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
      signInWithEmail: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? error.message : null };
      },
      signOut: async () => {
        setViewAs(null);
        await supabase.auth.signOut();
      },
    }),
    [session, user, viewAs, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
