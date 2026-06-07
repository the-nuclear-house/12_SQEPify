import { useAuth } from '../auth/AuthProvider';
import Logo from '../components/Logo';

export default function NoAccess() {
  const { user, session, signOut } = useAuth();
  const email = session?.user.email;

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
          You are signed in{email ? ` as ${email}` : ''}, but this account has no
          active access yet. Ask a SQEPify administrator to add you.
        </p>
        {!user && (
          <button className="btn btn-ghost btn-block" onClick={signOut}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
