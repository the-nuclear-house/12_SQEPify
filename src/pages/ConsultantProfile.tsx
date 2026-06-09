import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import NuclearisationProcess from '../components/NuclearisationProcess';
import StarRating from '../components/StarRating';
import FileDropzone from '../components/FileDropzone';
import type {
  Consultant, Role, Assessment, AssessmentRole, AssessmentScore,
  Competency, CompetencyCategory, CompetencySubcategory, RoleCompetency,
  CompetencyLevelTraining, PlanItem, Training,
  CompetencyScore, PlannedTraining,
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

// ---------------- Filling figure ----------------
function Figure({ progress, full }: { progress: number; full: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  const top = 24, bottom = 308, height = bottom - top;
  const waterline = bottom - progress * height;
  const BODY = 'M80,88 C66,92 58,104 54,120 C40,150 30,235 28,294 Q27,308 41,308 L159,308 Q173,308 172,294 C170,235 160,150 146,120 C142,104 134,92 120,88 Q100,84 80,88 Z';
  return (
    <svg className="fig-svg" viewBox="0 0 200 346" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="figClip">
          <circle cx="100" cy="54" r="28" />
          <path d={BODY} />
        </clipPath>
        <linearGradient id="figWater" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#36d3c4" /><stop offset="100%" stopColor="#84c341" />
        </linearGradient>
        <filter id="figGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g clipPath="url(#figClip)">
        <rect width="200" height="346" fill="#161e29" />
        <g style={{ transform: mounted ? 'translateY(0)' : `translateY(${height}px)`, transition: 'transform 1.7s cubic-bezier(.22,.61,.36,1)' }}>
          <rect x="0" y={waterline} width="200" height={bottom - waterline + 60} fill="url(#figWater)" opacity="0.9" />
          <path className="wave wave-a" d={`M0,${waterline} q25,-9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V346 H0 Z`} fill="#36d3c4" opacity="0.45" />
          <path className="wave wave-b" d={`M0,${waterline + 4} q25,9 50,0 t50,0 t50,0 t50,0 t50,0 t50,0 V346 H0 Z`} fill="#84c341" opacity="0.30" />
        </g>
      </g>
      <g fill="none" stroke="#36d3c4" strokeWidth="3" strokeLinejoin="round" opacity={full ? 0.95 : 0.7} filter={full ? 'url(#figGlow)' : undefined}>
        <circle cx="100" cy="54" r="28" />
        <path d={BODY} />
      </g>
      <g transform="translate(100,210)" fill="none" stroke="#cdefff" strokeWidth="1.7" opacity="0.85">
        <ellipse rx="23" ry="9" />
        <ellipse rx="23" ry="9" transform="rotate(60)" />
        <ellipse rx="23" ry="9" transform="rotate(120)" />
        <circle r="2.8" fill="#cdefff" stroke="none" />
      </g>
    </svg>
  );
}

// ---------------- Radar ----------------
function Radar({ comps, onAxisClick }: { comps: CompetencyScore[]; onAxisClick?: (label: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  const cx = 240, cy = 178, R = 118, N = comps.length;
  const pt = (i: number, level: number) => {
    const ang = (-90 + (i * 360) / N) * (Math.PI / 180);
    const r = (level / 5) * R;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const labelPt = (i: number) => {
    const ang = (-90 + (i * 360) / N) * (Math.PI / 180);
    const r = R + 22;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)] as const;
  };
  const polyOf = (levels: number[]) => levels.map((l, i) => pt(i, l).join(',')).join(' ');
  const trunc = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s);
  return (
    <svg viewBox="0 0 480 356" className="radar-svg" xmlns="http://www.w3.org/2000/svg">
      {[1, 2, 3, 4, 5].map((lv) => (<polygon key={lv} points={polyOf(Array(N).fill(lv))} fill="none" stroke="#2c3845" strokeWidth="1" />))}
      {comps.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2c3845" strokeWidth="1" />; })}
      <polygon points={polyOf(comps.map((c) => c.target))} fill="none" stroke="#d7b23e" strokeWidth="1.5" strokeDasharray="5 4" />
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: mounted ? 'scale(1)' : 'scale(0)', transition: 'transform .55s cubic-bezier(.22,.61,.36,1)' }}>
        <polygon points={polyOf(comps.map((c) => c.current))} fill="#00aeef" fillOpacity="0.22" stroke="#00aeef" strokeWidth="2.5" />
        {comps.map((c, i) => { const [x, y] = pt(i, c.current); return <circle key={i} cx={x} cy={y} r="3.5" fill="#00aeef" />; })}
      </g>
      {comps.map((c, i) => {
        const [x, y] = labelPt(i);
        const anchor = x < cx - 6 ? 'end' : x > cx + 6 ? 'start' : 'middle';
        return (
          <text key={i} x={x} y={y} className={`radar-label${onAxisClick ? ' clickable' : ''}`} textAnchor={anchor} dominantBaseline="middle"
            onClick={onAxisClick ? () => onAxisClick(c.competency) : undefined}>
            <title>{c.competency}</title>{trunc(c.competency)}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------- Gantt ----------------
function Gantt({ trainings }: { trainings: PlannedTraining[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const total = Math.max(6, ...trainings.map((t) => t.startMonth + t.durationMonths));
  const months = Array.from({ length: total }, (_, i) => i);
  const pos = (m: number) => ((m + 0.5) / total) * 100;

  // One lane per competency; diamonds are the training milestones along it.
  const lanes = useMemo(() => {
    const m = new Map<string, PlannedTraining[]>();
    trainings.forEach((t) => { const a = m.get(t.competency) ?? []; a.push(t); m.set(t.competency, a); });
    return [...m.entries()].map(([competency, items]) => ({ competency, items: items.sort((a, b) => a.startMonth - b.startMonth) }));
  }, [trainings]);

  const selected = trainings.find((t) => t.id === sel) ?? null;
  const statusLabel = (s: string) => (s === 'done' ? 'Confirmed' : s === 'in_progress' ? 'Training delivered' : 'Planned');

  return (
    <div className="gantt2">
      <div className="gantt2-scroll">
        <div className="gantt2-grid">
          <div className="gantt2-axis">
            {months.map((m) => (<span key={m} className="gantt2-tick" style={{ left: `${pos(m)}%` }}>M{m + 1}</span>))}
          </div>
          {lanes.map((lane) => {
            const first = pos(lane.items[0].startMonth);
            const last = pos(lane.items[lane.items.length - 1].startMonth);
            return (
              <div className="gantt2-lane" key={lane.competency}>
                <div className="gantt2-lane-name" title={lane.competency}>{lane.competency}</div>
                <div className="gantt2-track">
                  <span className="gantt2-baseline" />
                  {lane.items.length > 1 && <span className="gantt2-span" style={{ left: `${first}%`, width: `${last - first}%` }} />}
                  {lane.items.map((t) => (
                    <button
                      key={t.id}
                      className={`gantt2-diamond ${t.status}${sel === t.id ? ' sel' : ''}`}
                      style={{ left: `${pos(t.startMonth)}%` }}
                      title={`${t.name} · M${t.startMonth + 1}`}
                      onClick={() => setSel(sel === t.id ? null : t.id)}
                      aria-label={t.name}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {selected && (
        <div className="gantt2-detail">
          <div className="gantt2-detail-main">
            <div className="gantt2-detail-name">{selected.name}</div>
            <div className="gantt2-detail-sub">{selected.competency} · level {selected.fromLevel} → {selected.toLevel} · month {selected.startMonth + 1}</div>
          </div>
          <span className={`stage-pill ${selected.status === 'done' ? 'st-done' : selected.status === 'in_progress' ? 'st-self' : 'st-setup'}`}>{statusLabel(selected.status)}</span>
        </div>
      )}
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
  const [comps, setComps] = useState<Competency[]>([]);
  const [roleComps, setRoleComps] = useState<RoleCompetency[]>([]);
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [scores, setScores] = useState<AssessmentScore[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [clts, setClts] = useState<CompetencyLevelTraining[]>([]);
  const [trainings, setTrainingsList] = useState<Training[]>([]);
  const [planning, setPlanning] = useState(false);
  const [reassess, setReassess] = useState<Record<string, number>>({});
  const [cvRunning, setCvRunning] = useState(false);
  const [cvMsg, setCvMsg] = useState<string | null>(null);
  const [setupWiz, setSetupWiz] = useState(0);
  const [roleQuery, setRoleQuery] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [valScores, setValScores] = useState<Record<string, number>>({});
  const [drillCat, setDrillCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<number | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [c, r, a, k, rc, cat, sub, clt, tns] = await Promise.all([
      supabase.from('consultants').select('*').eq('id', id).maybeSingle(),
      supabase.from('roles').select('*').order('is_base', { ascending: false }).order('sort_order').order('name'),
      supabase.from('assessments').select('*').eq('consultant_id', id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('competencies').select('*'),
      supabase.from('role_competencies').select('*'),
      supabase.from('competency_categories').select('*'),
      supabase.from('competency_subcategories').select('*'),
      supabase.from('competency_level_trainings').select('*'),
      supabase.from('trainings').select('*'),
    ]);
    const err = c.error || r.error || a.error || k.error || rc.error || cat.error || sub.error || clt.error || tns.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError(null);
    setConsultant((c.data as Consultant) ?? null);
    setRoles((r.data as Role[]) ?? []);
    setComps((k.data as Competency[]) ?? []);
    setRoleComps((rc.data as RoleCompetency[]) ?? []);
    setCats((cat.data as CompetencyCategory[]) ?? []);
    setSubs((sub.data as CompetencySubcategory[]) ?? []);
    setClts((clt.data as CompetencyLevelTraining[]) ?? []);
    setTrainingsList((tns.data as Training[]) ?? []);
    const asmt = (a.data as Assessment) ?? null;
    setAssessment(asmt);
    if (asmt) {
      const [{ data: ar }, { data: sc }, { data: pi }] = await Promise.all([
        supabase.from('assessment_roles').select('*').eq('assessment_id', asmt.id),
        supabase.from('assessment_scores').select('*').eq('assessment_id', asmt.id),
        supabase.from('plan_items').select('*').eq('assessment_id', asmt.id).order('sort_order'),
      ]);
      setSelected(((ar as AssessmentRole[]) ?? []).map((x) => x.role_id));
      setScores((sc as AssessmentScore[]) ?? []);
      setPlanItems((pi as PlanItem[]) ?? []);
    } else { setSelected([]); setScores([]); setPlanItems([]); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const baseRole = useMemo(() => roles.find((r) => r.is_base) ?? null, [roles]);
  const otherRoles = useMemo(() => roles.filter((r) => !r.is_base), [roles]);
  const roleName = (rid: string) => roles.find((r) => r.id === rid)?.name ?? '';
  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);
  const subById = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s.name])), [subs]);
  const scoreByComp = useMemo(() => Object.fromEntries(scores.map((s) => [s.competency_id, s])), [scores]);

  // Competencies in scope = Base role + selected roles, required level = highest across them.
  const applicable = useMemo(() => {
    const roleIds = new Set<string>([...(baseRole ? [baseRole.id] : []), ...selected]);
    const required = new Map<string, number>();
    roleComps.forEach((rc) => {
      if (!roleIds.has(rc.role_id)) return;
      required.set(rc.competency_id, Math.max(required.get(rc.competency_id) ?? 0, rc.required_level ?? TARGET));
    });
    return comps
      .filter((c) => required.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: catById[c.category_id] ?? '',
        subcategory: c.subcategory_id ? subById[c.subcategory_id] ?? '' : '',
        required: required.get(c.id) ?? TARGET,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [comps, roleComps, selected, baseRole, catById, subById]);
  const name = consultant?.full_name
    || [consultant?.first_name, consultant?.last_name].filter(Boolean).join(' ')
    || consultant?.email || 'Consultant';
  const current = stepIndex(assessment?.status ?? null);

  // Live competency picture from the scores collected so far.
  const liveComps = useMemo(() => applicable.map((c) => {
    const sc = scoreByComp[c.id];
    const cur = sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0;
    return { id: c.id, name: c.name, category: c.category, current: cur, required: c.required };
  }), [applicable, scoreByComp]);
  const hasScores = useMemo(() => liveComps.some((c) => c.current > 0), [liveComps]);

  // Radar aggregates to category level so it stays readable.
  const radarData: CompetencyScore[] = useMemo(() => {
    const byCat = new Map<string, { cur: number; tgt: number; n: number }>();
    liveComps.forEach((c) => {
      const k = c.category || 'Other';
      const e = byCat.get(k) ?? { cur: 0, tgt: 0, n: 0 };
      e.cur += c.current; e.tgt += c.required; e.n += 1;
      byCat.set(k, e);
    });
    return [...byCat.entries()].map(([competency, e]) => ({ competency, current: e.cur / e.n, target: e.tgt / e.n }));
  }, [liveComps]);

  // Competencies within a drilled-into category.
  const drillData: CompetencyScore[] = useMemo(
    () => (drillCat ? liveComps.filter((c) => c.category === drillCat).map((c) => ({ competency: c.name, current: c.current, target: c.required })) : []),
    [drillCat, liveComps],
  );
  const atRequired = useMemo(() => liveComps.filter((c) => c.required > 0 && c.current >= c.required).length, [liveComps]);
  const rolesLabel = useMemo(() => ['Base Nuclear', ...selected.map(roleName)].filter(Boolean).join(', '), [selected, roles]);

  const trainingById = useMemo(() => Object.fromEntries(trainings.map((t) => [t.id, t])), [trainings]);
  const compName = (cid: string) => comps.find((c) => c.id === cid)?.name ?? 'Competency';
  const planForGantt: PlannedTraining[] = useMemo(() => planItems.map((p) => ({
    id: p.id,
    name: (p.training_id ? trainingById[p.training_id]?.title : null) ?? p.title ?? 'Training',
    competency: compName(p.competency_id),
    fromLevel: p.from_level,
    toLevel: p.to_level,
    startMonth: p.start_month,
    durationMonths: p.duration_months,
    status: p.status === 'confirmed' ? 'done' : p.status === 'training_done' ? 'in_progress' : 'upcoming',
  })), [planItems, trainingById, comps]);

  // Plan items grouped by competency, for the loop UI.
  const planGroups = useMemo(() => {
    const m = new Map<string, PlanItem[]>();
    planItems.forEach((p) => { const a = m.get(p.competency_id) ?? []; a.push(p); m.set(p.competency_id, a); });
    return [...m.entries()].map(([cid, items]) => ({ cid, name: compName(cid), items }));
  }, [planItems, comps]);
  const allConfirmed = planItems.length > 0 && planItems.every((p) => p.status === 'confirmed');

  const progress = useMemo(() => {
    if (liveComps.length === 0) return 0;
    // Distance to the bar per competency: level 1 (no knowledge) = 0%, the required level = 100%.
    const fracs = liveComps.map((c) => {
      if (c.required <= 1) return c.current >= c.required ? 1 : 0;
      return Math.max(0, Math.min(1, (c.current - 1) / (c.required - 1)));
    });
    return fracs.reduce((s, f) => s + f, 0) / fracs.length;
  }, [liveComps]);
  const pct = Math.round(progress * 100);
  const full = progress >= 1;

  // Applicable competencies grouped by category, for the self-assessment list.
  const selfGroups = useMemo(
    () => cats.map((cat) => ({ name: cat.name, items: applicable.filter((c) => c.category === cat.name) })).filter((g) => g.items.length),
    [cats, applicable],
  );

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
    setSaving(false);
    await load();
    setSetupWiz(1);
  }

  function openSetup() { setSetupWiz(0); setModalStep(0); }

  const isSelf = user?.product_role === 'consultant' && !!user?.consultant_id && String(user.consultant_id) === String(id);
  const isStaff = user?.product_role === 'superadmin' || user?.product_role === 'technical_director';
  const needsSelf = isSelf && assessment?.status === 'self_assessment';
  const autoRef = useRef(false);
  useEffect(() => {
    if (!loading && needsSelf && !autoRef.current) { autoRef.current = true; setModalStep(1); }
  }, [loading, needsSelf]);

  useEffect(() => {
    if (modalStep === 1) {
      const seed: Record<string, number> = {};
      applicable.forEach((c) => { const sc = scoreByComp[c.id]; seed[c.id] = sc?.self_level ?? sc?.ai_level ?? 0; });
      setSelfScores(seed);
    }
    if (modalStep === 2) {
      const seed: Record<string, number> = {};
      applicable.forEach((c) => { const sc = scoreByComp[c.id]; seed[c.id] = sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0; });
      setValScores(seed);
    }
  }, [modalStep]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitValidation() {
    if (!assessment) return;
    setSaving(true); setError(null);
    const rows = applicable.map((c) => ({ assessment_id: assessment.id, competency_id: c.id, validated_level: valScores[c.id] ?? 0 }));
    const { error: upErr } = await supabase.from('assessment_scores').upsert(rows, { onConflict: 'assessment_id,competency_id' });
    if (upErr) { setError(upErr.message); setSaving(false); return; }
    const { error } = await supabase.from('assessments').update({ status: 'planning' }).eq('id', assessment.id);
    if (error) setError(error.message);
    setSaving(false); setModalStep(null); load();
  }

  async function generatePlan() {
    if (!assessment) return;
    setPlanning(true); setError(null);
    const rows: Array<Record<string, unknown>> = [];
    let order = 0;
    applicable.forEach((c) => {
      const sc = scoreByComp[c.id];
      const cur = sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0;
      let cursor = 0;
      for (let L = Math.max(cur + 1, 2); L <= c.required; L++) {
        const trs = clts.filter((x) => x.competency_id === c.id && x.level === L);
        const push = (training_id: string | null, title: string | null, dm: number) => {
          rows.push({ assessment_id: assessment.id, competency_id: c.id, training_id, title, from_level: L - 1, to_level: L, start_month: cursor, duration_months: dm, status: 'planned', sort_order: order++ });
          cursor += dm + 1;
        };
        if (trs.length === 0) push(null, `Training needed to reach level ${L}`, 1);
        else trs.forEach((t) => {
          const tr = trainingById[t.training_id];
          const dm = Math.max(1, Math.min(4, Math.round((tr?.duration_hours || 40) / 40)));
          push(t.training_id, tr?.title ?? 'Training', dm);
        });
      }
    });
    await supabase.from('plan_items').delete().eq('assessment_id', assessment.id);
    if (rows.length) { const { error } = await supabase.from('plan_items').insert(rows); if (error) setError(error.message); }
    await supabase.from('assessments').update({ status: 'plan_review' }).eq('id', assessment.id);
    setPlanning(false); await load();
  }

  async function markDelivered(item: PlanItem) {
    const { error } = await supabase.from('plan_items').update({ status: 'training_done' }).eq('id', item.id);
    if (error) setError(error.message);
    load();
  }

  async function confirmMove(item: PlanItem, level: number) {
    if (!assessment) return;
    const e1 = (await supabase.from('assessment_scores').upsert([{ assessment_id: assessment.id, competency_id: item.competency_id, validated_level: level }], { onConflict: 'assessment_id,competency_id' })).error;
    const e2 = (await supabase.from('plan_items').update({ status: 'confirmed', outcome_level: level }).eq('id', item.id)).error;
    if (e1 || e2) setError((e1 || e2)!.message);
    load();
  }

  async function markNuclearised() {
    if (!assessment) return;
    setSaving(true);
    const { error } = await supabase.from('assessments').update({ status: 'delivered' }).eq('id', assessment.id);
    if (error) setError(error.message);
    setSaving(false); setModalStep(null); load();
  }

  async function submitSelf() {
    if (!assessment) return;
    setSaving(true); setError(null);
    const rows = applicable.map((c) => ({ assessment_id: assessment.id, competency_id: c.id, self_level: selfScores[c.id] ?? 0 }));
    const { error: upErr } = await supabase.from('assessment_scores').upsert(rows, { onConflict: 'assessment_id,competency_id' });
    if (upErr) { setError(upErr.message); setSaving(false); return; }
    const { error } = await supabase.from('assessments').update({ status: 'validation' }).eq('id', assessment.id);
    if (error) setError(error.message);
    setSaving(false); setModalStep(null); load();
  }

  function readFile(file: File): Promise<{ file_base64?: string; media_type?: string; text?: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const type = file.type || '';
      const isTextLike = type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);
      reader.onerror = () => reject(new Error('Could not read the file.'));
      if (isTextLike) {
        reader.onload = () => resolve({ text: String(reader.result) });
        reader.readAsText(file);
      } else {
        reader.onload = () => resolve({ file_base64: String(reader.result).split(',')[1] ?? '', media_type: type || 'application/octet-stream' });
        reader.readAsDataURL(file);
      }
    });
  }

  async function runCv(file: File) {
    if (!assessment) return;
    if (applicable.length === 0) { setCvMsg('Add at least one role with competencies before running the CV.'); return; }
    setCvRunning(true); setCvMsg(null); setError(null);
    try {
      const input = await readFile(file);
      const { data, error } = await supabase.functions.invoke('parse-cv-nuclear', {
        body: { ...input, competencies: applicable.map((c) => ({ id: c.id, name: c.name, category: c.category, subcategory: c.subcategory })) },
      });
      if (error) throw new Error(error.message || 'The CV function could not be reached.');
      if (data?.error) throw new Error(data.error);
      const results: Array<{ competency_id: string; level: number; evidence?: string }> = data?.results ?? [];
      if (!Array.isArray(results) || results.length === 0) {
        setCvMsg('The AI found no evidence for the competencies in scope. You can still send for self-assessment.');
      } else {
        const valid = new Set(applicable.map((c) => c.id));
        const rows = results
          .filter((r) => valid.has(r.competency_id) && typeof r.level === 'number')
          .map((r) => ({ assessment_id: assessment.id, competency_id: r.competency_id, ai_level: Math.max(0, Math.min(5, Math.round(r.level))), note: r.evidence ?? null }));
        if (rows.length) {
          const { error: upErr } = await supabase.from('assessment_scores').upsert(rows, { onConflict: 'assessment_id,competency_id' });
          if (upErr) throw new Error(upErr.message);
        }
        setCvMsg(`AI proposed levels for ${rows.length} competenc${rows.length === 1 ? 'y' : 'ies'}.`);
        await load();
      }
    } catch (e) {
      setCvMsg(e instanceof Error ? e.message : 'Something went wrong running the CV.');
    } finally {
      setCvRunning(false);
    }
  }

  async function sendForSelf() {
    if (!assessment) return;
    setSaving(true); setError(null);
    const { error } = await supabase.from('assessments').update({ status: 'self_assessment' }).eq('id', assessment.id);
    if (error) setError(error.message);
    setSaving(false); setModalStep(null); load();
  }

  if (user?.product_role === 'consultant' && !isSelf) return <Navigate to="/" replace />;
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

      <NuclearisationProcess steps={STEPS} current={current} onSelect={(i) => { if (i === 0) setSetupWiz(0); setModalStep(i); }} />

      <div className="profile-hero">
        <div className="card fig-card">
          <Figure progress={progress} full={full} />
          <div className="fig-readout">
            <div className="big-pct">{pct}%</div>
            <div className="fig-caption">SQEPimeter</div>
            {hasScores ? (
              <div className={`fig-sub${full ? ' gold' : ''}`}>{full ? 'Fully SQEP for this role' : `${atRequired}/${liveComps.length} competencies at the required level`}</div>
            ) : (
              <div className="fig-sub">Not started</div>
            )}
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
                <button className="btn btn-primary" onClick={openSetup}>Start assessment</button>
              </>
            ) : (
              <>
                <p className="assess-status">{STATUS_LABEL[assessment.status] ?? assessment.status}</p>
                <p className="muted card-hint">Roles: Base Nuclear{selected.length ? ', ' + selected.map(roleName).join(', ') : ''}</p>
                <button className="btn btn-sm" onClick={openSetup}>Open set-up</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="profile-lower">
        <div className="card radar-card">
          <div className="radar-head">
            <h2>Competency map{drillCat && <> · <span className="radar-cat">{drillCat}</span></>}</h2>
            {drillCat && <button className="link-btn" onClick={() => setDrillCat(null)}>← All categories</button>}
          </div>
          {hasScores && <p className="muted radar-roles">Assessed against {rolesLabel}.{!drillCat && ' Click a category to see its competencies.'}</p>}
          {hasScores ? (
            <>
              <Radar
                key={drillCat ?? 'all'}
                comps={drillCat ? drillData : radarData}
                onAxisClick={drillCat ? undefined : (label) => setDrillCat(label)}
              />
              <div className="radar-key"><span><i className="key-cur" /> Current</span><span><i className="key-tgt" /> Target</span></div>
            </>
          ) : (
            <EmptyViz title="Not assessed yet" hint="Map fills in once the consultant completes their self-assessment." />
          )}
        </div>
        <div className="card gantt-card">
          <h2>Training plan</h2>
          {planForGantt.length ? <Gantt trainings={planForGantt} /> : (
            <EmptyViz title="No plan yet" hint="The plan is generated at the Plan step once levels are validated." />
          )}
        </div>
      </div>

      {/* Set-up wizard */}
      {modalStep === 0 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Set-up</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>

            {!isStaff ? (
              <div className="modal-step"><p className="muted">Your Technical Director sets up your assessment. There's nothing for you to do here.</p></div>
            ) : (
            <>
            <div className="wiz-steps">
              {['Roles', 'CV assessment', 'Hand over'].map((l, i) => (
                <div className={`wiz-step ${i === setupWiz ? 'current' : i < setupWiz ? 'done' : ''}`} key={l}>
                  <span className="wiz-num">{i < setupWiz ? '✓' : i + 1}</span>
                  <span className="wiz-label">{l}</span>
                </div>
              ))}
            </div>

            <div className="modal-step">
              {setupWiz === 0 && (
                <>
                  <p className="muted">Which roles is this consultant assessed against? Base Nuclear always applies; type to add any role-based competencies on top.</p>

                  {otherRoles.length === 0 ? (
                    <div className="ms"><div className="ms-control static">
                      {baseRole && <span className="role-chip locked">{baseRole.name}<span className="role-chip-tag">always</span></span>}
                      <span className="muted role-chip-hint">No role-based roles defined yet</span>
                    </div></div>
                  ) : (
                    <div className="ms">
                      <div className="ms-control" onClick={() => { roleInputRef.current?.focus(); setRoleOpen(true); }}>
                        {baseRole && <span className="role-chip locked">{baseRole.name}<span className="role-chip-tag">always</span></span>}
                        {selected.map((rid) => (
                          <span className="role-chip" key={rid}>{roleName(rid)}
                            <button className="role-chip-x" onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(rid)} aria-label={`Remove ${roleName(rid)}`}>×</button>
                          </span>
                        ))}
                        <input ref={roleInputRef} className="ms-input" value={roleQuery}
                          placeholder={selected.length ? 'Add another…' : 'Add roles…'}
                          onChange={(e) => { setRoleQuery(e.target.value); setRoleOpen(true); }}
                          onFocus={() => setRoleOpen(true)}
                          onBlur={() => setTimeout(() => setRoleOpen(false), 120)} />
                      </div>
                      {roleOpen && (() => {
                        const matches = otherRoles.filter((r) => !selected.includes(r.id) && r.name.toLowerCase().includes(roleQuery.trim().toLowerCase()));
                        return (
                          <div className="ms-menu">
                            {matches.length === 0 ? (
                              <div className="ms-empty">{roleQuery ? `No roles match “${roleQuery}”` : 'All roles added'}</div>
                            ) : matches.map((r) => (
                              <button className="ms-opt" key={r.id} onMouseDown={(e) => e.preventDefault()}
                                onClick={() => { toggle(r.id); setRoleQuery(''); roleInputRef.current?.focus(); }}>
                                {r.name}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div className="wiz-foot">
                    <button className="btn btn-primary wiz-next" onClick={saveSetup} disabled={saving}>
                      {saving ? 'Saving…' : 'Save and continue'}
                    </button>
                  </div>
                </>
              )}

              {setupWiz === 1 && (
                <>
                  <p className="muted">Optional head-start: upload the consultant's CV and the AI proposes a starting level for each of the {applicable.length} competenc{applicable.length === 1 ? 'y' : 'ies'} in scope, which the consultant then reviews. Skip it and they self-assess from scratch. PDF, Word, image or text.</p>
                  <FileDropzone
                    className="cv-drop"
                    accept=".pdf,.doc,.docx,.txt,.md,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    allowedExtensions={['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'gif', 'webp']}
                    maxSizeMb={10}
                    disabled={cvRunning}
                    onFileSelected={runCv}
                    onValidationError={(_t, m) => setCvMsg(m)}
                    render={({ isDragging }) => (
                      <span>{cvRunning ? 'Reading the CV…' : isDragging ? 'Drop the CV to upload' : 'Drop a CV here, or click to choose'}</span>
                    )}
                  />
                  {cvMsg && <p className="muted cv-msg">{cvMsg}</p>}

                  {scores.some((s) => s.ai_level != null) && (
                    <div className="proposed">
                      <div className="proposed-head">Proposed levels</div>
                      {applicable.filter((c) => scoreByComp[c.id]?.ai_level != null).map((c) => {
                        const sc = scoreByComp[c.id];
                        return (
                          <div className="proposed-row" key={c.id}>
                            <div className="proposed-name">{c.name}{sc?.note && <span className="proposed-note">{sc.note}</span>}</div>
                            <StarRating value={sc?.ai_level ?? 0} readOnly showLabel={false} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="wiz-foot">
                    <button className="btn btn-ghost" onClick={() => setSetupWiz(0)}>Back</button>
                    <button className="btn btn-primary wiz-next" onClick={() => setSetupWiz(2)}>Continue</button>
                  </div>
                </>
              )}

              {setupWiz === 2 && (
                <>
                  <p className="muted">Ready to hand over. The consultant reviews the proposed levels and completes their self-assessment.</p>
                  <dl className="info-list">
                    <div><dt>Roles</dt><dd>Base Nuclear{selected.length ? ', ' + selected.map(roleName).join(', ') : ''}</dd></div>
                    <div><dt>Competencies in scope</dt><dd>{applicable.length}</dd></div>
                    <div><dt>AI-proposed so far</dt><dd>{scores.filter((s) => s.ai_level != null).length}</dd></div>
                  </dl>
                  <div className="wiz-foot">
                    <button className="btn btn-ghost" onClick={() => setSetupWiz(1)}>Back</button>
                    <button className="btn btn-primary wiz-next" onClick={sendForSelf} disabled={saving}>
                      {saving ? 'Sending…' : 'Send for self-assessment'}
                    </button>
                  </div>
                </>
              )}
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* Self-assessment */}
      {modalStep === 1 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Self-assessment</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step">
              {!assessment ? (
                <p className="muted">Set-up has to be completed first.</p>
              ) : applicable.length === 0 ? (
                <p className="muted">No competencies in scope yet. Add roles in Set-up.</p>
              ) : (
                <>
                  <p className="muted">Rate each competency honestly against the 0–5 scale. Where the AI proposed a level from the CV it's shown as a starting point; adjust it to reflect reality. When you submit, it goes to the Technical Director to review.</p>
                  <div className="sa-list">
                    {selfGroups.map((g) => (
                      <div className="sa-group" key={g.name}>
                        <div className="sa-cat">{g.name}</div>
                        {g.items.map((c) => {
                          const ai = scoreByComp[c.id]?.ai_level;
                          return (
                            <div className="sa-row" key={c.id}>
                              <div className="sa-name">{c.name}{ai != null && <span className="sa-ai">AI suggested {ai}</span>}</div>
                              <StarRating value={selfScores[c.id] ?? 0} onChange={(v) => setSelfScores((s) => ({ ...s, [c.id]: v }))} showLabel={false} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-block" onClick={submitSelf} disabled={saving}>
                    {saving ? 'Submitting…' : 'Submit for review'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Validation */}
      {modalStep === 2 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Validation</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step">
              {!isStaff ? (
                <p className="muted">Your Technical Director reviews your self-assessment and confirms your levels. There's nothing for you to do at this step.</p>
              ) : !assessment ? (
                <p className="muted">Set-up has to be completed first.</p>
              ) : applicable.length === 0 ? (
                <p className="muted">No competencies in scope yet.</p>
              ) : (
                <>
                  <p className="muted">Review the consultant's self-assessment against the AI's read of the CV, adjust where needed, and set the validated level. This locks their current level for each competency and moves them into planning.</p>
                  <div className="sa-list">
                    {selfGroups.map((g) => (
                      <div className="sa-group" key={g.name}>
                        <div className="sa-cat">{g.name}</div>
                        {g.items.map((c) => {
                          const sc = scoreByComp[c.id];
                          return (
                            <div className="sa-row" key={c.id}>
                              <div className="sa-name">{c.name}
                                <span className="sa-ai">
                                  {sc?.self_level != null ? `self ${sc.self_level}` : 'no self-assessment'}
                                  {sc?.ai_level != null ? ` · AI ${sc.ai_level}` : ''}
                                  {` · required ${c.required}`}
                                </span>
                              </div>
                              <StarRating value={valScores[c.id] ?? 0} onChange={(v) => setValScores((s) => ({ ...s, [c.id]: v }))} showLabel={false} size="sm" />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary btn-block" onClick={submitValidation} disabled={saving}>
                    {saving ? 'Validating…' : 'Validate and move to planning'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan + delivery loop */}
      {modalStep === 3 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Plan</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step">
              {!isStaff ? (
                <p className="muted">Your Technical Director builds and runs your training plan. You'll see it fill in on your profile as trainings are completed and confirmed.</p>
              ) : !assessment ? (
                <p className="muted">Earlier steps have to be completed first.</p>
              ) : planItems.length === 0 ? (
                <>
                  <p className="muted">Build the training plan from the gap between each validated level and the role's required level, using the trainings on each competency's learning path. You can then run the loop below as trainings happen.</p>
                  <button className="btn btn-primary btn-block" onClick={generatePlan} disabled={planning}>
                    {planning ? 'Building the plan…' : 'Generate the plan'}
                  </button>
                </>
              ) : (
                <>
                  <p className="muted">A training is an enabler, not a tick-box. Mark it delivered, then re-assess and confirm the level the consultant actually reached. The confirmed level is what moves the stars and fills the SQEPimeter.</p>
                  <div className="plan-list">
                    {planGroups.map((g) => (
                      <div className="plan-group" key={g.cid}>
                        <div className="sa-cat">{g.name}</div>
                        {g.items.map((it) => {
                          const label = (it.training_id ? trainingById[it.training_id]?.title : null) ?? it.title ?? 'Training';
                          return (
                            <div className={`plan-item ${it.status}`} key={it.id}>
                              <div className="plan-item-main">
                                <div className="plan-item-name">{label}</div>
                                <div className="plan-item-meta">level {it.from_level} → {it.to_level}</div>
                              </div>
                              {it.status === 'planned' && (
                                <button className="btn btn-sm" onClick={() => markDelivered(it)}>Mark delivered</button>
                              )}
                              {it.status === 'training_done' && (
                                <div className="plan-reassess">
                                  <span className="muted">Confirm level reached:</span>
                                  <StarRating value={reassess[it.id] ?? it.to_level} onChange={(v) => setReassess((s) => ({ ...s, [it.id]: v }))} showLabel={false} size="sm" />
                                  <button className="btn btn-sm btn-primary" onClick={() => confirmMove(it, reassess[it.id] ?? it.to_level)}>Confirm</button>
                                </div>
                              )}
                              {it.status === 'confirmed' && (
                                <span className="plan-confirmed">✓ confirmed at level {it.outcome_level}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="plan-foot">
                    <button className="link-btn" onClick={generatePlan} disabled={planning}>{planning ? 'Rebuilding…' : 'Regenerate plan'}</button>
                    {allConfirmed && (
                      <button className="btn btn-primary" onClick={markNuclearised} disabled={saving}>
                        {saving ? 'Finishing…' : 'Mark fully nuclearised'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modalStep !== null && modalStep > 3 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>{STEPS[modalStep]}</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button></div>
            <div className="modal-step"><p className="muted">{assessment?.status === 'delivered' ? 'This consultant is fully nuclearised for their role.' : 'Reached once the plan is complete and every level is confirmed.'}</p></div>
          </div>
        </div>
      )}

      {needsSelf && modalStep !== 1 && (
        <button className="self-nudge" onClick={() => setModalStep(1)}>
          <span className="self-nudge-dot" />Complete your self-assessment
        </button>
      )}
    </div>
  );
}
