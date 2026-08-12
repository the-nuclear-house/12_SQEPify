import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import type {
  Competency,
  CompetencyCategory,
  CompetencyLevelTraining,
  Trainer,
  Training,
  TrainingDeliverer,
} from '../lib/types';

type Status = 'active' | 'required';
type Modal = { mode: 'new' } | { mode: 'edit'; training: Training } | null;
type View = 'family' | 'category' | 'all';
type StatusFilter = 'all' | 'active' | 'required';

/** The Nuclear House's published training families, in the order they are presented. */
const FAMILIES = [
  'Engineering disciplines',
  'Safety & regulatory',
  'Safety analysis & assessment',
  'Lifecycle & delivery',
  'Operational awareness for designers',
  'Project controls & planning',
  'Soft skills',
];

const MODES: { value: string; label: string }[] = [
  { value: 'in_person', label: 'Face to face' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'elearning', label: 'E-learning' },
  { value: 'blended', label: 'Blended' },
  { value: 'coaching', label: 'Coaching (1:1)' },
  { value: 'on_the_job', label: 'On the job' },
];
const PACING: { value: string; label: string }[] = [
  { value: 'instructor_led', label: 'Instructor-led' },
  { value: 'self_paced', label: 'Self-paced' },
];
const ASSESSMENTS: { value: string; label: string }[] = [
  { value: 'none', label: 'No assessment' },
  { value: 'knowledge_check', label: 'Knowledge check' },
  { value: 'exam', label: 'Exam' },
  { value: 'practical_observation', label: 'Practical observation' },
  { value: 'portfolio', label: 'Portfolio' },
];

const labelOf = (list: { value: string; label: string }[], v: string | null) =>
  (v && list.find((x) => x.value === v)?.label) || null;

/** One place a training sits on a learning path: a competency, and the level it reaches. */
interface PathUse {
  compId: string;
  compName: string;
  catId: string;
  catName: string;
  level: number;
}

export default function TrainingCatalogue() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [links, setLinks] = useState<TrainingDeliverer[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [clts, setClts] = useState<CompetencyLevelTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [view, setView] = useState<View>('family');
  const [detail, setDetail] = useState<Training | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState('');
  const [family, setFamily] = useState('');
  const [hours, setHours] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [mode, setMode] = useState('');
  const [pace, setPace] = useState('');
  const [provider, setProvider] = useState('');
  const [assessment, setAssessment] = useState('');
  const [certificate, setCertificate] = useState(false);
  const [validity, setValidity] = useState('');
  const [description, setDescription] = useState('');
  const [outcomes, setOutcomes] = useState('');
  const [delivererIds, setDelivererIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [t, l, r, c, k, p] = await Promise.all([
      supabase.from('trainings').select('*').order('title'),
      supabase.from('training_deliverers').select('*'),
      supabase.from('trainers').select('*').order('display_name'),
      supabase.from('competency_categories').select('*').order('sort_order').order('name'),
      supabase.from('competencies').select('*').order('name'),
      supabase.from('competency_level_trainings').select('*'),
    ]);
    const err = t.error || l.error || r.error || c.error || k.error || p.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setTrainings((t.data as Training[]) ?? []);
      setLinks((l.data as TrainingDeliverer[]) ?? []);
      setTrainers((r.data as Trainer[]) ?? []);
      setCats((c.data as CompetencyCategory[]) ?? []);
      setComps((k.data as Competency[]) ?? []);
      setClts((p.data as CompetencyLevelTraining[]) ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const trainerById = useMemo(() => Object.fromEntries(trainers.map((t) => [t.id, t])), [trainers]);
  const delByTraining = useMemo(() => {
    const m: Record<string, string[]> = {};
    links.forEach((l) => (m[l.training_id] ??= []).push(l.trainer_id));
    return m;
  }, [links]);

  const compById = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c])), [comps]);
  const catNameById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);

  // Where each training is used: the competencies whose learning path it sits on.
  const pathsByTraining = useMemo(() => {
    const m: Record<string, PathUse[]> = {};
    clts.forEach((r) => {
      const c = compById[r.competency_id];
      if (!c) return;
      (m[r.training_id] ??= []).push({
        compId: c.id,
        compName: c.name,
        catId: c.category_id,
        catName: catNameById[c.category_id] ?? 'Uncategorised',
        level: r.level,
      });
    });
    Object.values(m).forEach((a) =>
      a.sort((x, y) => x.compName.localeCompare(y.compName) || x.level - y.level),
    );
    return m;
  }, [clts, compById, catNameById]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trainings.filter((t) => {
      if (statusFilter === 'active' && t.status === 'required') return false;
      if (statusFilter === 'required' && t.status !== 'required') return false;
      if (modeFilter !== 'all' && t.delivery_mode !== modeFilter) return false;
      if (!needle) return true;
      const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name ?? '');
      const uses = pathsByTraining[t.id] ?? [];
      const hay = [
        t.title,
        t.family ?? '',
        t.description ?? '',
        t.provider ?? '',
        ...(t.outcomes ?? []),
        ...dels,
        ...uses.map((u) => u.compName),
        ...uses.map((u) => u.catName),
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [trainings, q, statusFilter, modeFilter, delByTraining, trainerById, pathsByTraining]);

  // Grouped by the published training family, in catalogue order.
  const byFamily = useMemo(() => {
    const out: { id: string; name: string; items: Training[] }[] = [];
    const known = new Set(FAMILIES);
    FAMILIES.forEach((f) => {
      const items = filtered.filter((t) => t.family === f);
      if (items.length) out.push({ id: f, name: f, items });
    });
    // Anything filed under a family not in the published list, then anything unfiled.
    const extras = [...new Set(filtered.map((t) => t.family).filter((f): f is string => !!f && !known.has(f)))].sort();
    extras.forEach((f) => out.push({ id: f, name: f, items: filtered.filter((t) => t.family === f) }));
    const none = filtered.filter((t) => !t.family);
    if (none.length) out.push({ id: 'none', name: 'No family set', items: none });
    return out;
  }, [filtered]);

  // Grouped by competency category, derived from the learning paths the training sits on.
  const byCategory = useMemo(() => {
    const out: { id: string; name: string; items: Training[] }[] = [];
    cats.forEach((cat) => {
      const items = filtered.filter((t) => (pathsByTraining[t.id] ?? []).some((u) => u.catId === cat.id));
      if (items.length) out.push({ id: cat.id, name: cat.name, items });
    });
    const orphans = filtered.filter((t) => (pathsByTraining[t.id] ?? []).length === 0);
    if (orphans.length) out.push({ id: 'none', name: 'Not on any learning path', items: orphans });
    return out;
  }, [cats, filtered, pathsByTraining]);

  function openNew() {
    setTitle(''); setFamily(''); setHours(''); setStatus('active');
    setMode(''); setPace(''); setProvider(''); setAssessment(''); setCertificate(false);
    setValidity(''); setDescription(''); setOutcomes(''); setDelivererIds([]);
    setModal({ mode: 'new' });
  }
  function openEdit(t: Training) {
    setTitle(t.title);
    setFamily(t.family ?? '');
    setHours(t.duration_hours != null ? String(t.duration_hours) : '');
    setStatus((t.status as Status) ?? 'active');
    setMode(t.delivery_mode ?? '');
    setPace(t.pacing ?? '');
    setProvider(t.provider ?? '');
    setAssessment(t.assessment_method ?? '');
    setCertificate(!!t.issues_certificate);
    setValidity(t.validity_months != null ? String(t.validity_months) : '');
    setDescription(t.description ?? '');
    setOutcomes((t.outcomes ?? []).join('\n'));
    setDelivererIds(delByTraining[t.id] ?? []);
    setDetail(null);
    setModal({ mode: 'edit', training: t });
  }

  async function save() {
    if (!modal || !title.trim()) return;
    const lines = outcomes.split('\n').map((s) => s.replace(/^[-•\s]+/, '').trim()).filter(Boolean);
    const payload = {
      title: title.trim(),
      family: family || null,
      duration_hours: hours.trim() === '' ? null : Math.max(0, Math.round(Number(hours))),
      status,
      delivery_mode: mode || null,
      pacing: pace || null,
      provider: provider.trim() || null,
      assessment_method: assessment || null,
      issues_certificate: certificate,
      validity_months: validity.trim() === '' ? null : Math.max(0, Math.round(Number(validity))),
      description: description.trim() || null,
      outcomes: lines.length ? lines : null,
    };
    let id: string;
    if (modal.mode === 'new') {
      const { data, error } = await supabase.from('trainings').insert(payload).select('id').single();
      if (error) { setError(error.message); return; }
      id = (data as { id: string }).id;
    } else {
      id = modal.training.id;
      const { error } = await supabase.from('trainings').update(payload).eq('id', id);
      if (error) { setError(error.message); return; }
      await supabase.from('training_deliverers').delete().eq('training_id', id);
    }
    if (delivererIds.length) {
      const e2 = (await supabase.from('training_deliverers').insert(delivererIds.map((trainer_id) => ({ training_id: id, trainer_id })))).error;
      if (e2) setError(e2.message);
    }
    setModal(null); load();
  }

  function del(t: Training) {
    const names = [...new Set((pathsByTraining[t.id] ?? []).map((u) => u.compName))];
    const usedLine = names.length
      ? ` It is on the learning path of ${names.length === 1 ? names[0] : `${names.length} competencies (${names.join(', ')})`}, and is taken off ${names.length === 1 ? 'it' : 'them'}. Any training already scheduled on a consultant's plan is removed from that plan too.`
      : '';
    setDetail(null);
    setConfirm({
      title: 'Delete training',
      message: `Delete "${t.title}"?${usedLine} This cannot be undone.`,
      onYes: () => supabase.from('trainings').delete().eq('id', t.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); load(); }),
    });
  }

  /** The small facts shown on a card and again at the top of the detail modal. */
  function badges(t: Training) {
    const required = t.status === 'required';
    return (
      <>
        <span className={`status-pill ${required ? 'req' : 'act'}`}>{required ? 'Required' : 'Active'}</span>
        {t.delivery_mode && <span className="t-badge mode">{labelOf(MODES, t.delivery_mode)}</span>}
        {t.pacing && <span className="t-badge">{labelOf(PACING, t.pacing)}</span>}
        <span className="training-duration">{t.duration_hours != null ? `${t.duration_hours} hour${t.duration_hours === 1 ? '' : 's'}` : 'Duration not set'}</span>
        {t.assessment_method && t.assessment_method !== 'none' && <span className="t-badge">{labelOf(ASSESSMENTS, t.assessment_method)}</span>}
        {t.issues_certificate && <span className="t-badge cert">Certificate</span>}
        {t.validity_months != null && <span className="t-badge">Refresh every {t.validity_months} months</span>}
        {t.provider && <span className="t-badge">{t.provider}</span>}
      </>
    );
  }

  function card(t: Training) {
    const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name).filter(Boolean);
    const uses = pathsByTraining[t.id] ?? [];
    return (
      <div className={`training-card${t.status === 'required' ? ' required' : ''}`} key={t.id}>
        <div className="training-head">
          <button className="training-title-btn" onClick={() => setDetail(t)} title="Open the full details">
            {t.title}
          </button>
          <div className="tree-actions">
            <button className="link-btn" onClick={() => openEdit(t)}>Edit</button>
            <button className="link-btn danger" onClick={() => del(t)}>Delete</button>
          </div>
        </div>

        {uses.length > 0 ? (
          <div className="training-paths">
            {uses.map((u) => (
              <span className="training-path-chip" key={`${u.compId}-${u.level}`}>
                <span className="tp-cat">{u.catName}</span>
                {u.compName}
                <span className="tp-level">to {u.level}★</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="training-none-path">
            Not on any competency's learning path, so it can never be scheduled on a plan.
          </p>
        )}

        <div className="training-foot">
          {badges(t)}
          {dels.length > 0 && (
            <span className="training-deliverers">{dels.map((n, i) => <span className="mini-chip" key={i}>{n}</span>)}</span>
          )}
        </div>

        {t.description && <p className="training-notes">{t.description}</p>}
      </div>
    );
  }

  function group(g: { id: string; name: string; items: Training[] }, orphanHint: string | null) {
    return (
      <section className={`training-group${g.id === 'none' ? ' orphans' : ''}`} key={g.id}>
        <header className="training-group-head">
          <span className="training-group-name">{g.name}</span>
          <span className="training-group-count">{g.items.length}</span>
        </header>
        {g.id === 'none' && orphanHint && <p className="training-group-hint">{orphanHint}</p>}
        <div className="training-list">{g.items.map(card)}</div>
      </section>
    );
  }

  const filtering = q.trim() !== '' || statusFilter !== 'all' || modeFilter !== 'all';

  return (
    <div>
      <div className="lib-toolbar">
        <div className="view-toggle">
          <button className={view === 'family' ? 'active' : ''} onClick={() => setView('family')}>By family</button>
          <button className={view === 'category' ? 'active' : ''} onClick={() => setView('category')}>By competency</button>
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All trainings</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add training</button>
      </div>

      <div className="training-filters">
        <input
          className="field training-search"
          placeholder="Search by training, competency, outcome, provider or trainer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="field training-mode-filter" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="all">Any delivery</option>
          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <div className="view-toggle">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>All</button>
          <button className={statusFilter === 'active' ? 'active' : ''} onClick={() => setStatusFilter('active')}>Active</button>
          <button className={statusFilter === 'required' ? 'active' : ''} onClick={() => setStatusFilter('required')}>Required</button>
        </div>
        {filtering && <button className="link-btn" onClick={() => { setQ(''); setStatusFilter('all'); setModeFilter('all'); }}>Clear</button>}
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : trainings.length === 0 ? (
        <div className="card"><p className="muted">No trainings yet. Use “Add training”.</p></div>
      ) : filtered.length === 0 ? (
        <div className="card"><p className="muted">No trainings match that. Try a different search, or clear the filters.</p></div>
      ) : (
        <>
          <p className="training-count">
            {filtering ? `${filtered.length} of ${trainings.length} trainings` : `${trainings.length} training${trainings.length === 1 ? '' : 's'}`}
          </p>

          {view === 'all' && <div className="training-list">{filtered.map(card)}</div>}
          {view === 'family' && byFamily.map((g) => group(g, 'These are not filed under a training family yet. Open each one and set it, so it appears with the rest of the catalogue.'))}
          {view === 'category' && byCategory.map((g) => group(g, 'These are not attached to any competency, so the plan builder cannot use them. Add each one to a competency’s learning path on the Nuclear Competencies page.'))}
        </>
      )}

      {/* full details for one training */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{detail.title}</h2>
                <p className="modal-sub">{detail.family ?? 'No family set'}</p>
              </div>
              <button className="modal-close" onClick={() => setDetail(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <div className="training-foot detail-badges">{badges(detail)}</div>

              {detail.description ? (
                <>
                  <p className="modal-sub">What it covers</p>
                  <p className="comp-modal-desc">{detail.description}</p>
                </>
              ) : (
                <p className="muted">No description yet.</p>
              )}

              {(detail.outcomes ?? []).length > 0 && (
                <>
                  <p className="modal-sub">By the end, they can</p>
                  <ul className="t-outcomes">
                    {(detail.outcomes ?? []).map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </>
              )}

              <p className="modal-sub">Develops</p>
              {(pathsByTraining[detail.id] ?? []).length > 0 ? (
                <div className="training-paths">
                  {(pathsByTraining[detail.id] ?? []).map((u) => (
                    <span className="training-path-chip" key={`${u.compId}-${u.level}`}>
                      <span className="tp-cat">{u.catName}</span>
                      {u.compName}
                      <span className="tp-level">to {u.level}★</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="training-none-path">Not on any competency's learning path yet.</p>
              )}

              <p className="modal-sub">Delivered by</p>
              {(delByTraining[detail.id] ?? []).length > 0 ? (
                <div className="training-deliverers">
                  {(delByTraining[detail.id] ?? []).map((id) => (
                    <span className="mini-chip" key={id}>{trainerById[id]?.display_name ?? 'Unknown'}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">No approved trainer listed yet.</p>
              )}

              <div className="modal-actions">
                <button className="btn" onClick={() => openEdit(detail)}>Edit training</button>
                <button className="link-btn danger" onClick={() => del(detail)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'new' ? 'Add training' : 'Edit training'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <label>Title</label>
              <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ALARP Demonstration in Practice" />

              <label>Training family</label>
              <select className="field" value={family} onChange={(e) => setFamily(e.target.value)}>
                <option value="">Not set</option>
                {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                {family && !FAMILIES.includes(family) && <option value={family}>{family}</option>}
              </select>

              <label>Status</label>
              <div className="status-toggle">
                <button type="button" className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>Active</button>
                <button type="button" className={status === 'required' ? 'active req' : 'req'} onClick={() => setStatus('required')}>Required</button>
              </div>
              <p className="muted card-hint">Required means the training is needed but not built yet. Its card shows red.</p>

              <div className="t-field-row">
                <div>
                  <label>Delivery</label>
                  <select className="field" value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="">Not set</option>
                    {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Pacing</label>
                  <select className="field" value={pace} onChange={(e) => setPace(e.target.value)}>
                    <option value="">Not set</option>
                    {PACING.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Duration (hours)</label>
                  <input className="field no-spin" type="number" min="0" step="1" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 16" />
                </div>
              </div>

              <div className="t-field-row">
                <div>
                  <label>Assessment</label>
                  <select className="field" value={assessment} onChange={(e) => setAssessment(e.target.value)}>
                    <option value="">Not set</option>
                    {ASSESSMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Valid for (months)</label>
                  <input className="field no-spin" type="number" min="0" step="1" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value)} placeholder="Blank = no expiry" />
                </div>
                <div>
                  <label>Provider</label>
                  <input className="field" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. In-house, IOSH" />
                </div>
              </div>

              <label className="browse-row t-cert-row">
                <input type="checkbox" checked={certificate} onChange={(e) => setCertificate(e.target.checked)} />
                <span className="browse-name">Completing this produces a certificate</span>
              </label>

              <label>What it covers</label>
              <textarea className="field" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The content of the training, in a few sentences." />

              <label>Learning outcomes (one per line)</label>
              <textarea className="field" rows={5} value={outcomes} onChange={(e) => setOutcomes(e.target.value)} placeholder={'Explain the ALARP principle and where it applies\nProduce an ALARP argument for a design change'} />

              <label>Deliverers (from approved trainers)</label>
              {trainers.length === 0 ? (
                <p className="muted">No approved trainers yet. Add some in the Approved Trainers tab first.</p>
              ) : (
                <div className="deliverer-box">
                  {trainers.map((tr) => (
                    <label className="browse-row" key={tr.id}>
                      <input type="checkbox" checked={delivererIds.includes(tr.id)} onChange={() => setDelivererIds((ids) => ids.includes(tr.id) ? ids.filter((x) => x !== tr.id) : [...ids, tr.id])} />
                      <span className="browse-name">{tr.display_name}</span>
                      <span className="browse-tag">{tr.kind === 'technical_director' ? 'TD' : tr.kind === 'consultant' ? 'Consultant' : 'External'}</span>
                    </label>
                  ))}
                </div>
              )}

              <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim()}>
                {modal.mode === 'new' ? 'Add training' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={() => confirm.onYes()} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}
