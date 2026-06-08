import { useState } from 'react';
import ApprovedTrainers from '../components/ApprovedTrainers';

type Tab = 'trainers' | 'catalogue';

export default function Trainings() {
  const [tab, setTab] = useState<Tab>('trainers');

  return (
    <div>
      <div className="page-head">
        <h1>Trainings</h1>
        <p>
          The approved trainers who can deliver training, and the catalogue of trainings
          themselves. A training can only list trainers that appear here.
        </p>
      </div>

      <div className="subtabs">
        <button className={tab === 'trainers' ? 'subtab active' : 'subtab'} onClick={() => setTab('trainers')}>
          Approved Trainers
        </button>
        <button className={tab === 'catalogue' ? 'subtab active' : 'subtab'} onClick={() => setTab('catalogue')}>
          Training Catalogue
        </button>
      </div>

      {tab === 'trainers' ? (
        <ApprovedTrainers />
      ) : (
        <div className="card">
          <p className="muted">
            The training catalogue is the next step. Each training will carry its title,
            the competency it addresses, the star band it moves someone through, a
            duration, and its approved deliverers chosen from the trainers tab.
          </p>
          <span className="stub-note">next: Training Catalogue</span>
        </div>
      )}
    </div>
  );
}
