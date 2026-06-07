import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="centre">
      <div className="centre-card">
        <div className="mark">404</div>
        <p>That page does not exist.</p>
        <Link className="btn btn-ghost btn-block" to="/">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
