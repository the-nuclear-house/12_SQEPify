import { useAuth } from './AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Login() {
  const { signIn } = useAuth();

  return (
    <div className="centre">
      <div className="centre-card">
        <span className="centre-logo">
          <Logo size={56} />
        </span>
        <div className="centre-word">
          SQEP<span className="em">ify</span>
        </div>
        <p>
          Nuclear competency and SQEP training for The Nuclear House. Sign in with
          your work account to continue.
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={signIn}
          disabled={!isSupabaseConfigured}
        >
          Sign in with Microsoft 365
        </button>
        {!isSupabaseConfigured && (
          <div className="config-warn">
            Supabase is not configured. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY in the environment.
          </div>
        )}
      </div>
    </div>
  );
}
