import Card from '../components/Card';

export default function System() {
  return (
    <div>
      <div className="page-head">
        <h1>System</h1>
        <p>
          Create and manage users and assign product roles. Microsoft 365 handles
          sign in; this page controls who exists in SQEPify and what they may do.
        </p>
      </div>
      <Card title="User management">
        <p className="muted">
          The user table and Sync now control are built out in later steps. For now,
          the first superadmin is set directly in the database, as described in the
          changelog.
        </p>
        <span className="stub-note">build order steps 1, 2</span>
      </Card>
    </div>
  );
}
