import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type {
  CompetencyScore,
  PlannedTraining,
  ConsultantProfileData,
} from '../lib/types';

const STAR_LABELS = [
  'Not assessed',
  'No knowledge',
  'Awareness',
  'Basic competence',
  'Full competence',
  'Expert / trainer',
];
const TARGET = 4;

// ----- Sample data, until the competency, assessment and training tables exist -----
const SAMPLE_COMPETENCIES: CompetencyScore[] = [
  { competency: 'Reactor Physics', current: 4, target: TARGET },
  { competency: 'Thermal Hydraulics', current: 3, target: TARGET },
  { competency: 'Safety Case', current: 5, target: TARGET },
  { competency: 'Radiation Protection', current: 2, target: TARGET },
  { competency: 'Mechanical Design', current: 4, target: TARGET },
  { competency: 'C&I Systems', current: 3, target: TARGET },
];

const SAMPLE_TRAININGS: PlannedTraining[] = [
  { id: 't1', name: 'Radiation Protection Foundations', competency: 'Radiation Protection', fromLevel: 2, toLevel: 3, startMonth: 0, durationMonths: 2, status: 'done' },
  { id: 't2', name: 'Applied Dose Assessment', competency: 'Radiation Protection', fromLevel: 3, toLevel: 4, startMonth: 2, durationMonths: 3, status: 'in_progress' },
  { id: 't3', name: 'Thermal Hydraulics Modelling', competency: 'Thermal Hydraulics', fromLevel: 3, toLevel: 4, startMonth: 4, durationMonths: 3, status: 'upcoming' },
  { id: 't4', name: 'C&I Systems Integration', competency: 'C&I Systems', fromLevel: 3, toLevel: 4, startMonth: 7, durationMonths: 4, status: 'upcoming' },
  { id: 't5', name: 'Reactor Physics Mastery', competency: 'Reactor Physics', fromLevel: 4, toLevel: 5, startMonth: 11, durationMonths: 4, status: 'upcoming' },
];
const CURRENT_MONTH = 4; // sample "today" marker on the plan

function nuclearisation(comps: CompetencyScore[]): number {
  const got = comps.reduce((s, c) => s + Math.min(c.current, c.target), 0);
  const need = comps.reduce((s, c) => s + c.target, 0);
  return need === 0 ? 0 : got / need;
}

// ---------------- Filling figure ----------------
function Figure({ progress, full }: { progress: number; full: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const top = 24;
  const bottom = 300;
  const height = bottom - top;
  const waterline = bottom - progress * height;

  return (
    <svg className="fig-svg" viewBox="0 0 200 320" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="figClip">
          <circle cx="100" cy="64" r="40" />
          <path d="M100,100 C125,100 140,112 150,135 L168,300 L32,300 L50,135 C60,112 75,100 100,100 Z" />
        </clipPath>
        <linearGradient id="figWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#36d3c4" />
          <stop offset="100%" stopColor="#84c341" />
        </linearGradient>
        <filter id="figGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g clipPath="url(#figClip)">
        <rect x="0" y="0" width="200" height="320" fill="#1b2430" />
        <g
          style={{
            transform: mounted ? 'translateY(0)' : `translateY(${height}px)`,
            transition: 'transform 1.7s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          <rect x="0" y={waterline} width="200" height={bottom - waterline + 40} fill="url(#figWater)" opacity="0.92" />
          <path className="wave wave-a" d={`M0,${waterline} q25,-9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V320 H0 Z`} fill="#36d3c4" opacity="0.45" />
          <path className="wave wave-b" d={`M0,${waterline + 4} q25,9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V320 H0 Z`} fill="#84c341" opacity="0.30" />
        </g>
      </g>

      {/* crisp outline */}
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
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const cx = 160;
  const cy = 160;
  const R = 110;
  const N = comps.length;
  const pt = (i: number, level: number) => {
    const ang = (-90 + (i * 360) / N) * (Math.PI / 180);
    const r = (level / 5) * R;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const polyOf = (levels: number[]) => levels.map((l, i) => pt(i, l).join(',')).join(' ');

  return (
    <svg viewBox="0 0 320 320" className="radar-svg" xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3, 4, 5].map((lv) => (
        <polygon key={lv} points={polyOf(Array(N).fill(lv))} fill="none" stroke="#2c3845" strokeWidth="1" />
      ))}
      {comps.map((_, i) => {
        const [x, y] = pt(i, 5);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2c3845" strokeWidth="1" />;
      })}
      <polygon points={polyOf(comps.map((c) => c.target))} fill="none" stroke="#d7b23e" strokeWidth="1.5" strokeDasharray="5 4" />
      <g
        style={{
          transformOrigin: '160px 160px',
          transform: mounted ? 'scale(1)' : 'scale(0)',
          transition: 'transform .9s cubic-bezier(.22,.61,.36,1)',
        }}
      >
        <polygon points={polyOf(comps.map((c) => c.current))} fill="#00aeef" fillOpacity="0.22" stroke="#00aeef" strokeWidth="2.5" />
        {comps.map((c, i) => {
          const [x, y] = pt(i, c.current);
          return <circle key={i} cx={x} cy={y} r="3.5" fill="#00aeef" />;
        })}
      </g>
      {comps.map((c, i) => {
        const [x, y] = pt(i, 5.7);
        return (
          <text key={i} x={x} y={y} className="radar-label" textAnchor={x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle'} dominantBaseline="middle">
            {c.competency}
          </text>
        );
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
        {months.map((m) => (
          <div key={m} className="gantt-tick" style={{ left: `${pct(m)}%` }}>
            <span>M{m + 1}</span>
          </div>
        ))}
        <div className="gantt-today" style={{ left: `${pct(CURRENT_MONTH)}%` }} title="Today" />
      </div>
      <div className="gantt-rows">
        {trainings.map((t) => (
          <div key={t.id} className="gantt-row">
            <div
              className={`gantt-bar ${t.status}`}
              style={{ left: `${pct(t.startMonth)}%`, width: `${pct(t.durationMonths)}%` }}
              title={`${t.name} (${t.fromLevel} to ${t.toLevel} stars)`}
            >
              <span>{t.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Page ----------------
export default function ConsultantProfile() {
  const { id } = useParams();
  const [name, setName] = useState('Consultant');
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [td, setTd] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('consultants')
      .select('full_name, job_title, td_full_name')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setName(data.full_name || 'Consultant');
          setJobTitle(data.job_title ?? null);
          setTd(data.td_full_name ?? null);
        }
      });
  }, [id]);

  const profile: ConsultantProfileData = {
    id: id ?? 'sample',
    name,
    jobTitle,
    technicalDirector: td,
    competencies: SAMPLE_COMPETENCIES,
    trainings: SAMPLE_TRAININGS,
  };

  const progress = nuclearisation(profile.competencies);
  const pct = Math.round(progress * 100);
  const full = progress >= 1;
  const atFull = profile.competencies.filter((c) => c.current >= 4).length;
  const trainers = profile.competencies.filter((c) => c.current >= 5).length;
  const nextUp = profile.trainings.find((t) => t.status !== 'done');

  return (
    <div className="profile">
      <div className="page-head">
        <Link to="/consultants" className="back-link">← Consultants</Link>
        <h1>{profile.name}</h1>
        <p>
          {[profile.jobTitle, profile.technicalDirector ? `Reports to ${profile.technicalDirector}` : null]
            .filter(Boolean)
            .join('  ·  ')}
        </p>
        <span className="sample-flag">Sample data, pending the competency model</span>
      </div>

      <div className="profile-hero">
        <div className="card fig-card">
          <Figure progress={progress} full={full} />
          <div className="fig-readout">
            <div className="big-pct">{pct}%</div>
            <div className="fig-caption">{full ? 'Fully nuclearised' : 'Nuclearisation'}</div>
          </div>
        </div>

        <div className="hero-side">
          <div className="stat-row">
            <div className="card stat">
              <div className="stat-num">{atFull}/{profile.competencies.length}</div>
              <div className="stat-label">At full competence (SQEP)</div>
            </div>
            <div className="card stat">
              <div className="stat-num gold">{trainers}</div>
              <div className="stat-label">Trainer level</div>
            </div>
          </div>
          <div className="card next-card">
            <div className="next-label">Next up</div>
            {nextUp ? (
              <>
                <div className="next-name">{nextUp.name}</div>
                <div className="next-meta">
                  {nextUp.competency} · {nextUp.fromLevel} to {nextUp.toLevel} stars ·{' '}
                  {nextUp.status === 'in_progress' ? 'in progress' : 'upcoming'}
                </div>
              </>
            ) : (
              <div className="next-name">All planned training complete</div>
            )}
          </div>
          <div className="card legend-card">
            <div className="legend-title">The journey, 0 to 5 stars</div>
            <ol className="legend">
              {STAR_LABELS.map((label, i) => (
                <li key={i}>
                  <span className="legend-star">{i}</span>
                  {label}
                  {i === TARGET && <span className="legend-tag">the bar</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <div className="profile-lower">
        <div className="card radar-card">
          <h2>Competency map</h2>
          <Radar comps={profile.competencies} />
          <div className="radar-key">
            <span><i className="key-cur" /> Current</span>
            <span><i className="key-tgt" /> Target (4 stars)</span>
          </div>
        </div>

        <div className="card gantt-card">
          <h2>Training plan</h2>
          <Gantt trainings={profile.trainings} />
        </div>
      </div>
    </div>
  );
}
