import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True when both values are present. The Login page uses this to show a clear
// message rather than failing silently if the environment is not configured.
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
