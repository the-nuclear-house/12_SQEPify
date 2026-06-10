import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useRef } from 'react';
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

// Overview sits apart from the core working areas.
const OVERVIEW: Tab[] = [{ to: '/', label: 'Dashboard', roles: ALL }];
const CORE: Tab[] = [
  { to: '/competencies', label: 'Nuclear Competencies', roles: TD },
  { to: '/trainings', label: 'Trainings', roles: TD },
  { to: '/consultants', label: 'Consultants', roles: TD },
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

function Pill({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => (isActive ? 'pill active' : 'pill')}
    >
      {label}
    </NavLink>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function AppShell() {
  const { user, signOut } = useAuth();
  const role = user?.product_role ?? 'consultant';
  const isConsultant = role === 'consultant';
  const overview = isConsultant ? [] : OVERVIEW.filter((t) => t.roles.includes(role));
  const core = isConsultant ? [] : CORE.filter((t) => t.roles.includes(role));
  const isSuperadmin = role === 'superadmin';
  const myProfile = isConsultant && user?.consultant_id ? `/consultants/${user.consultant_id}` : null;

  // Publish the topbar's height so full-screen overlays (e.g. the plan editor) can sit below it.
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener('resize', set);
    return () => { ro.disconnect(); window.removeEventListener('resize', set); };
  }, []);

  return (
    <div className="app-frame">
      <header className="topbar" ref={barRef}>
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
          {myProfile && <Pill to={myProfile} label="My profile" />}
          {isConsultant && user?.is_trainer && <Pill to="/" label="Deliveries" />}
          {overview.map((t) => (
            <Pill key={t.to} to={t.to} label={t.label} />
          ))}
          {overview.length > 0 && core.length > 0 && <span className="nav-divider" />}
          {core.map((t) => (
            <Pill key={t.to} to={t.to} label={t.label} />
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
          {isSuperadmin && (
            <NavLink
              to="/system"
              title="System"
              aria-label="System"
              className={({ isActive }) => (isActive ? 'icon-btn active' : 'icon-btn')}
            >
              <GearIcon />
            </NavLink>
          )}
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
