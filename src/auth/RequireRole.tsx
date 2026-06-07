import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import type { ProductRole } from '../lib/types';

export default function RequireRole({
  children,
  allow,
}: {
  children: ReactNode;
  /** If omitted, any signed-in active user is allowed. */
  allow?: ProductRole[];
}) {
  const { loading, session, user } = useAuth();

  if (loading) {
    return (
      <div className="centre">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Signed in via SSO, but no active record in the users table.
  if (!user) return <Navigate to="/no-access" replace />;

  if (allow && !allow.includes(user.product_role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
