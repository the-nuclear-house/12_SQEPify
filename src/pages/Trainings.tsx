import { useState } from 'react';
import ApprovedTrainers from '../components/ApprovedTrainers';
import TrainingCatalogue from '../components/TrainingCatalogue';

type Tab = 'catalogue' | 'trainers';

export default function Trainings() {
  const [tab, setTab] = useState<Tab>('catalogue');

  return (
    <div>
      <div className="page-head">
        <h1>Trainings</h1>
      </div>

      <div className="subtabs">
        <button className={tab === 'catalogue' ? 'subtab active' : 'subtab'} onClick={() => setTab('catalogue')}>
          Training Catalogue
        </button>
        <button className={tab === 'trainers' ? 'subtab active' : 'subtab'} onClick={() => setTab('trainers')}>
          Approved Trainers
        </button>
      </div>

      {tab === 'catalogue' ? (
        <TrainingCatalogue />
      ) : (
        <ApprovedTrainers />
      )}
    </div>
  );
}
