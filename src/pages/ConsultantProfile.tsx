import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import NuclearisationProcess from '../components/NuclearisationProcess';
import type {
  Consultant, Role, Assessment, AssessmentRole, CompetencyScore, PlannedTraining,
} from '../lib/types';

const STEPS = ['Set-up', 'Self-assessment', 'Validation', 'Plan', 'Nuclearised'];
const TARGET = 4;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Set-up in progress', self_assessment: 'With consultant for self-assessment',
  validation: 'Awaiting your validation', planning: 'Generating plan',
  plan_review: 'Plan in review', delivered: 'Nuclearised', cancelled: 'Cancelled',
};

function stepIndex(status: Assessment['status'] | null): number {
  switch (status) {
    case 'self_assessment': return 1;
    case 'validation': return 2;
    case 'planning':
    case 'plan_review': return 3;
    case 'delivered': return 4;
    default: return 0;
  }
}

function nuclearisation(comps: CompetencyScore[]): number {
  const got = comps.reduce((s, c) => s + Math.min(c.current, c.target), 0);
  const need = comps.reduce((s, c) => s + c.target, 0);
  return need === 0 ? 0 : got / need;
}

// ---------------- Filling figure ----------------
function Figure({ progress, full }: { progress: number; full: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  const top = 24, bottom = 300, height = bottom - top;
  const waterline = bottom - progress * height;
  return (
    <svg className="fig-svg" viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="figClip">
          <circle cx="100" cy="64" r="40" />
          <path d="M100,100 C125,100 140,112 150,135 L168,300 L32,300 L50,135 C60,112 75,100 100,100 Z" />
        </clipPath>
        <linearGradient id="figWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#36d3c4" /><stop offset="100%" stopColor="#84c341" />
        </linearGradient>
        <filter id="figGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g clipPath="url(#figClip)">
        <rect x="0" y="0" width="200" height="320" fill="#1b2430" />
        <g style={{ transform: mounted ? 'translateY(0)' : `translateY(${height}px)`, transition: 'transform 1.7s cubic-bezier(.22,.61,.36,1)' }}>
          <rect x="0" y={waterline} width="200" height={bottom - waterline + 40} fill="url(#figWater)" opacity="0.92" />
          <path className="wave wave-a" d={`M0,${waterline} q25,-9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V320 H0 Z`} fill="#36d3c4" opacity="0.45" />
          <path className="wave wave-b" d={`M0,${waterline + 4} q25,9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V320 H0 Z`} fill="#84c341" opacity="0.30" />
        </g>
      </g>
      <g fill="none" stroke="#36d3c4" strokeWidth="3" opacity={full ? 0.95 : 0.6} filter={full ? 'url(#figGlow)' : undefined}>
        <circle cx="100" cy="64" r="40" />
        <path d="M100,100 C125,100 140,112 150,135 L168,300 L32,300 L50,135 C60,112 75,100 100,100 Z" />
      </g>
    </svg>
  );
}

// ---------------- Radar ----------------
function Radar({ comps }: { comps: CompetencyScore[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  const cx = 160, cy = 160, R = 110, N = comps.length;
  const pt = (i: number, level: number) => {
    const ang = (-90 + (i * 360) / N) * (Math.PI / 180);
    const r = (level / 5) * R;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const polyOf = (levels: number[]) => levels.map((l, i) => pt(i, l).join(',')).join(' ');
  return (
    <svg viewBox="0 0 320 320" className="radar-svg" xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3, 4, 5].map((lv) => (<polygon key={lv} points={polyOf(Array(N).fill(lv))} fill="none" stroke="#2c3845" strokeWidth="1" />))}
      {comps.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2c3845" strokeWidth="1" />; })}
      <polygon points={polyOf(comps.map((c) => c.target))} fill="none" stroke="#d7b23e" strokeWidth="1.5" strokeDasharray="5 4" />
      <g style={{ transformOrigin: '160px 160px', transform: mounted ? 'scale(1)' : 'scale(0)', transition: 'transform .9s cubic-bezier(.22,.61,.36,1)' }}>
        <polygon points={polyOf(comps.map((c) => c.current))} fill="#00aeef" fillOpacity="0.22" stroke="#00aeef" strokeWidth="2.5" />
        {comps.map((c, i) => { const [x, y] = pt(i, c.current); return <circle key={i} cx={x} cy={y} r="3.5" fill="#00aeef" />; })}
      </g>
      {comps.map((c, i) => {
        const [x, y] = pt(i, 5.7);
        return (<text key={i} x={x} y={y} className="radar-label" textAnchor={x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'} dominantBaseline="middle">{c.competency}</text>);
      })}
    </svg>
  );
}

// ---------------- Gantt ----------------
function Gantt({ trainings }: { trainings: PlannedTraining[] }) {
  const total = Math.max(12, ...trainings.map((t) => t.startMonth + t.durationMonths));
  const months = Array.from({ length: total }, (_, i) => i);
  const pct = (m: number) => (m / total) * 100;
  return (
    <div className="gantt">
      <div className="gantt-axis">
        {months.map((m) => (<div key={m} className="gantt-tick" style={{ left: `${pct(m)}%` }}><span>M{m + 1}</span></div>))}
      </div>
      <div className="gantt-rows">
        {trainings.map((t) => (
          <div key={t.id} className="gantt-row">
            <div className={`gantt-bar ${t.status}`} style={{ left: `${pct(t.startMonth)}%`, width: `${pct(t.durationMonths)}%` }} title={`${t.name} (${t.fromLevel} to ${t.toLevel} stars)`}>
              <span>{t.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyViz({ title, hint }: { title: string; hint: string }) {
  return (<div className="empty-viz"><div className="empty-viz-title">{title}</div><p className="muted">{hint}</p></div>);
}

// ---------------- Page ----------------
export default function ConsultantProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<number | null>(null);

  // Real assessed competencies and plan will populate these once those steps are built.
  const competencies: CompetencyScore[] = [];
  const trainings: PlannedTraining[] = [];

  async function load() {
    if (!id) return;
    setLoading(true);
    const [c, r, a] = await Promise.all([
      supabase.from('consultants').select('*').eq('id', id).maybeSingle(),
      supabase.from('roles').select('*').order('is_base', { ascending: false }).order('sort_order').order('name'),
      supabase.from('assessments').select('*').eq('consultant_id', id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = c.error || r.error || a.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError(null);
    setConsultant((c.data as Consultant) ?? null);
    setRoles((r.data as Role[]) ?? []);
    const asmt = (a.data as Assessment) ?? null;
    setAssessment(asmt);
    if (asmt) {
      const { data: ar } = await supabase.from('assessment_roles').select('*').eq('assessment_id', asmt.id);
      setSelected(((ar as AssessmentRole[]) ?? []).map((x) => x.role_id));
    } else setSelected([]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const baseRole = useMemo(() => roles.find((r) => r.is_base) ?? null, [roles]);
  const otherRoles = useMemo(() => roles.filter((r) => !r.is_base), [roles]);
  const roleName = (rid: string) => roles.find((r) => r.id === rid)?.name ?? '';
  const name = consultant?.full_name
    || [consultant?.first_name, consultant?.last_name].filter(Boolean).join(' ')
    || consultant?.email || 'Consultant';
  const current = stepIndex(assessment?.status ?? null);

  const progress = competencies.length ? nuclearisation(competencies) : 0;
  const pct = Math.round(progress * 100);
  const full = progress >= 1;

  const toggle = (rid: string) => setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]));

  async function saveSetup() {
    if (!id) return;
    setSaving(true); setError(null);
    let aid = assessment?.id ?? null;
    if (!aid) {
      const { data, error } = await supabase.from('assessments')
        .insert({ consultant_id: id, created_by: user?.id ?? null }).select('*').single();
      if (error) { setError(error.message); setSaving(false); return; }
      aid = (data as Assessment).id; setAssessment(data as Assessment);
    }
    await supabase.from('assessment_roles').delete().eq('assessment_id', aid);
    if (selected.length) {
      const { error } = await supabase.from('assessment_roles').insert(selected.map((role_id) => ({ assessment_id: aid, role_id })));
      if (error) setError(error.message);
    }
    setSaving(false); setModalStep(null); load();
  }

  if (loading) return <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>;
  if (!consultant) return <div className="card"><p className="muted" style={{ padding: 16 }}>Consultant not found. <Link to="/consultants">Back to consultants</Link></p></div>;

  const skills = consultant.engineering_skills ?? [];

  return (
    <div className="profile">
      <div className="page-head">
        <Link className="back-link" to="/consultants">← Consultants</Link>
        <h1>{name}</h1>
        <p>{consultant.job_title ? consultant.job_title : 'Consultant'}{consultant.is_active ? '' : ' · Leaver'}</p>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      <NuclearisationProcess steps={STEPS} current={current} onSelect={(i) => setModalStep(i)} />

      <div className="profile-hero">
        <div className="card fig-card">
          <Figure progress={progress} full={full} />
          <div className="fig-readout">
            <div className="big-pct">{pct}%</div>
            <div className="fig-caption">{full ? 'Fully nuclearised' : assessment ? 'Nuclearisation' : 'Not started'}</div>
          </div>
        </div>

        <div className="hero-side">
          <div className="card">
            <h2 className="panel-title">Details</h2>
            <dl className="info-list">
              <div><dt>Email</dt><dd>{consultant.company_email || consultant.email}</dd></div>
              <div><dt>Technical Director</dt><dd>{consultant.td_full_name || 'Not set'}</dd></div>
              <div><dt>Status</dt><dd>{consultant.is_active ? 'Active' : 'Left'}</dd></div>
            </dl>
          </div>
          <div className="card">
            <h2 className="panel-title">Skills</h2>
            <p className="muted card-hint">From the Control Room.</p>
            {skills.length === 0 ? <p className="muted">No skills listed.</p> : (
              <div className="chip-wrap">{skills.map((s, i) => <span className="skill-chip" key={i}>{s}</span>)}</div>
            )}
          </div>
          <div className="card">
            <h2 className="panel-title">Assessment</h2>
            {!assessment ? (
              <>
                <p className="assess-missing"><span className="dot-missing" />No assessment yet</p>
                <button className="btn btn-primary" onClick={() => setModalStep(0)}>Start assessment</button>
              </>
            ) : (
              <>
                <p className="assess-status">{STATUS_LABEL[assessment.status] ?? assessment.status}</p>
                <p className="muted card-hint">Roles: Base Nuclear{selected.length ? ', ' + selected.map(roleName).join(', ') : ''}</p>
                <button className="btn btn-sm" onClick={() => setModalStep(0)}>Open set-up</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="profile-lower">
        <div className="card radar-card">
          <h2>Competency map</h2>
          {competencies.length ? (
            <>
              <Radar comps={competencies} />
              <div className="radar-key"><span><i className="key-cur" /> Current</span><span><i className="key-tgt" /> Target ({TARGET} stars)</span></div>
            </>
          ) : (
            <EmptyViz title="Not assessed yet" hint="Run the Nuclearisation process to map their competency levels here." />
          )}
        </div>
        <div className="card gantt-card">
          <h2>Training plan</h2>
          {trainings.length ? <Gantt trainings={trainings} /> : (
            <EmptyViz title="No plan yet" hint="The 18-month plan appears once the assessment is nuclearised." />
          )}
        </div>
      </div>

      {/* Set-up modal */}
      {modalStep === 0 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Set-up</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step">
              <p className="muted">Choose the roles this consultant is assessed against. Base Nuclear always applies; add any role-based competencies on top. CV upload and AI assessment come next.</p>
              <div className="role-pick">
                {baseRole && (
                  <label className="role-pick-row locked"><input type="checkbox" checked readOnly />
                    <span className="role-pick-name"><span className="base-tag">BASE</span>{baseRole.name}</span>
                    <span className="role-pick-tag">Always applies</span>
                  </label>
                )}
                {otherRoles.length === 0 && <p className="muted">No role-based roles defined yet.</p>}
                {otherRoles.map((r) => (
                  <label className="role-pick-row" key={r.id}>
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span className="role-pick-name">{r.name}</span>
                  </label>
                ))}
              </div>
              <button className="btn btn-primary btn-block" onClick={saveSetup} disabled={saving}>{saving ? 'Saving…' : assessment ? 'Save roles' : 'Start assessment'}</button>
            </div>
          </div>
        </div>
      )}

      {modalStep !== null && modalStep > 0 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>{STEPS[modalStep]}</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step"><p className="muted">This step is being built next.</p></div>
          </div>
        </div>
      )}
    </div>
  );
}
