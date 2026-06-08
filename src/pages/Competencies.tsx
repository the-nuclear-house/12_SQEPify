import { useState } from 'react';
import CompetencyLibrary from '../components/CompetencyLibrary';
import CompetencyRoles from '../components/CompetencyRoles';

type Tab = 'library' | 'roles';

export default function Competencies() {
  const [tab, setTab] = useState<Tab>('library');

  return (
    <div>
      <div className="page-head">
        <h1>Nuclear Competencies</h1>
        <p>
          The library defines every competency. Roles group them into what a given role
          must hold. Everyone is assessed against Base Nuclear, plus any roles you select.
        </p>
      </div>

      <div className="subtabs">
        <button className={tab === 'library' ? 'subtab active' : 'subtab'} onClick={() => setTab('library')}>Library</button>
        <button className={tab === 'roles' ? 'subtab active' : 'subtab'} onClick={() => setTab('roles')}>Roles</button>
      </div>

      {tab === 'library' ? <CompetencyLibrary /> : <CompetencyRoles />}
    </div>
  );
}
