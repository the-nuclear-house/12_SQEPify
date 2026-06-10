import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import NuclearisationProcess from '../components/NuclearisationProcess';
import StarRating from '../components/StarRating';
import FileDropzone from '../components/FileDropzone';
import ConfirmDialog from '../components/ConfirmDialog';
import { generatePlanReportPDF, type PlanReportLane, type PlanReportStep } from '../components/PlanReportPDF';
import type {
  Consultant, Role, Assessment, AssessmentRole, AssessmentScore,
  Competency, CompetencyCategory, CompetencySubcategory, RoleCompetency,
  CompetencyLevelTraining, CompetencyLevelPath, PlanItem, Training, Trainer, TrainingDeliverer,
  CompetencyScore, PlannedTraining,
} from '../lib/types';

const STEPS = ['Set-up', 'Self-assessment', 'Validation', 'Plan'];
const TARGET = 4;

function stepIndex(status: Assessment['status'] | null): number {
  switch (status) {
    case 'self_assessment': return 1;
    case 'validation': return 2;
    case 'planning': return 3;
    case 'plan_review':
    case 'delivered': return 4;
    default: return 0;
  }
}

// ---------------- Filling tank: a stylised 3D container that fills with progress ----------------
function Figure({ progress, full }: { progress: number; full: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  const innerTop = 54, innerBottom = 334, rng = innerBottom - innerTop;
  const wl = innerBottom - Math.max(0, Math.min(1, progress)) * rng;
  const op = full ? 0.98 : 0.85;
  const glow = full ? 'url(#tankGlow)' : undefined;
  return (
    <svg className="fig-svg" viewBox="0 0 200 372" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="tankInner"><rect x="59" y="54" width="82" height="280" rx="11" /></clipPath>
        <linearGradient id="tankGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#243643" /><stop offset="14%" stopColor="#33485770" />
          <stop offset="42%" stopColor="#1a2731" /><stop offset="72%" stopColor="#141e28" /><stop offset="100%" stopColor="#202f3b" />
        </linearGradient>
        <linearGradient id="tankLiquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3fe0d0" /><stop offset="55%" stopColor="#36d3c4" /><stop offset="100%" stopColor="#84c341" />
        </linearGradient>
        <linearGradient id="tankRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0e151d" /><stop offset="100%" stopColor="#1b2935" />
        </linearGradient>
        <filter id="tankGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="100" cy="344" rx="52" ry="11" fill="#0c1219" />
      <rect x="50" y="46" width="100" height="298" rx="13" fill="url(#tankGlass)" />
      <g clipPath="url(#tankInner)">
        <rect x="59" y="54" width="82" height="280" fill="#121a24" />
        <g style={{ transform: mounted ? 'translateY(0)' : `translateY(${rng}px)`, transition: 'transform 1.7s cubic-bezier(.22,.61,.36,1)' }}>
          <rect x="59" y={wl} width="82" height={innerBottom - wl} fill="url(#tankLiquid)" opacity="0.95" />
          <ellipse cx="100" cy={wl} rx="41" ry="5.5" fill="#5cf0e2" opacity="0.85" />
          <path className="wave wave-a" d={`M59,${wl} q20,-7 41,0 t41,0 V334 H59 Z`} fill="#36d3c4" opacity="0.30" />
          <path className="wave wave-b" d={`M59,${wl + 4} q20,7 41,0 t41,0 V334 H59 Z`} fill="#84c341" opacity="0.22" />
        </g>
        <rect x="64" y="56" width="9" height="276" rx="4" fill="#ffffff" opacity="0.05" />
        {[1, 2, 3, 4, 5].map((L) => {
          const y = innerBottom - (L / 5) * rng, gold = L === 4, wln = gold ? 14 : 9;
          return <line key={L} x1={142 - wln} y1={y} x2={142} y2={y} stroke={gold ? '#d7b23e' : '#3a4b59'} strokeWidth="2" opacity={gold ? 0.9 : 0.5} />;
        })}
      </g>
      <ellipse cx="100" cy="46" rx="50" ry="11" fill="url(#tankRim)" stroke="#36d3c4" strokeWidth="2.5" opacity={op} filter={glow} />
      <ellipse cx="100" cy="46" rx="50" ry="11" fill="none" stroke="#9fe6ff" strokeWidth="1.2" opacity="0.5" />
      <rect x="50" y="46" width="100" height="298" rx="13" fill="none" stroke="#36d3c4" strokeWidth="2.6" opacity={op} filter={glow} />
      <rect x="57" y="60" width="7" height="270" rx="3.5" fill="#ffffff" opacity="0.07" />
    </svg>
  );
}

// ---------------- Radar ----------------
function LevelBars({ items, onSelect }: { items: { id: string; competency: string; current: number; target: number }[]; onSelect?: (it: { id: string; competency: string; current: number; target: number }) => void }) {
  return (
    <div className="lvlbars">
      {items.map((it) => (
        <button type="button" className={`lvlbar${onSelect ? ' clickable' : ''}`} key={it.id} onClick={onSelect ? () => onSelect(it) : undefined}>
          <div className="lvlbar-name" title={it.competency}>{it.competency}</div>
          <div className="lvlbar-track">
            <span className="lvlbar-fill" style={{ width: `${(Math.max(0, it.current) / 5) * 100}%` }} />
            <span className="lvlbar-target" style={{ left: `${(it.target / 5) * 100}%` }} title={`Target: level ${it.target}`} />
          </div>
          <div className="lvlbar-val">{Math.round(it.current)} <span className="muted">/ {it.target}</span></div>
        </button>
      ))}
    </div>
  );
}

const LP_LABELS: Record<number, string> = { 1: 'No knowledge', 2: 'Awareness', 3: 'Basic competence', 4: 'Full competence (SQEP)', 5: 'Expert' };

function LearningPathModal({ comp, clts, trainingById, planItems, assessmentId, isStaff, onChanged, onClose }: {
  comp: { id: string; competency: string; current: number; target: number };
  clts: CompetencyLevelTraining[];
  trainingById: Record<string, Training>;
  planItems: PlanItem[];
  assessmentId: string | null;
  isStaff: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [paths, setPaths] = useState<CompetencyLevelPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('competency_level_paths').select('*').eq('competency_id', comp.id);
      setPaths((data as CompetencyLevelPath[]) ?? []);
      setLoading(false);
    })();
  }, [comp.id]);

  const inPlan = (tid: string) => planItems.some((p) => p.competency_id === comp.id && p.training_id === tid);
  async function addToPlan(tid: string, level: number) {
    if (!assessmentId) return;
    setBusy(tid);
    await supabase.from('plan_items').insert({ assessment_id: assessmentId, competency_id: comp.id, training_id: tid, from_level: level - 1, to_level: level, start_month: 0, duration_months: 1, status: 'planned', sort_order: planItems.length });
    setBusy(null);
    onChanged();
  }

  const levels: number[] = [];
  for (let L = 2; L <= comp.target; L++) levels.push(L);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{comp.competency}</h2><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-step">
          <p className="muted">The path to the required level, {LP_LABELS[comp.target]}. Currently at {LP_LABELS[comp.current] ?? 'not assessed'}.</p>
          {loading ? <p className="muted">Loading…</p> : (
            <div className="lp-levels">
              {levels.map((L) => {
                const p = paths.find((x) => x.level === L);
                const trs = clts.filter((x) => x.competency_id === comp.id && x.level === L);
                return (
                  <div className={`lp-level${comp.current >= L ? ' reached' : ''}`} key={L}>
                    <div className="lp-level-head">
                      <span className="lp-level-num">{L}</span>
                      <span className="lp-level-label">{LP_LABELS[L]}</span>
                      {comp.current >= L && <span className="lp-reached">✓ reached</span>}
                    </div>
                    {p?.actions && <p className="lp-actions">{p.actions}</p>}
                    {p?.verification && <p className="lp-verify"><span className="muted">Verified by:</span> {p.verification}</p>}
                    {trs.length === 0 ? <p className="muted lp-none">No trainings defined for this level.</p> : (
                      <div className="lp-trainings">
                        {trs.map((t) => {
                          const inp = inPlan(t.training_id);
                          return (
                            <div className={`lp-training${inp ? ' in' : ''}`} key={t.training_id}>
                              <span>{trainingById[t.training_id]?.title ?? 'Training'}</span>
                              {inp ? <span className="lp-pill in">In plan</span>
                                : isStaff && assessmentId ? <button className="lp-pill add" onClick={() => addToPlan(t.training_id, L)} disabled={busy === t.training_id}>{busy === t.training_id ? 'Adding…' : '+ Add to plan'}</button>
                                : <span className="lp-pill out">Not in plan</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

function MissingTrainingModal({ comp, fromLevel, toLevel, missingId, trainers, existing, onDone, onClose }: {
  comp: { id: string; name: string };
  fromLevel: number;
  toLevel: number;
  missingId: string;
  trainers: Trainer[];
  existing: PlanItem[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [delivererIds, setDelivererIds] = useState<string[]>([]);
  const [newId, setNewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createTraining() {
    if (!title.trim()) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.from('trainings')
      .insert({ title: title.trim(), duration_hours: hours.trim() === '' ? null : Math.max(0, Math.round(Number(hours))), status: 'active', notes: null })
      .select('id').single();
    if (error) { setErr(error.message); setBusy(false); return; }
    const id = (data as { id: string }).id;
    if (delivererIds.length) await supabase.from('training_deliverers').insert(delivererIds.map((trainer_id) => ({ training_id: id, trainer_id })));
    setNewId(id); setBusy(false); setStep('confirm');
  }

  async function addToPathAndPlan() {
    if (!newId) return;
    setBusy(true); setErr(null);
    const { error: e1 } = await supabase.from('competency_level_trainings')
      .upsert({ competency_id: comp.id, level: toLevel, training_id: newId }, { onConflict: 'competency_id,level,training_id' });
    if (e1) { setErr(e1.message); setBusy(false); return; }
    // Replace the missing line: collapse onto an existing occurrence if there is one, else convert in place.
    const dup = existing.some((p) => p.kind === 'training' && p.training_id === newId);
    if (dup) {
      await supabase.from('plan_items').delete().eq('id', missingId);
    } else {
      const cur = existing.find((p) => p.id === missingId);
      await supabase.from('plan_items').update({ training_id: newId, kind: 'training', competency_id: null, start_month: cur?.start_month ?? 0 }).eq('id', missingId);
    }
    setBusy(false); onDone();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{step === 'create' ? 'Create training' : 'Add to path'}</h2><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-step">
          {err && <p className="sync-msg err">{err}</p>}
          {step === 'create' ? (
            <>
              <p className="muted">No training takes this consultant from level {fromLevel} to {toLevel} on <strong>{comp.name}</strong>. Create one to fill the gap.</p>
              <label>Title</label>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ALARP principles workshop" />
              <label>Duration (hours)</label>
              <input className="field" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" placeholder="Optional" />
              {trainers.length > 0 && (
                <>
                  <label>Approved trainers</label>
                  <div className="deliverer-box">
                    {trainers.map((tr) => (
                      <label key={tr.id} className="browse-row">
                        <input type="checkbox" checked={delivererIds.includes(tr.id)} onChange={() => setDelivererIds((ids) => ids.includes(tr.id) ? ids.filter((x) => x !== tr.id) : [...ids, tr.id])} />
                        <span className="browse-name">{tr.display_name}</span>
                        <span className="browse-tag">{tr.kind === 'technical_director' ? 'TD' : tr.kind === 'consultant' ? 'Consultant' : 'External'}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              <button className="btn btn-primary btn-block" onClick={createTraining} disabled={busy || !title.trim()}>{busy ? 'Creating…' : 'Create training'}</button>
            </>
          ) : (
            <>
              <p className="muted">Add <strong>{title}</strong> to the <strong>{comp.name}</strong> learning path (level {fromLevel} → {toLevel}) and into this plan? It replaces the Training Missing line.</p>
              <button className="btn btn-primary btn-block" onClick={addToPathAndPlan} disabled={busy}>{busy ? 'Saving…' : 'Yes, add to path and plan'}</button>
              <button className="link-btn" style={{ display: 'block', margin: '10px auto 0' }} onClick={onDone}>Not now</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Gantt ----------------
function ReassessModal({ planItemId, trainingTitle, trainerName, comps, assessmentId, userId, onSaved, onClose }: {
  planItemId: string;
  trainingTitle: string;
  trainerName: string | null;
  comps: { id: string; name: string; current: number; required: number }[];
  assessmentId: string;
  userId: string | undefined;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(comps.map((c) => [c.id, c.current])));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    if (comps.length) {
      const scoreRows = comps.map((c) => ({ assessment_id: assessmentId, competency_id: c.id, validated_level: levels[c.id] ?? c.current }));
      const { error: e1 } = await supabase.from('assessment_scores').upsert(scoreRows, { onConflict: 'assessment_id,competency_id' });
      if (e1) { setErr(e1.message); setSaving(false); return; }
      const outcomeRows = comps.map((c) => ({ plan_item_id: planItemId, competency_id: c.id, level: levels[c.id] ?? c.current }));
      const { error: e2 } = await supabase.from('plan_item_outcomes').insert(outcomeRows);
      if (e2) { setErr(e2.message); setSaving(false); return; }
    }
    const { error: e3 } = await supabase.from('plan_items').update({ status: 'assessed', note: note || null, assessed_by: userId ?? null, assessed_at: new Date().toISOString() }).eq('id', planItemId);
    setSaving(false);
    if (e3) { setErr(e3.message); return; }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Reassess after training</h2><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-step">
          <p className="muted">Received <strong>{trainingTitle}</strong>{trainerName ? <> from <strong>{trainerName}</strong></> : null}. Reassess the competencies it addresses. Levels can stay the same; the consultant only moves when you raise a star.</p>
          {err && <p className="sync-msg err">{err}</p>}
          {comps.length === 0 ? (
            <p className="muted">This training doesn't address any competency required by this consultant's role. You can still record it as assessed.</p>
          ) : (
            <div className="reassess-list">
              {comps.map((c) => (
                <div className="reassess-row" key={c.id}>
                  <div className="reassess-name">{c.name}<span className="muted"> · target {c.required}</span></div>
                  <StarRating value={levels[c.id] ?? 0} onChange={(v) => setLevels((s) => ({ ...s, [c.id]: v }))} showLabel size="sm" />
                </div>
              ))}
            </div>
          )}
          <label className="reassess-note-lbl">Comment
            <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, what to work on next…" />
          </label>
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save reassessment'}</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ planItemId, trainingTitle, nameOf, onClose }: {
  planItemId: string;
  trainingTitle: string;
  nameOf: (id: string) => string;
  onClose: () => void;
}) {
  const [outcomes, setOutcomes] = useState<{ competency_id: string; level: number }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [at, setAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const [o, pi] = await Promise.all([
        supabase.from('plan_item_outcomes').select('competency_id, level').eq('plan_item_id', planItemId),
        supabase.from('plan_items').select('note, assessed_at').eq('id', planItemId).maybeSingle(),
      ]);
      setOutcomes((o.data as { competency_id: string; level: number }[]) ?? []);
      setNote((pi.data as { note: string | null } | null)?.note ?? null);
      setAt((pi.data as { assessed_at: string | null } | null)?.assessed_at ?? null);
      setLoading(false);
    })();
  }, [planItemId]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>{trainingTitle}</h2><button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="modal-step">
          {at && <p className="muted">Reassessed {new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>}
          {loading ? <p className="muted">Loading…</p> : (
            <>
              {outcomes.length > 0 && (
                <div className="reassess-list">
                  {outcomes.map((o) => (
                    <div className="reassess-row" key={o.competency_id}>
                      <div className="reassess-name">{nameOf(o.competency_id)}</div>
                      <span className="cohort-pill green">Level {o.level}</span>
                    </div>
                  ))}
                </div>
              )}
              {note ? <p className="lp-actions" style={{ marginTop: 12 }}>{note}</p> : <p className="muted" style={{ marginTop: 12 }}>No comment recorded.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Gantt({ trainings, minMonths = 12, canReassess, onReassess, onHistory, onMissing }: { trainings: PlannedTraining[]; minMonths?: number; canReassess?: boolean; onReassess?: (id: string) => void; onHistory?: (id: string) => void; onMissing?: (id: string) => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const total = Math.max(minMonths, 6, ...trainings.map((t) => t.startMonth + t.durationMonths));
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
                    <Fragment key={t.id}>
                      <span className="gantt2-target" style={{ left: `${pos(t.startMonth)}%` }} title={`Reaches level ${t.toLevel}`}>★{t.toLevel}</span>
                      <button
                        className={`gantt2-diamond ${t.status}${sel === t.id ? ' sel' : ''}`}
                        style={{ left: `${pos(t.startMonth)}%` }}
                        title={`${t.name} · reaches level ${t.toLevel} · M${t.startMonth + 1}`}
                        onClick={() => setSel(sel === t.id ? null : t.id)}
                        aria-label={t.name}
                      />
                    </Fragment>
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
            <div className="gantt2-detail-sub">{selected.competency} · takes them to level {selected.toLevel} · month {selected.startMonth + 1}</div>
          </div>
          <span className={`stage-pill ${selected.status === 'done' ? 'st-done' : selected.status === 'in_progress' ? 'st-self' : 'st-setup'}`}>{statusLabel(selected.status)}</span>
          {selected.status === 'in_progress' && canReassess && <button className="btn btn-sm btn-primary" onClick={() => onReassess?.(selected.id)}>Reassess</button>}
          {selected.status === 'done' && <button className="btn btn-sm" onClick={() => onHistory?.(selected.id)}>View assessment</button>}
          {selected.status === 'missing' && canReassess && <button className="btn btn-sm btn-primary" onClick={() => onMissing?.(selected.id)}>Create training &amp; assign</button>}
        </div>
      )}
    </div>
  );
}

function EmptyViz({ title, hint }: { title: string; hint: string }) {
  return (<div className="empty-viz"><div className="empty-viz-title">{title}</div><p className="muted">{hint}</p></div>);
}

// ---------------- Page ----------------
function PathPickModal({ options, competencyName, onAdd, onClose }: {
  options: { training_id: string; level: number; title: string }[];
  competencyName: string;
  onAdd: (training_id: string, level: number) => void;
  onClose: () => void;
}) {
  const LVL = ['', 'No knowledge', 'Awareness', 'Basic competence', 'Full competence (SQEP)', 'Expert'];
  return (
    <div className="modal-overlay lp-picker-overlay" onClick={onClose}>
      <div className="modal lp-picker" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><h2>Add training</h2><p className="modal-sub">{competencyName}</p></div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-step">
          <div className="lp-picker-list">
            {options.length === 0 && <p className="muted">No trainings are defined in this competency's learning path yet. Add them on the Nuclear Competencies page first.</p>}
            {options.map((o) => (
              <button className="lp-picker-item" key={`${o.training_id}-${o.level}`} onClick={() => onAdd(o.training_id, o.level)}>
                <span className="lp-picker-title">{o.title}</span>
                <span className="lp-picker-meta">to {LVL[o.level]}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-block" onClick={onClose} style={{ marginTop: 12 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

function PlanEditor({ assessmentId, horizon, comps, clts, trainingById, trainers, deliverers, initialItems, onClose }: {
  assessmentId: string;
  horizon: number;
  comps: Competency[];
  clts: CompetencyLevelTraining[];
  trainingById: Record<string, Training>;
  trainers: Trainer[];
  deliverers: TrainingDeliverer[];
  initialItems: PlanItem[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<PlanItem[]>(() => initialItems.map((i) => ({ ...i })));
  const [sel, setSel] = useState<string | null>(null);
  const [addForComp, setAddForComp] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Full screen, but keep the app header visible: pin to top and stop the page behind scrolling.
  useEffect(() => {
    window.scrollTo(0, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const total = Math.max(horizon || 18, 12, ...draft.filter((d) => d.start_month != null).map((d) => (d.start_month as number) + 1));
  const compName = (cid: string | null) => comps.find((c) => c.id === cid)?.name ?? 'Competency';
  const pos = (m: number) => ((m + 0.5) / total) * 100;
  const trainerOpts = (training_id: string | null) => {
    if (!training_id) return [] as Trainer[];
    const ids = new Set(deliverers.filter((d) => d.training_id === training_id).map((d) => d.trainer_id));
    return trainers.filter((t) => ids.has(t.id));
  };

  // One lane per competency, ordered as comps are. Each diamond is a training step.
  type Lane = { competency_id: string; name: string; items: PlanItem[] };
  const lanes = useMemo<Lane[]>(() => {
    const byComp = new Map<string, PlanItem[]>();
    draft.forEach((d) => { const k = d.competency_id ?? 'none'; const a = byComp.get(k) ?? []; a.push(d); byComp.set(k, a); });
    const order = new Map(comps.map((c, i) => [c.id, i] as const));
    return [...byComp.entries()]
      .map(([cid, items]) => ({ competency_id: cid, name: compName(cid), items: items.sort((a, b) => (a.to_level - b.to_level) || ((a.start_month ?? 0) - (b.start_month ?? 0))) }))
      .sort((a, b) => (order.get(a.competency_id) ?? 999) - (order.get(b.competency_id) ?? 999));
  }, [draft, comps]);

  // Learning-path trainings for a competency, with the level each one reaches.
  const pathOptions = (cid: string) => clts
    .filter((x) => x.competency_id === cid)
    .map((x) => ({ training_id: x.training_id, level: x.level, title: trainingById[x.training_id]?.title ?? 'Training' }))
    .sort((a, b) => a.level - b.level);

  const dragRef = useRef<{ id: string; track: HTMLElement } | null>(null);
  function move(e: PointerEvent) {
    const d = dragRef.current; if (!d) return;
    const r = d.track.getBoundingClientRect();
    const mth = Math.max(0, Math.min(total - 1, Math.round(((e.clientX - r.left) / r.width) * total - 0.5)));
    setDraft((prev) => prev.map((it) => (it.id === d.id ? { ...it, start_month: mth } : it)));
  }
  function up() { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); }
  function down(e: React.PointerEvent, id: string) {
    e.preventDefault(); dragRef.current = { id, track: e.currentTarget.parentElement as HTMLElement }; setSel(id);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }

  function removeLine(id: string) { setDraft((d) => d.filter((x) => x.id !== id)); if (sel === id) setSel(null); }
  function setTrainer(id: string, trainer_id: string | null) { setDraft((d) => d.map((x) => (x.id === id ? { ...x, trainer_id } : x))); }

  // Add a learning-path training to a competency lane. The level it reaches comes straight from the path.
  function addPathTraining(competency_id: string, training_id: string, level: number) {
    const laneItems = draft.filter((d) => d.competency_id === competency_id);
    const used = new Set(laneItems.map((i) => i.start_month ?? 0));
    let m = laneItems.length ? Math.max(...laneItems.map((i) => i.start_month ?? 0)) + 2 : Math.max(0, (level - 2) * 2);
    m = Math.max(0, Math.min(total - 1, m));
    while (used.has(m) && m < total - 1) m++;
    const nid = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDraft((d) => [...d, { id: nid, assessment_id: assessmentId, competency_id, training_id, title: null, from_level: level - 1, to_level: level, start_month: m, duration_months: 1, kind: 'training', status: 'planned', trainer_id: null, delivered_at: null, delivered_by: null, assessed_at: null, assessed_by: null, outcome_level: null, note: null, sort_order: d.length, created_at: '' } as PlanItem]);
    setAddForComp(null); setSel(nid);
  }

  async function save() {
    setSaving(true); setErr(null);
    const origIds = new Set(initialItems.map((i) => i.id));
    const keptIds = new Set(draft.filter((d) => !d.id.startsWith('new-')).map((d) => d.id));
    const toDelete = [...origIds].filter((id) => !keptIds.has(id));
    const inserts = draft.filter((d) => d.id.startsWith('new-')).map((d, i) => ({ assessment_id: assessmentId, kind: d.kind, competency_id: d.competency_id, training_id: d.training_id, from_level: d.from_level, to_level: d.to_level, start_month: d.start_month, duration_months: 1, status: 'planned', trainer_id: d.trainer_id, sort_order: i }));
    try {
      if (toDelete.length) { const { error } = await supabase.from('plan_items').delete().in('id', toDelete); if (error) throw error; }
      for (const u of draft.filter((d) => !d.id.startsWith('new-'))) {
        const { error } = await supabase.from('plan_items').update({ start_month: u.start_month, training_id: u.training_id, trainer_id: u.trainer_id, kind: u.kind, from_level: u.from_level, to_level: u.to_level, sort_order: u.sort_order }).eq('id', u.id);
        if (error) throw error;
      }
      if (inserts.length) { const { error } = await supabase.from('plan_items').insert(inserts); if (error) throw error; }
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save failed'); setSaving(false); }
  }

  const selItem = draft.find((d) => d.id === sel) ?? null;
  const selTrainerOpts = selItem ? trainerOpts(selItem.training_id) : [];

  return (
    <div className="plan-editor">
      <div className="plan-editor-bar">
        <div>
          <h2>Training plan</h2>
          <span className="muted">One lane per competency. Each diamond is a training; the learning path sets the level it reaches. Drag to reschedule, assign a trainer below.</span>
        </div>
        <div className="pe-actions">
          <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save plan'}</button>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      {err && <p className="sync-msg err">{err}</p>}

      <div className="gantt2 pe-gantt">
        <div className="gantt2-scroll"><div className="gantt2-grid">
          <div className="gantt2-axis">{Array.from({ length: total }, (_, m) => <span key={m} className="gantt2-tick" style={{ left: `${pos(m)}%` }}>M{m + 1}</span>)}</div>
          {lanes.map((lane) => (
            <div className="gantt2-lane" key={lane.competency_id}>
              <div className="gantt2-lane-name" title={lane.name}>{lane.name}</div>
              <div className="gantt2-track">
                <span className="gantt2-baseline" />
                {lane.items.map((it) => (
                  <Fragment key={it.id}>
                    <span className="gantt2-target" style={{ left: `${pos(it.start_month ?? 0)}%` }} title={`Reaches level ${it.to_level}`}>★{it.to_level}</span>
                    {it.kind === 'missing' ? (
                      <button
                        className={`gantt2-diamond missing${sel === it.id ? ' sel' : ''}`}
                        style={{ left: `${pos(it.start_month ?? 0)}%` }}
                        title={`No training defined to reach level ${it.to_level}`}
                        onClick={() => setSel(it.id)} />
                    ) : (
                      <button
                        className={`gantt2-diamond draggable ${it.status === 'assessed' ? 'done' : it.status === 'delivered' ? 'in_progress' : ''}${it.trainer_id ? ' assigned' : ''}${sel === it.id ? ' sel' : ''}`}
                        style={{ left: `${pos(it.start_month ?? 0)}%` }}
                        title={`${trainingById[it.training_id ?? '']?.title ?? 'Training'} · M${(it.start_month ?? 0) + 1}${it.trainer_id ? ' · trainer assigned' : ' · no trainer'}`}
                        onPointerDown={(e) => down(e, it.id)}
                        onClick={() => setSel(it.id)} />
                    )}
                  </Fragment>
                ))}
              </div>
              <button className="pe-add-occ" title="Add a training from the learning path" onClick={() => setAddForComp(lane.competency_id)}>+</button>
            </div>
          ))}
          {lanes.length === 0 && <p className="muted" style={{ padding: 12 }}>No competencies need development for this plan.</p>}
        </div></div>
      </div>

      {selItem && (
        <div className="pe-detail">
          {selItem.kind === 'missing' ? (
            <>
              <div className="pe-detail-main">
                <div className="pe-detail-name">Training to be defined</div>
                <div className="muted">No training is defined to take {compName(selItem.competency_id)} to level {selItem.to_level}. Add one to this competency's learning path on the Nuclear Competencies page, then it will appear here.</div>
              </div>
              <div className="pe-detail-actions">
                <button className="link-btn danger" onClick={() => removeLine(selItem.id)}>Remove</button>
              </div>
            </>
          ) : (
            <>
              <div className="pe-detail-main">
                <div className="pe-detail-name">{trainingById[selItem.training_id ?? '']?.title ?? 'Training'}</div>
                <div className="muted">{compName(selItem.competency_id)} · takes them to level {selItem.to_level} · month {(selItem.start_month ?? 0) + 1}</div>
              </div>
              <div className="pe-detail-actions">
                <label className="pe-trainer-lbl">Trainer
                  <select className="field pe-trainer" value={selItem.trainer_id ?? ''} onChange={(e) => setTrainer(selItem.id, e.target.value || null)}>
                    <option value="">Unassigned</option>
                    {selTrainerOpts.map((t) => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                  </select>
                </label>
                {selTrainerOpts.length === 0 && <span className="muted">No approved trainers for this training yet.</span>}
                <button className="link-btn danger" onClick={() => removeLine(selItem.id)}>Remove</button>
              </div>
            </>
          )}
        </div>
      )}

      {addForComp && (
        <PathPickModal
          options={pathOptions(addForComp)}
          competencyName={compName(addForComp)}
          onAdd={(tid, level) => addPathTraining(addForComp, tid, level)}
          onClose={() => setAddForComp(null)}
        />
      )}
    </div>
  );
}

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
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [paths, setPaths] = useState<CompetencyLevelPath[]>([]);
  const [trainings, setTrainingsList] = useState<Training[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [deliverers, setDeliverers] = useState<TrainingDeliverer[]>([]);
  const [planning, setPlanning] = useState(false);
  const [building, setBuilding] = useState(false);
  const [planDone, setPlanDone] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [rolesEdit, setRolesEdit] = useState(false);
  const [editSel, setEditSel] = useState<string[]>([]);
  const [pathComp, setPathComp] = useState<{ id: string; competency: string; current: number; target: number } | null>(null);
  const [reassessId, setReassessId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [moveReqs, setMoveReqs] = useState<{ id: string; plan_item_id: string; requested_month: number }[]>([]);
  const [cvRunning, setCvRunning] = useState(false);
  const [cvMsg, setCvMsg] = useState<string | null>(null);
  const [setupWiz, setSetupWiz] = useState(0);
  const [roleQuery, setRoleQuery] = useState('');
  const [roleOpen, setRoleOpen] = useState(false);
  const roleInputRef = useRef<HTMLInputElement>(null);
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [selfNotes, setSelfNotes] = useState<Record<string, string>>({});
  const [saIdx, setSaIdx] = useState(0);
  const [valScores, setValScores] = useState<Record<string, number>>({});
  const [vaIdx, setVaIdx] = useState(0);
  const [confirmSubmit, setConfirmSubmit] = useState<null | 'self' | 'validation'>(null);
  const [drillCat, setDrillCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<number | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [c, r, a, k, rc, cat, sub, clt, clp, tns, trn, del] = await Promise.all([
      supabase.from('consultants').select('*').eq('id', id).maybeSingle(),
      supabase.from('roles').select('*').order('is_base', { ascending: false }).order('sort_order').order('name'),
      supabase.from('assessments').select('*').eq('consultant_id', id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('competencies').select('*'),
      supabase.from('role_competencies').select('*'),
      supabase.from('competency_categories').select('*'),
      supabase.from('competency_subcategories').select('*'),
      supabase.from('competency_level_trainings').select('*'),
      supabase.from('competency_level_paths').select('*'),
      supabase.from('trainings').select('*'),
      supabase.from('trainers').select('*'),
      supabase.from('training_deliverers').select('*'),
    ]);
    const err = c.error || r.error || a.error || k.error || rc.error || cat.error || sub.error || clt.error || clp.error || tns.error || trn.error || del.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError(null);
    setConsultant((c.data as Consultant) ?? null);
    setRoles((r.data as Role[]) ?? []);
    setComps((k.data as Competency[]) ?? []);
    setRoleComps((rc.data as RoleCompetency[]) ?? []);
    setCats((cat.data as CompetencyCategory[]) ?? []);
    setSubs((sub.data as CompetencySubcategory[]) ?? []);
    setClts((clt.data as CompetencyLevelTraining[]) ?? []);
    setPaths((clp.data as CompetencyLevelPath[]) ?? []);
    setTrainingsList((tns.data as Training[]) ?? []);
    setTrainers((trn.data as Trainer[]) ?? []);
    setDeliverers((del.data as TrainingDeliverer[]) ?? []);
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
        description: c.description,
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
  const drillData = useMemo(
    () => (drillCat ? liveComps.filter((c) => c.category === drillCat).map((c) => ({ id: c.id, competency: c.name, current: c.current, target: c.required })) : []),
    [drillCat, liveComps],
  );
  const atRequired = useMemo(() => liveComps.filter((c) => c.required > 0 && c.current >= c.required).length, [liveComps]);
  // Competencies still below their required level, biggest shortfall first; flag any with no training to close the gap.
  const gaps = useMemo(
    () => liveComps
      .filter((c) => c.required > 0 && c.current < c.required)
      .map((c) => ({
        ...c,
        gap: c.required - c.current,
        noTraining: !clts.some((t) => t.competency_id === c.id && t.level > c.current && t.level <= c.required),
      }))
      .sort((a, b) => b.gap - a.gap || a.name.localeCompare(b.name)),
    [liveComps, clts],
  );
  const validated = !!assessment && ['planning', 'plan_review', 'delivered'].includes(assessment.status);
  const nonBaseRoles = useMemo(() => roles.filter((r) => !r.is_base), [roles]);
  const rolesAdding = editSel.some((r) => !selected.includes(r));

  const trainingById = useMemo(() => Object.fromEntries(trainings.map((t) => [t.id, t])), [trainings]);
  const compName = (cid: string | null) => comps.find((c) => c.id === cid)?.name ?? 'Competency';
  const planForGantt: PlannedTraining[] = useMemo(() => planItems.map((p) => {
    const isMissing = p.kind === 'missing';
    const trainingTitle = p.training_id ? trainingById[p.training_id]?.title : null;
    return {
      id: p.id,
      name: isMissing ? 'Training missing' : (trainingTitle ?? p.title ?? 'Training'),
      competency: compName(p.competency_id),
      fromLevel: p.from_level,
      toLevel: p.to_level,
      startMonth: p.start_month ?? 0,
      durationMonths: p.duration_months,
      status: isMissing ? 'missing' : p.status === 'assessed' ? 'done' : p.status === 'delivered' ? 'in_progress' : 'upcoming',
    } as PlannedTraining;
  }), [planItems, trainingById, comps]);

  const reassessData = useMemo(() => {
    if (!reassessId) return null;
    const pi = planItems.find((p) => p.id === reassessId);
    if (!pi) return null;
    // Each diamond is one competency/level step, so reassess that competency.
    const ids = pi.competency_id
      ? [pi.competency_id]
      : (pi.training_id ? clts.filter((x) => x.training_id === pi.training_id).map((x) => x.competency_id) : []);
    const cs = applicable.filter((c) => ids.includes(c.id)).map((c) => {
      const sc = scoreByComp[c.id];
      return { id: c.id, name: c.name, current: sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0, required: c.required };
    });
    const trainerName = trainers.find((t) => t.id === pi.trainer_id)?.display_name ?? null;
    const trainingTitle = (pi.training_id ? trainingById[pi.training_id]?.title : null) ?? 'Training';
    return { pi, comps: cs, trainerName, trainingTitle };
  }, [reassessId, planItems, clts, applicable, scoreByComp, trainers, trainingById]);

  const historyTitle = useMemo(() => {
    if (!historyId) return '';
    const pi = planItems.find((p) => p.id === historyId);
    return (pi?.training_id ? trainingById[pi.training_id]?.title : null) ?? 'Training';
  }, [historyId, planItems, trainingById]);

  const missingInfo = useMemo(() => {
    if (!missingId) return null;
    const pi = planItems.find((p) => p.id === missingId);
    if (!pi || !pi.competency_id) return null;
    return { comp: { id: pi.competency_id, name: compName(pi.competency_id) }, fromLevel: pi.from_level, toLevel: pi.to_level };
  }, [missingId, planItems]);

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
  // One ordered list for the step-by-step self-assessment.
  const selfList = useMemo(() => selfGroups.flatMap((g) => g.items.map((c) => ({ ...c, category: g.name }))), [selfGroups]);
  // Per-competency, per-level expectation text from the library.
  const LEVEL_NAME: Record<number, string> = { 1: 'No knowledge', 2: 'Awareness', 3: 'Basic competence', 4: 'Full competence (SQEP)', 5: 'Expert' };
  function expectation(competencyId: string, level: number): string {
    if (level < 1) return '';
    const p = paths.find((x) => x.competency_id === competencyId && x.level === level);
    return p?.actions?.trim() || `${LEVEL_NAME[level]} — no detailed description set in the library for this level.`;
  }

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

  useEffect(() => {
    if (!isStaff || planItems.length === 0) { setMoveReqs([]); return; }
    (async () => {
      const ids = planItems.map((p) => p.id);
      const { data } = await supabase.from('plan_move_requests').select('id, plan_item_id, requested_month').in('plan_item_id', ids).eq('status', 'pending');
      setMoveReqs((data as { id: string; plan_item_id: string; requested_month: number }[]) ?? []);
    })();
  }, [planItems, isStaff]);

  async function decideMove(reqId: string, accept: boolean) {
    const { error } = await supabase.rpc('decide_training_move', { p_request_id: reqId, p_accept: accept });
    if (error) { setError(error.message); return; }
    load();
  }
  const autoRef = useRef(false);
  useEffect(() => {
    if (!loading && needsSelf && !autoRef.current) { autoRef.current = true; setModalStep(1); }
  }, [loading, needsSelf]);

  useEffect(() => {
    if (modalStep === 1) {
      const seed: Record<string, number> = {};
      const seedNotes: Record<string, string> = {};
      applicable.forEach((c) => { const sc = scoreByComp[c.id]; seed[c.id] = sc?.self_level ?? sc?.ai_level ?? 0; seedNotes[c.id] = sc?.self_note ?? ''; });
      setSelfScores(seed);
      setSelfNotes(seedNotes);
      setSaIdx(0);
    }
    if (modalStep === 2) {
      const seed: Record<string, number> = {};
      applicable.forEach((c) => { const sc = scoreByComp[c.id]; seed[c.id] = sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0; });
      setValScores(seed);
      setVaIdx(0);
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

  function openRolesEdit() { setEditSel([...selected]); setRolesEdit(true); }
  async function saveRoles() {
    if (!assessment) return;
    setSaving(true); setError(null);
    const added = editSel.filter((r) => !selected.includes(r));
    await supabase.from('assessment_roles').delete().eq('assessment_id', assessment.id);
    if (editSel.length) {
      const { error } = await supabase.from('assessment_roles').insert(editSel.map((role_id) => ({ assessment_id: assessment.id, role_id })));
      if (error) { setError(error.message); setSaving(false); return; }
    }
    // Adding roles widens scope, so the assessment restarts from self-assessment.
    if (added.length) await supabase.from('assessments').update({ status: 'self_assessment' }).eq('id', assessment.id);
    setSaving(false); setRolesEdit(false); await load();
  }

  async function generatePlan() {
    if (!assessment) return;
    setPlanning(true); setBuilding(true); setPlanDone(false); setError(null);
    const started = Date.now();
    const horizon = assessment.horizon_months ?? 18;
    const spacing = 2; // months between consecutive steps within a competency
    // Build a stepwise roadmap per competency: one diamond for each level from the
    // current level up to the required level, in order, each tied to the training that reaches it.
    const rows: Array<Record<string, unknown>> = [];
    let order = 0;
    applicable.forEach((c) => {
      const sc = scoreByComp[c.id];
      const cur = sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0;
      let step = 0;
      for (let L = Math.max(cur + 1, 2); L <= c.required; L++) {
        const tr = clts.find((x) => x.competency_id === c.id && x.level === L);
        const startMonth = Math.min(step * spacing, horizon - 1);
        rows.push({
          assessment_id: assessment.id,
          kind: tr ? 'training' : 'missing',
          training_id: tr ? tr.training_id : null,
          competency_id: c.id,
          from_level: L - 1,
          to_level: L,
          start_month: startMonth,
          duration_months: 1,
          status: 'planned',
          sort_order: order++,
        });
        step++;
      }
    });
    await supabase.from('plan_items').delete().eq('assessment_id', assessment.id);
    if (rows.length) { const { error } = await supabase.from('plan_items').insert(rows); if (error) setError(error.message); }
    await supabase.from('assessments').update({ status: 'plan_review' }).eq('id', assessment.id);
    await load();
    const elapsed = Date.now() - started;
    if (elapsed < 1900) await new Promise((r) => setTimeout(r, 1900 - elapsed));
    setPlanning(false); setBuilding(false); setPlanDone(true);
  }

  // Group the plan into per-competency lanes for the report, in the same order as on screen.
  function reportLanes(): PlanReportLane[] {
    const order = new Map(applicable.map((c, i) => [c.id, i] as const));
    const byComp = new Map<string, PlanItem[]>();
    planItems.forEach((p) => { const k = p.competency_id ?? 'none'; const a = byComp.get(k) ?? []; a.push(p); byComp.set(k, a); });
    return [...byComp.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999))
      .map(([cid, items]) => ({
        name: compName(cid),
        steps: items
          .sort((a, b) => (a.to_level - b.to_level) || ((a.start_month ?? 0) - (b.start_month ?? 0)))
          .map((p) => ({
            toLevel: p.to_level,
            month: (p.start_month ?? 0) + 1,
            training: (p.training_id ? trainingById[p.training_id]?.title : null) ?? 'Training',
            status: (p.kind === 'missing' ? 'missing' : p.status === 'assessed' ? 'assessed' : p.status === 'delivered' ? 'delivered' : 'planned') as PlanReportStep['status'],
          })),
      }));
  }

  async function generateBrief() {
    if (!assessment) return;
    setBriefBusy(true); setBriefErr(null);
    const competencies = applicable.map((c) => {
      const sc = scoreByComp[c.id];
      return { name: c.name, category: c.category, current: sc?.validated_level ?? sc?.self_level ?? sc?.ai_level ?? 0, required: c.required };
    });
    const steps = planItems
      .filter((p) => p.kind !== 'missing')
      .map((p) => ({ competency: compName(p.competency_id), training: (p.training_id ? trainingById[p.training_id]?.title : null) ?? 'Training', to_level: p.to_level, month: (p.start_month ?? 0) + 1 }));
    try {
      const { data, error } = await supabase.functions.invoke('plan-summary', {
        body: { consultant_name: name, horizon_months: assessment.horizon_months ?? 18, competencies, steps },
      });
      if (error) throw new Error(error.message);
      const summary = (data as { summary?: string })?.summary?.trim();
      if (!summary) throw new Error('No summary returned');
      const { error: upErr } = await supabase.from('assessments').update({ plan_summary: summary }).eq('id', assessment.id);
      if (upErr) throw upErr;
      setAssessment({ ...assessment, plan_summary: summary });
    } catch (e) {
      setBriefErr(e instanceof Error ? e.message : 'Could not generate the brief');
    } finally {
      setBriefBusy(false);
    }
  }

  function printPlan() {
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const doc = generatePlanReportPDF(
      {
        consultantName: name,
        jobTitle: consultant?.job_title ?? null,
        technicalDirector: consultant?.td_full_name ?? null,
        horizonMonths: assessment?.horizon_months ?? 18,
        date: today,
        reference: assessment ? `PLAN-${assessment.id.slice(0, 8).toUpperCase()}` : undefined,
      },
      assessment?.plan_summary ?? null,
      reportLanes(),
    );
    doc.save(`${name} - Upskilling Plan.pdf`);
  }

  async function submitSelf() {
    if (!assessment) return;
    setSaving(true); setError(null);
    const rows = applicable.map((c) => ({ assessment_id: assessment.id, competency_id: c.id, self_level: selfScores[c.id] ?? 0, self_note: (selfNotes[c.id] ?? '').trim() || null }));
    const { error: upErr } = await supabase.from('assessment_scores').upsert(rows, { onConflict: 'assessment_id,competency_id' });
    if (upErr) { setError(upErr.message); setSaving(false); return; }
    const { data: upd, error } = await supabase.from('assessments').update({ status: 'validation' }).eq('id', assessment.id).select('id');
    if (error) { setError(error.message); setSaving(false); return; }
    if (!upd || upd.length === 0) { setError('Could not submit. You may not have permission to update this assessment.'); setSaving(false); return; }
    setSaving(false);
    await load(); // status is now validation, so the modal shows the report
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
  const firstName = consultant.first_name || consultant.full_name?.split(' ')[0] || 'this consultant';

  return (
    <div className="profile">
      <div className="page-head">
        <Link className="back-link" to="/consultants">← Consultants</Link>
        <h1>{name}</h1>
        <p>{consultant.job_title ? consultant.job_title : 'Consultant'}{consultant.is_active ? '' : ' · Leaver'}</p>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      <NuclearisationProcess steps={STEPS} current={current} onSelect={(i) => { if (i === 0) setSetupWiz(0); setModalStep(i); }} />

      <div className="profile-top">
        <div className="card fig-card">
          {validated ? (
            <>
              <Figure progress={progress} full={full} />
              <div className="fig-readout">
                <div className="big-pct">{pct}%</div>
                <div className="fig-caption">SQEPimeter</div>
                {full
                  ? <div className="fig-sqepified">This consultant is SQEPified</div>
                  : <div className="fig-sub">{atRequired}/{liveComps.length} competencies at the required level</div>}
              </div>
            </>
          ) : (
            <div className="fig-placeholder">
              <div className="fig-placeholder-atom"><span /><span /><span /></div>
              <p className="muted">The SQEPimeter appears once the assessment is validated.</p>
            </div>
          )}
        </div>

        <div className="profile-rstack">
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
            <h2 className="panel-title">Roles</h2>
            {!assessment ? (
              <>
                <p className="assess-missing"><span className="dot-missing" />No assessment yet</p>
                <button className="btn btn-primary" onClick={openSetup}>Start assessment</button>
              </>
            ) : (
              <>
                <div className="chip-wrap">
                  <span className="role-chip locked">Base Nuclear</span>
                  {selected.map((rid) => <span className="role-chip" key={rid}>{roleName(rid)}</span>)}
                </div>
                {isStaff && <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={openRolesEdit}>Edit roles</button>}
              </>
            )}
          </div>
        </div>

        <div className="card radar-card">
          <div className="radar-head">
            <h2>Competency map{drillCat && <> · <span className="radar-cat">{drillCat}</span></>}</h2>
            {drillCat && <button className="link-btn" onClick={() => setDrillCat(null)}>← All categories</button>}
          </div>
          {hasScores && !drillCat && <p className="muted radar-roles">Click a category to see its competencies.</p>}
          {hasScores ? (
            <>
              {drillCat ? (
                <LevelBars items={drillData} onSelect={(it) => setPathComp(it)} />
              ) : (
                <Radar
                  key="all"
                  comps={radarData}
                  onAxisClick={(label) => setDrillCat(label)}
                />
              )}
              <div className="radar-key"><span><i className="key-cur" /> Current</span><span><i className="key-tgt" /> Target</span></div>
            </>
          ) : (
            <EmptyViz title="Not assessed yet" hint="Map fills in once the consultant completes their self-assessment." />
          )}
        </div>

        <div className="card gaps-card">
          <h2 className="panel-title">Gaps to SQEP</h2>
          {!validated ? (
            <p className="muted">Appears once the assessment is validated.</p>
          ) : gaps.length === 0 ? (
            <p className="gaps-clear"><span className="dot-ok" />At or above the required level on every competency.</p>
          ) : (
            <ul className="gaps-list">
              {gaps.map((g) => (
                <li className="gap-row" key={g.id}>
                  <div className="gap-main">
                    <span className="gap-name" title={g.name}>{g.name}</span>
                    {g.noTraining && <span className="gap-flag">No training</span>}
                  </div>
                  <span className="gap-lvls">{g.current} → {g.required}</span>
                  <span className="gap-badge">+{g.gap}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="profile-plan">
        {isStaff && moveReqs.length > 0 && (
          <div className="card move-reqs">
            <h2 className="panel-title">Move requests</h2>
            {moveReqs.map((r) => {
              const pi = planItems.find((p) => p.id === r.plan_item_id);
              const tname = (pi?.training_id ? trainingById[pi.training_id]?.title : null) ?? 'Training';
              return (
                <div className="move-req" key={r.id}>
                  <div className="move-req-main"><strong>{tname}</strong> <span className="muted">M{(pi?.start_month ?? 0) + 1} → M{r.requested_month + 1}</span></div>
                  <div className="move-req-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => decideMove(r.id, true)}>Accept</button>
                    <button className="link-btn" onClick={() => decideMove(r.id, false)}>Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="card gantt-card">
          <div className="gantt-head">
            <h2>Training plan</h2>
            {isStaff && planForGantt.length > 0 && (
              <div className="gantt-head-actions">
                <button className="btn btn-sm" onClick={generateBrief} disabled={briefBusy}>{briefBusy ? 'Writing…' : (assessment?.plan_summary ? 'Regenerate brief' : 'Generate brief')}</button>
                <button className="btn btn-sm" onClick={printPlan}>Print plan</button>
                <button className="btn btn-sm" onClick={() => setEditorOpen(true)}>Edit</button>
              </div>
            )}
          </div>
          {assessment?.plan_summary && <p className="plan-brief">{assessment.plan_summary}</p>}
          {briefErr && <p className="sync-msg err">{briefErr}</p>}
          {planForGantt.length ? <Gantt trainings={planForGantt} minMonths={assessment?.horizon_months ?? 18} canReassess={isStaff} onReassess={(id) => setReassessId(id)} onHistory={(id) => setHistoryId(id)} onMissing={(id) => setMissingId(id)} /> : (
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
                  <p className="muted">Which roles is this consultant assessed against?</p>

                  <div className="rolepick-chips">
                    {baseRole && <span className="role-chip locked">{baseRole.name}</span>}
                    {selected.map((rid) => (
                      <span className="role-chip" key={rid}>{roleName(rid)}
                        <button className="role-chip-x" onMouseDown={(e) => e.preventDefault()} onClick={() => toggle(rid)} aria-label={`Remove ${roleName(rid)}`}>×</button>
                      </span>
                    ))}
                  </div>

                  {otherRoles.length === 0 ? (
                    <p className="muted role-chip-hint">No role-based roles defined yet.</p>
                  ) : (
                    <div className="rolepick">
                      <input ref={roleInputRef} className="field rolepick-input" value={roleQuery}
                        placeholder="Search roles to add…"
                        onChange={(e) => { setRoleQuery(e.target.value); setRoleOpen(true); }}
                        onFocus={() => setRoleOpen(true)}
                        onBlur={() => setTimeout(() => setRoleOpen(false), 150)} />
                      {roleOpen && (() => {
                        const matches = otherRoles.filter((r) => !selected.includes(r.id) && r.name.toLowerCase().includes(roleQuery.trim().toLowerCase()));
                        return (
                          <div className="rolepick-menu">
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
              ) : (isSelf || user?.product_role === 'superadmin') && assessment.status === 'self_assessment' ? (
                (() => {
                  const c = selfList[saIdx];
                  if (!c) return null;
                  const lvl = selfScores[c.id] ?? 0;
                  const note = selfNotes[c.id] ?? '';
                  const ai = scoreByComp[c.id]?.ai_level;
                  const canNext = lvl > 0 && note.trim().length > 0;
                  const last = saIdx === selfList.length - 1;
                  return (
                    <div className="sa-wiz">
                      <div className="sa-wiz-top">
                        <span className="sa-wiz-prog">Competency {saIdx + 1} of {selfList.length}</span>
                        <span className="sa-wiz-cat">{c.category}</span>
                      </div>
                      <h3 className="sa-wiz-name">{c.name}</h3>
                      {c.description && <p className="sa-wiz-desc">{c.description}</p>}
                      <div className="sa-wiz-stars">
                        <StarRating value={lvl} onChange={(v) => setSelfScores((s) => ({ ...s, [c.id]: v }))} showLabel size="md" />
                        {ai != null && <span className="sa-ai">AI suggested {ai}</span>}
                      </div>
                      {lvl > 0 && (
                        <div className="sa-expect"><p>{expectation(c.id, lvl)}</p></div>
                      )}
                      <label className="sa-reason-lbl">Explain your assessment <span className="req">*</span>
                        <textarea className="field" rows={3} value={note} placeholder="e.g. led two safety case reviews on operating plant" onChange={(e) => setSelfNotes((s) => ({ ...s, [c.id]: e.target.value }))} />
                      </label>
                      {error && <p className="sync-msg err">{error}</p>}
                      <div className="sa-wiz-foot">
                        <button className="link-btn" disabled={saIdx === 0} onClick={() => setSaIdx((i) => Math.max(0, i - 1))}>Back</button>
                        {last ? (
                          <button className="btn btn-primary" disabled={!canNext || saving} onClick={() => setConfirmSubmit('self')}>{saving ? 'Submitting…' : 'Submit self-assessment'}</button>
                        ) : (
                          <button className="btn btn-primary" disabled={!canNext} onClick={() => setSaIdx((i) => i + 1)}>Next</button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : assessment.status === 'self_assessment' ? (
                <p className="muted">Waiting for the consultant to complete their self-assessment. You'll be able to validate once they submit it.</p>
              ) : (
                <>
                  <p className="muted">{(isSelf || user?.product_role === 'superadmin') ? 'Your submitted self-assessment.' : 'The consultant’s self-assessment.'}</p>
                  <div className="sa-report">
                    {selfList.map((c) => {
                      const sc = scoreByComp[c.id];
                      const lvl = sc?.self_level ?? 0;
                      return (
                        <div className="sa-rep-item" key={c.id}>
                          <div className="sa-rep-head"><span className="sa-rep-name">{c.name}</span><span className="cohort-pill">{LEVEL_NAME[lvl] ?? 'Not rated'} ({lvl})</span></div>
                          <div className="sa-rep-line"><span className="muted">Expectation:</span> {expectation(c.id, lvl)}</div>
                          <div className="sa-rep-line"><span className="muted">Reasoning:</span> {sc?.self_note?.trim() || '—'}</div>
                        </div>
                      );
                    })}
                  </div>
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
                (() => {
                  const c = selfList[vaIdx];
                  if (!c) return null;
                  const sc = scoreByComp[c.id];
                  const sl = sc?.self_level ?? 0;
                  const vl = valScores[c.id] ?? 0;
                  const last = vaIdx === selfList.length - 1;
                  return (
                    <div className="sa-wiz">
                      <div className="sa-wiz-top">
                        <span className="sa-wiz-prog">Competency {vaIdx + 1} of {selfList.length}</span>
                        <span className="sa-wiz-cat">{c.category}</span>
                      </div>
                      <h3 className="sa-wiz-name">{c.name}</h3>
                      {c.description && <p className="sa-wiz-desc">{c.description}</p>}
                      <div className="sa-rep-line"><span className="muted">Consultant:</span> {sl > 0 ? `self-rated ${sl} · ${LEVEL_NAME[sl]}` : 'no self-assessment'}{sc?.ai_level != null ? ` · AI ${sc.ai_level}` : ''}{` · required ${c.required}`}</div>
                      <div className="sa-rep-line"><span className="muted">Reasoning:</span> {sc?.self_note?.trim() || '—'}</div>
                      <div className="sa-val-set">
                        <span className="muted">Validated level</span>
                        <StarRating value={vl} onChange={(v) => setValScores((s) => ({ ...s, [c.id]: v }))} showLabel size="md" />
                      </div>
                      {vl > 0 && <div className="sa-expect"><p>{expectation(c.id, vl)}</p></div>}
                      {error && <p className="sync-msg err">{error}</p>}
                      <div className="sa-wiz-foot">
                        <button className="link-btn" disabled={vaIdx === 0} onClick={() => setVaIdx((i) => Math.max(0, i - 1))}>Back</button>
                        {last ? (
                          <button className="btn btn-primary" disabled={vl < 1 || saving} onClick={() => setConfirmSubmit('validation')}>{saving ? 'Validating…' : 'Submit validation'}</button>
                        ) : (
                          <button className="btn btn-primary" disabled={vl < 1} onClick={() => setVaIdx((i) => i + 1)}>Next</button>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan: build animation, then complete + refine */}
      {modalStep === 3 && (
        <div className="modal-overlay" onClick={() => !building && setModalStep(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Plan</h2><button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close" disabled={building}>×</button></div>
            <div className="modal-step">
              {!isStaff ? (
                <p className="muted">Your Technical Director builds and runs your training plan. It appears on your profile and fills in as trainings are completed and confirmed.</p>
              ) : !assessment ? (
                <p className="muted">Earlier steps have to be completed first.</p>
              ) : applicable.length === 0 ? (
                <p className="muted">No competencies in scope yet.</p>
              ) : building ? (
                <div className="nuke-anim">
                  <div className="nuke-atom"><span /><span /><span /><i /></div>
                  <p className="nuke-msg">Nuclearising {firstName}…</p>
                  <p className="muted">Building the plan to close every gap to the required level.</p>
                </div>
              ) : (planItems.length > 0 || planDone) ? (
                <div className="nuke-done">
                  <div className="nuke-check">✓</div>
                  <p className="nuke-msg">Nuclearisation plan complete</p>
                  <p className="muted">{planItems.length} training{planItems.length === 1 ? '' : 's'} scheduled to take {firstName} to SQEP.</p>
                  <button className="btn btn-primary btn-block" onClick={() => { setModalStep(null); setEditorOpen(true); }}>View and refine</button>
                  <button className="link-btn" onClick={generatePlan} disabled={planning}>{planning ? 'Rebuilding…' : 'Regenerate from gaps'}</button>
                </div>
              ) : (
                <>
                  <p className="muted">Build the plan from the gap between each validated level and the role's required level, using the trainings on each competency's learning path.</p>
                  <button className="btn btn-primary btn-block" onClick={generatePlan} disabled={planning}>Build plan</button>
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

      {reassessData && assessment && (
        <ReassessModal
          planItemId={reassessData.pi.id}
          trainingTitle={reassessData.trainingTitle}
          trainerName={reassessData.trainerName}
          comps={reassessData.comps}
          assessmentId={assessment.id}
          userId={user?.id}
          onSaved={() => { setReassessId(null); load(); }}
          onClose={() => setReassessId(null)}
        />
      )}

      {historyId && (
        <HistoryModal planItemId={historyId} trainingTitle={historyTitle} nameOf={compName} onClose={() => setHistoryId(null)} />
      )}

      {missingInfo && (
        <MissingTrainingModal
          comp={missingInfo.comp}
          fromLevel={missingInfo.fromLevel}
          toLevel={missingInfo.toLevel}
          missingId={missingId!}
          trainers={trainers}
          existing={planItems}
          onDone={() => { setMissingId(null); load(); }}
          onClose={() => setMissingId(null)}
        />
      )}

      {pathComp && (
        <LearningPathModal
          comp={pathComp}
          clts={clts}
          trainingById={trainingById}
          planItems={planItems}
          assessmentId={assessment?.id ?? null}
          isStaff={isStaff}
          onChanged={() => { load(); }}
          onClose={() => setPathComp(null)}
        />
      )}

      {rolesEdit && (
        <div className="modal-overlay" onClick={() => setRolesEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Roles</h2><button className="modal-close" onClick={() => setRolesEdit(false)} aria-label="Close">×</button></div>
            <div className="modal-step">
              <div className="role-pick">
                <span className="role-chip locked">Base Nuclear</span>
                {nonBaseRoles.map((r) => (
                  <button key={r.id} type="button" className={`role-chip toggle${editSel.includes(r.id) ? ' on' : ''}`}
                    onClick={() => setEditSel((s) => (s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id]))}>
                    {r.name}
                  </button>
                ))}
              </div>
              {rolesAdding && <p className="sync-msg err" style={{ marginTop: 14 }}>Adding a role widens what this consultant is assessed against. Saving restarts the assessment from self-assessment.</p>}
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={saveRoles} disabled={saving}>
                {saving ? 'Saving…' : rolesAdding ? 'Save and restart assessment' : 'Save roles'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editorOpen && assessment && (
        <PlanEditor
          assessmentId={assessment.id}
          horizon={assessment.horizon_months ?? 18}
          comps={comps}
          clts={clts}
          trainingById={trainingById}
          trainers={trainers}
          deliverers={deliverers}
          initialItems={planItems}
          onClose={() => { setEditorOpen(false); load(); }}
        />
      )}

      {needsSelf && modalStep !== 1 && (
        <button className="self-nudge" onClick={() => setModalStep(1)}>
          <span className="self-nudge-dot" />Complete your self-assessment
        </button>
      )}
      {confirmSubmit && (
        <ConfirmDialog
          title={confirmSubmit === 'self' ? 'Submit self-assessment?' : 'Submit validation?'}
          message="Once submitted this can't be changed."
          confirmLabel="Submit"
          onConfirm={() => { const what = confirmSubmit; setConfirmSubmit(null); if (what === 'self') submitSelf(); else submitValidation(); }}
          onCancel={() => setConfirmSubmit(null)}
        />
      )}
    </div>
  );
}
