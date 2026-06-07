import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { ProductRole } from '../lib/types';

interface Tab {
  to: string;
  label: string;
  /** Roles allowed to see this tab. */
  roles: ProductRole[];
}

const ALL: ProductRole[] = ['superadmin', 'technical_director', 'consultant'];
const TD: ProductRole[] = ['superadmin', 'technical_director'];

const TABS: Tab[] = [
  { to: '/', label: 'Dashboard', roles: ALL },
  { to: '/competencies', label: 'Nuclear Competencies', roles: TD },
  { to: '/trainings', label: 'Trainings', roles: TD },
  { to: '/consultants', label: 'Consultants', roles: TD },
  { to: '/system', label: 'System', roles: ['superadmin'] },
];

const ROLE_LABEL: Record<ProductRole, string> = {
  superadmin: 'Superadmin',
  technical_director: 'Technical Director',
  consultant: 'Consultant',
};

export default function AppShell() {
  const { user, signOut } = useAuth();
  const role = user?.product_role ?? 'consultant';
  const tabs = TABS.filter((t) => t.roles.includes(role));

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand">
          <span className="mark">
            SQEP<span className="em">ify</span>
          </span>
          <span className="tag">The Nuclear House</span>
        </div>
        <div className="user-chip">
          <div>
            <div>{user?.full_name ?? user?.email}</div>
            <div className="role">{ROLE_LABEL[role]}</div>
          </div>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
