import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import Logo from '../components/Logo';

export default function Login() {
  const { signIn, signInWithEmail, session } = useAuth();
  const [manual, setManual] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manualSignIn() {
    setBusy(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  }

  function toggleManual() {
    setError(null);
    setManual((open) => !open);
  }

  // Once a session exists (password or SSO), leave the login screen.
  if (session) return <Navigate to="/" replace />;

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

        <div className="manual-login">
          <button
            className="btn btn-sm btn-ghost manual-login-toggle"
            onClick={toggleManual}
            aria-expanded={manual}
          >
            {manual ? 'Hide manual sign in' : 'Sign in manually'}
          </button>

          {manual && (
            <div className="manual-login-fields">
              <input
                className="field"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
              <input
                className="field"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && email && password && !busy) manualSignIn();
                }}
              />
              <button
                className="btn btn-block"
                onClick={manualSignIn}
                disabled={busy || !email || !password}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
              {error && <div className="config-warn">{error}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
