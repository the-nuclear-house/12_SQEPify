import Card from '../components/Card';

export default function Consultants() {
  return (
    <div>
      <div className="page-head">
        <h1>Consultants</h1>
        <p>
          Consultants pulled read only from the Control Room, filtered so a Technical
          Director sees their own and a superadmin sees all. Each profile drives the
          SQEP workflow.
        </p>
      </div>
      <Card>
        <p className="muted">
          The Control Room sync and the consultant list come next.
        </p>
        <span className="stub-note">build order step 2</span>
      </Card>
    </div>
  );
}
