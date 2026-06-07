import { useAuth } from '../auth/AuthProvider';
import Card from '../components/Card';

export default function Dashboard() {
  const { user } = useAuth();
  const isConsultant = user?.product_role === 'consultant';

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>
          {isConsultant
            ? 'Your SQEP journey at a glance: your assessment status and your next training.'
            : 'Your consultants and where each one sits in the SQEP journey.'}
        </p>
      </div>

      <div className="grid cols-3">
        <Card title="Welcome">
          <p className="muted">
            You are signed in as {user?.email}. The dashboard summary is built in
            the final step once the workflow pages exist.
          </p>
          <span className="stub-note">build order step 8</span>
        </Card>
      </div>
    </div>
  );
}
