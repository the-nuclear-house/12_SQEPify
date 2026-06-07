import Card from '../components/Card';

export default function Competencies() {
  return (
    <div>
      <div className="page-head">
        <h1>Nuclear Competencies</h1>
        <p>
          The competency library: Standard competencies that apply to everyone, and
          Role Based competencies organised by engineering role. Each carries the 0 to
          4 star scale and a learning path of trainings per level.
        </p>
      </div>
      <Card>
        <p className="muted">The library and learning paths are built next.</p>
        <span className="stub-note">build order step 3</span>
      </Card>
    </div>
  );
}
