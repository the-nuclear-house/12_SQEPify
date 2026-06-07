import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function NotFound() {
  return (
    <div className="centre">
      <div className="centre-card">
        <span className="centre-logo">
          <Logo size={56} />
        </span>
        <div className="centre-word">404</div>
        <p>That page does not exist.</p>
        <Link className="btn btn-ghost btn-block" to="/">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
