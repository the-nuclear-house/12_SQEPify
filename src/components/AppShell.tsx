import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { ProductRole } from '../lib/types';
import Logo from './Logo';

interface Tab {
  to: string;
  label: string;
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

function initials(name: string | null | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const role = user?.product_role ?? 'consultant';
  const tabs = TABS.filter((t) => t.roles.includes(role));

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand">
          <span className="logo">
            <Logo size={32} />
          </span>
          <div>
            <div className="brand-word">
              SQEP<span className="em">ify</span>
            </div>
            <div className="brand-tag">The Nuclear House</div>
          </div>
        </div>

        <nav className="navpills">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) => (isActive ? 'pill active' : 'pill')}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="user-chip">
          <div className="user-meta">
            <div className="name">{user?.full_name ?? user?.email}</div>
            <div className="role">{ROLE_LABEL[role]}</div>
          </div>
          <div className="avatar" aria-hidden="true">
            {initials(user?.full_name, user?.email)}
          </div>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
