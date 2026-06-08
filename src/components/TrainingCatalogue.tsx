import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import StarBand from './StarBand';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
  Trainer,
  Training,
  TrainingDeliverer,
} from '../lib/types';

const LEVELS = [
  { n: 1, label: 'No knowledge' },
  { n: 2, label: 'Awareness' },
  { n: 3, label: 'Basic competence' },
  { n: 4, label: 'Full competence (SQEP)' },
  { n: 5, label: 'Expert / trainer' },
];

type Modal =
  | { mode: 'new' }
  | { mode: 'edit'; training: Training }
  | null;

export default function TrainingCatalogue() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [links, setLinks] = useState<TrainingDeliverer[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState('');
  const [compId, setCompId] = useState('');
  const [fromLevel, setFromLevel] = useState(1);
  const [toLevel, setToLevel] = useState(3);
  const [duration, setDuration] = useState('');
  const [delivererIds, setDelivererIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [t, l, r, k, c, s] = await Promise.all([
      supabase.from('trainings').select('*').order('title'),
      supabase.from('training_deliverers').select('*'),
      supabase.from('trainers').select('*').order('display_name'),
      supabase.from('competencies').select('*').order('name'),
      supabase.from('competency_categories').select('*').order('sort_order').order('name'),
      supabase.from('competency_subcategories').select('*').order('sort_order').order('name'),
    ]);
    const err = t.error || l.error || r.error || k.error || c.error || s.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setTrainings((t.data as Training[]) ?? []);
      setLinks((l.data as TrainingDeliverer[]) ?? []);
      setTrainers((r.data as Trainer[]) ?? []);
      setComps((k.data as Competency[]) ?? []);
      setCats((c.data as CompetencyCategory[]) ?? []);
      setSubs((s.data as CompetencySubcategory[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const compById = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c])), [comps]);
  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const subById = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s])), [subs]);
  const trainerById = useMemo(() => Object.fromEntries(trainers.map((t) => [t.id, t])), [trainers]);
  const delByTraining = useMemo(() => {
    const m: Record<string, string[]> = {};
    links.forEach((l) => (m[l.training_id] ??= []).push(l.trainer_id));
    return m;
  }, [links]);

  // competency options grouped by "Category - Subcategory" for the select
  const compGroups = useMemo(() => {
    const groups: { label: string; items: Competency[] }[] = [];
    subs.forEach((sub) => {
      const items = comps.filter((c) => c.subcategory_id === sub.id);
      if (items.length) groups.push({ label: `${catById[sub.category_id]?.name ?? ''} · ${sub.name}`, items });
    });
    return groups;
  }, [subs, comps, catById]);

  function openNew() {
    setTitle(''); setCompId(''); setFromLevel(1); setToLevel(3); setDuration(''); setDelivererIds([]); setNotes('');
    setModal({ mode: 'new' });
  }
  function openEdit(t: Training) {
    setTitle(t.title); setCompId(t.competency_id); setFromLevel(t.from_level); setToLevel(t.to_level);
    setDuration(t.duration_days != null ? String(t.duration_days) : '');
    setDelivererIds(delByTraining[t.id] ?? []); setNotes(t.notes ?? '');
    setModal({ mode: 'edit', training: t });
  }

  async function save() {
    if (!modal || modal.mode === null) return;
    if (!title.trim() || !compId || fromLevel >= toLevel) return;
    const payload = {
      title: title.trim(),
      competency_id: compId,
      from_level: fromLevel,
      to_level: toLevel,
      duration_days: duration.trim() === '' ? null : Number(duration),
      notes: notes.trim() || null,
    };
    let trainingId: string | null = null;
    if (modal.mode === 'new') {
      const { data, error } = await supabase.from('trainings').insert(payload).select('id').single();
      if (error) { setError(error.message); return; }
      trainingId = (data as { id: string }).id;
    } else {
      const { error } = await supabase.from('trainings').update(payload).eq('id', modal.training.id);
      if (error) { setError(error.message); return; }
      trainingId = modal.training.id;
      await supabase.from('training_deliverers').delete().eq('training_id', trainingId);
    }
    if (trainingId && delivererIds.length) {
      const rows = delivererIds.map((trainer_id) => ({ training_id: trainingId, trainer_id }));
      const { error } = await supabase.from('training_deliverers').insert(rows);
      if (error) setError(error.message);
    }
    setModal(null);
    load();
  }

  function del(t: Training) {
    setConfirm({
      title: 'Delete training',
      message: `Delete "${t.title}"? This cannot be undone.`,
      onYes: () => supabase.from('trainings').delete().eq('id', t.id).then(({ error }) => {
        if (error) setError(error.message);
        setConfirm(null); load();
      }),
    });
  }

  function toggleDeliverer(id: string) {
    setDelivererIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  function compLabel(c?: Competency) {
    if (!c) return 'Unknown competency';
    const cat = catById[c.category_id]?.name ?? '';
    const sub = c.subcategory_id ? subById[c.subcategory_id]?.name : null;
    return `${cat}${sub ? ` · ${sub}` : ''}`;
  }

  return (
    <div>
      <div className="lib-toolbar">
        <button className="btn btn-primary" onClick={openNew}>+ Add training</button>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : trainings.length === 0 ? (
        <div className="card"><p className="muted">No trainings yet. Use “Add training”. A training needs a competency from the Library and at least one approved trainer.</p></div>
      ) : (
        <div className="training-list">
          {trainings.map((t) => {
            const comp = compById[t.competency_id];
            const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name).filter(Boolean);
            return (
              <div className="training-card" key={t.id}>
                <div className="training-main">
                  <div className="training-title">{t.title}</div>
                  <div className="training-comp">
                    <span className="training-breadcrumb">{compLabel(comp)}</span>
                    <strong>{comp?.name ?? 'Unknown competency'}</strong>
                  </div>
                  {dels.length > 0 && (
                    <div className="training-deliverers">
                      {dels.map((n, i) => <span className="mini-chip" key={i}>{n}</span>)}
                    </div>
                  )}
                  {t.notes && <div className="training-notes">{t.notes}</div>}
                </div>
                <div className="training-side">
                  <StarBand from={t.from_level} to={t.to_level} />
                  <div className="training-duration">{t.duration_days != null ? `${t.duration_days} day${t.duration_days === 1 ? '' : 's'}` : 'Duration not set'}</div>
                  <div className="tree-actions">
                    <button className="link-btn" onClick={() => openEdit(t)}>Edit</button>
                    <button className="link-btn danger" onClick={() => del(t)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'new' ? 'Add training' : 'Edit training'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <label>Title</label>
              <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Reactor Physics Foundations" />

              <label>Competency</label>
              <select className="field" value={compId} onChange={(e) => setCompId(e.target.value)}>
                <option value="">Select a competency…</option>
                {compGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>

              <label>What it delivers</label>
              <div className="band-edit">
                <div className="band-pick">
                  <span>From</span>
                  <select className="field" value={fromLevel} onChange={(e) => { const f = Number(e.target.value); setFromLevel(f); if (toLevel <= f) setToLevel(f + 1); }}>
                    {LEVELS.filter((l) => l.n <= 4).map((l) => <option key={l.n} value={l.n}>{l.n} - {l.label}</option>)}
                  </select>
                </div>
                <div className="band-pick">
                  <span>To</span>
                  <select className="field" value={toLevel} onChange={(e) => setToLevel(Number(e.target.value))}>
                    {LEVELS.filter((l) => l.n > fromLevel).map((l) => <option key={l.n} value={l.n}>{l.n} - {l.label}</option>)}
                  </select>
                </div>
                <div className="band-preview"><StarBand from={fromLevel} to={toLevel} /></div>
              </div>

              <label>Duration (days)</label>
              <input className="field" type="number" min="0" step="0.5" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 2" />

              <label>Deliverers (from approved trainers)</label>
              {trainers.length === 0 ? (
                <p className="muted">No approved trainers yet. Add some in the Approved Trainers tab first.</p>
              ) : (
                <div className="deliverer-box">
                  {trainers.map((tr) => (
                    <label className="browse-row" key={tr.id}>
                      <input type="checkbox" checked={delivererIds.includes(tr.id)} onChange={() => toggleDeliverer(tr.id)} />
                      <span className="browse-name">{tr.display_name}</span>
                      <span className="browse-tag">{tr.kind === 'technical_director' ? 'TD' : tr.kind === 'consultant' ? 'Consultant' : 'External'}</span>
                    </label>
                  ))}
                </div>
              )}

              <label>Notes (optional)</label>
              <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything useful about this training" />

              <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim() || !compId}>
                {modal.mode === 'new' ? 'Add training' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => confirm.onYes()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
