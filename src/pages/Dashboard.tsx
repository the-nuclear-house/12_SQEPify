import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import TrainerDeliveries from '../components/TrainerDeliveries';
import type { Consultant, Assessment } from '../lib/types';

type Stage = 'setup' | 'self' | 'validate' | 'plan' | 'done';

const STAGE: Record<Stage, { label: string; cls: string }> = {
  setup: { label: 'Needs set-up', cls: 'st-setup' },
  self: { label: 'Awaiting self-assessment', cls: 'st-self' },
  validate: { label: 'Awaiting your validation', cls: 'st-validate' },
  plan: { label: 'In planning', cls: 'st-plan' },
  done: { label: 'Nuclearised', cls: 'st-done' },
};

function stageOf(status: Assessment['status'] | undefined): Stage {
  switch (status) {
    case 'self_assessment': return 'self';
    case 'validation': return 'validate';
    case 'planning':
    case 'plan_review': return 'plan';
    case 'delivered': return 'done';
    default: return 'setup';
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.product_role ?? 'consultant';

  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [asmts, setAsmts] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | 'all'>('all');

  const isStaff = role === 'superadmin' || role === 'technical_director';
  const isTrainer = !!user?.is_trainer;

  useEffect(() => {
    if (!isStaff) return;
    (async () => {
      const [c, a] = await Promise.all([
        supabase.from('consultants').select('*').eq('is_active', true).order('full_name'),
        supabase.from('assessments').select('*').neq('status', 'cancelled').order('created_at', { ascending: false }),
      ]);
      const err = c.error || a.error;
      if (err) { setError(err.message); setLoading(false); return; }
      setConsultants((c.data as Consultant[]) ?? []);
      setAsmts((a.data as Assessment[]) ?? []);
      setLoading(false);
    })();
  }, [isStaff]);

  // Latest assessment per consultant (assessments already sorted newest first).
  const latestByConsultant = useMemo(() => {
    const m: Record<string, Assessment> = {};
    asmts.forEach((a) => { if (!m[a.consultant_id]) m[a.consultant_id] = a; });
    return m;
  }, [asmts]);

  // A TD sees their own consultants; superadmin sees everyone.
  const mine = useMemo(() => {
    if (role === 'superadmin') return consultants;
    const email = user?.email?.toLowerCase();
    return consultants.filter((c) => (c.td_email ?? '').toLowerCase() === email);
  }, [consultants, role, user]);

  const rows = useMemo(() => mine.map((c) => ({
    c, stage: stageOf(latestByConsultant[c.id]?.status),
  })), [mine, latestByConsultant]);

  const counts = useMemo(() => {
    const k: Record<Stage, number> = { setup: 0, self: 0, validate: 0, plan: 0, done: 0 };
    rows.forEach((r) => { k[r.stage] += 1; });
    return k;
  }, [rows]);

  const shown = filter === 'all' ? rows : rows.filter((r) => r.stage === filter);

  if (!isStaff) {
    if (isTrainer) {
      return (
        <div>
          <div className="page-head"><h1>Deliveries</h1></div>
          <TrainerDeliveries />
        </div>
      );
    }
    return user?.consultant_id
      ? <Navigate to={`/consultants/${user.consultant_id}`} replace />
      : <div className="card"><p className="muted" style={{ padding: 16 }}>Your consultant profile isn't linked yet. Ask an administrator to connect your account.</p></div>;
  }

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : (
        <>
          <div className="dash-stats">
            <button className={`dash-stat ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
              <span className="dash-num">{rows.length}</span><span className="dash-lbl">Consultants</span>
            </button>
            {(['setup', 'self', 'validate', 'plan', 'done'] as Stage[]).map((s) => (
              <button key={s} className={`dash-stat ${STAGE[s].cls} ${filter === s ? 'on' : ''}`} onClick={() => setFilter(filter === s ? 'all' : s)}>
                <span className="dash-num">{counts[s]}</span><span className="dash-lbl">{STAGE[s].label}</span>
              </button>
            ))}
          </div>

          <div className="card">
            <h2 className="panel-title">{filter === 'all' ? 'All consultants' : STAGE[filter].label}</h2>
            {shown.length === 0 ? (
              <p className="muted">{rows.length === 0 ? 'No consultants assigned to you yet.' : 'None at this stage.'}</p>
            ) : (
              <div className="dash-list">
                {shown.map(({ c, stage }) => (
                  <Link className="dash-row" to={`/consultants/${c.id}`} key={c.id}>
                    <div className="dash-row-main">
                      <div className="dash-row-name">{c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}</div>
                      <div className="dash-row-sub">{c.job_title ?? 'Consultant'}</div>
                    </div>
                    <span className={`stage-pill ${STAGE[stage].cls}`}>{STAGE[stage].label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {isTrainer && <TrainerDeliveries />}
        </>
      )}
    </div>
  );
}
