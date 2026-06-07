import Card from '../components/Card';

export default function Trainings() {
  return (
    <div>
      <div className="page-head">
        <h1>Trainings</h1>
        <p>
          The training catalogue: name, description, duration and the people who can
          deliver each one. Trainings are referenced by competency learning paths and
          by generated plans.
        </p>
      </div>
      <Card>
        <p className="muted">The catalogue is built alongside the competency library.</p>
        <span className="stub-note">build order step 3</span>
      </Card>
    </div>
  );
}
