import { useState } from 'react';
import { useAuth } from './AuthProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import Logo from '../components/Logo';

const TEST_LOGIN = import.meta.env.VITE_ENABLE_TEST_LOGIN === 'true';

// Test personas (created by docs/test-users.sql, password 123456). Temporary; remove before launch.
const PERSONAS = [
  { label: 'Superadmin', email: 'super@sqepify.test' },
  { label: 'Technical Director', email: 'td@sqepify.test' },
  { label: 'Consultant', email: 'consultant@sqepify.test' },
  { label: 'Trainer', email: 'trainer@sqepify.test' },
];

export default function Login() {
  const { signIn, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function testSignIn() {
    setBusy(true);
    setError(null);
    const { error } = await signInWithEmail(email.trim(), password);
    if (error) setError(error);
    setBusy(false);
  }

  async function quickSignIn(personaEmail: string) {
    setBusy(true);
    setError(null);
    const { error } = await signInWithEmail(personaEmail, '123456');
    if (error) setError(error);
    setBusy(false);
  }

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

        {TEST_LOGIN && (
          <div className="test-login">
            <div className="test-login-label">Test login (no SSO)</div>
            <div className="persona-grid">
              {PERSONAS.map((p) => (
                <button key={p.email} className="btn btn-sm persona-btn" onClick={() => quickSignIn(p.email)} disabled={busy}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="test-login-or">or sign in manually</div>
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
            />
            <button
              className="btn btn-block"
              onClick={testSignIn}
              disabled={busy || !email || !password}
            >
              {busy ? 'Signing in…' : 'Test sign in'}
            </button>
            {error && <div className="config-warn">{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
