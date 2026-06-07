import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export default function AuthCallback() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // The Supabase client picks up the session from the URL automatically
    // (detectSessionInUrl). Once that has resolved, leave the callback route.
    if (!loading) {
      navigate(session ? '/' : '/login', { replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <div className="centre">
      <div className="spinner" aria-label="Signing in" />
    </div>
  );
}
