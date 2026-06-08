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
  TrainingCompetency,
  TrainingDeliverer,
} from '../lib/types';

const LEVELS = [
  { n: 1, label: 'No knowledge' },
  { n: 2, label: 'Awareness' },
  { n: 3, label: 'Basic competence' },
  { n: 4, label: 'Full competence (SQEP)' },
  { n: 5, label: 'Expert / trainer' },
];

interface CapRow { key: string; competency_id: string; from_level: number; to_level: number; }
type Modal = { mode: 'new' } | { mode: 'edit'; training: Training } | null;

let capSeq = 0;
const newCap = (): CapRow => ({ key: `c${capSeq++}`, competency_id: '', from_level: 1, to_level: 3 });

export default function TrainingCatalogue() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [tcs, setTcs] = useState<TrainingCompetency[]>([]);
  const [links, setLinks] = useState<TrainingDeliverer[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [caps, setCaps] = useState<CapRow[]>([newCap()]);
  const [delivererIds, setDelivererIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [t, tc, l, r, k, c, s] = await Promise.all([
      supabase.from('trainings').select('*').order('title'),
      supabase.from('training_competencies').select('*'),
      supabase.from('training_deliverers').select('*'),
      supabase.from('trainers').select('*').order('display_name'),
      supabase.from('competencies').select('*').order('name'),
      supabase.from('competency_categories').select('*').order('sort_order').order('name'),
      supabase.from('competency_subcategories').select('*').order('sort_order').order('name'),
    ]);
    const err = t.error || tc.error || l.error || r.error || k.error || c.error || s.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setTrainings((t.data as Training[]) ?? []);
      setTcs((tc.data as TrainingCompetency[]) ?? []);
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
  const capsByTraining = useMemo(() => {
    const m: Record<string, TrainingCompetency[]> = {};
    tcs.forEach((x) => (m[x.training_id] ??= []).push(x));
    return m;
  }, [tcs]);
  const delByTraining = useMemo(() => {
    const m: Record<string, string[]> = {};
    links.forEach((l) => (m[l.training_id] ??= []).push(l.trainer_id));
    return m;
  }, [links]);

  const compGroups = useMemo(() => {
    const groups: { label: string; items: Competency[] }[] = [];
    subs.forEach((sub) => {
      const items = comps.filter((c) => c.subcategory_id === sub.id);
      if (items.length) groups.push({ label: `${catById[sub.category_id]?.name ?? ''} · ${sub.name}`, items });
    });
    return groups;
  }, [subs, comps, catById]);

  function compLabel(c?: Competency) {
    if (!c) return '';
    const cat = catById[c.category_id]?.name ?? '';
    const sub = c.subcategory_id ? subById[c.subcategory_id]?.name : null;
    return `${cat}${sub ? ` · ${sub}` : ''}`;
  }

  function openNew() {
    setTitle(''); setDuration(''); setNotes(''); setCaps([newCap()]); setDelivererIds([]);
    setModal({ mode: 'new' });
  }
  function openEdit(t: Training) {
    setTitle(t.title); setDuration(t.duration_days != null ? String(t.duration_days) : ''); setNotes(t.notes ?? '');
    const existing = (capsByTraining[t.id] ?? []).map((x) => ({ key: `c${capSeq++}`, competency_id: x.competency_id, from_level: x.from_level, to_level: x.to_level }));
    setCaps(existing.length ? existing : [newCap()]);
    setDelivererIds(delByTraining[t.id] ?? []);
    setModal({ mode: 'edit', training: t });
  }

  const validCaps = caps.filter((c) => c.competency_id && c.from_level < c.to_level);

  async function save() {
    if (!modal || !title.trim() || validCaps.length === 0) return;
    // de-duplicate by competency (a training addresses a competency once)
    const byComp: Record<string, CapRow> = {};
    validCaps.forEach((c) => (byComp[c.competency_id] = c));
    const finalCaps = Object.values(byComp);

    const payload = { title: title.trim(), duration_days: duration.trim() === '' ? null : Number(duration), notes: notes.trim() || null };
    let id: string;
    if (modal.mode === 'new') {
      const { data, error } = await supabase.from('trainings').insert(payload).select('id').single();
      if (error) { setError(error.message); return; }
      id = (data as { id: string }).id;
    } else {
      id = modal.training.id;
      const { error } = await supabase.from('trainings').update(payload).eq('id', id);
      if (error) { setError(error.message); return; }
      await supabase.from('training_competencies').delete().eq('training_id', id);
      await supabase.from('training_deliverers').delete().eq('training_id', id);
    }
    const capRows = finalCaps.map((c) => ({ training_id: id, competency_id: c.competency_id, from_level: c.from_level, to_level: c.to_level }));
    const e1 = (await supabase.from('training_competencies').insert(capRows)).error;
    if (e1) setError(e1.message);
    if (delivererIds.length) {
      const e2 = (await supabase.from('training_deliverers').insert(delivererIds.map((trainer_id) => ({ training_id: id, trainer_id })))).error;
      if (e2) setError(e2.message);
    }
    setModal(null); load();
  }

  function del(t: Training) {
    setConfirm({
      title: 'Delete training',
      message: `Delete "${t.title}"? This cannot be undone.`,
      onYes: () => supabase.from('trainings').delete().eq('id', t.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); load(); }),
    });
  }

  const setCap = (key: string, patch: Partial<CapRow>) =>
    setCaps((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <div>
      <div className="lib-toolbar">
        <button className="btn btn-primary" onClick={openNew}>+ Add training</button>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : trainings.length === 0 ? (
        <div className="card"><p className="muted">No trainings yet. Use “Add training”.</p></div>
      ) : (
        <div className="training-list">
          {trainings.map((t) => {
            const tcaps = capsByTraining[t.id] ?? [];
            const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name).filter(Boolean);
            return (
              <div className="training-card" key={t.id}>
                <div className="training-head">
                  <div className="training-title">{t.title}</div>
                  <div className="tree-actions">
                    <button className="link-btn" onClick={() => openEdit(t)}>Edit</button>
                    <button className="link-btn danger" onClick={() => del(t)}>Delete</button>
                  </div>
                </div>
                <div className="training-caps">
                  {tcaps.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>No capabilities set.</p>
                  ) : tcaps.map((cap) => {
                    const comp = compById[cap.competency_id];
                    return (
                      <div className="cap-row" key={cap.competency_id}>
                        <div className="cap-info">
                          <span className="cap-breadcrumb">{compLabel(comp)}</span>
                          <span className="cap-name">{comp?.name ?? 'Unknown competency'}</span>
                        </div>
                        <StarBand from={cap.from_level} to={cap.to_level} />
                      </div>
                    );
                  })}
                </div>
                <div className="training-foot">
                  <span className="training-duration">{t.duration_days != null ? `${t.duration_days} day${t.duration_days === 1 ? '' : 's'}` : 'Duration not set'}</span>
                  {dels.length > 0 && (
                    <span className="training-deliverers">{dels.map((n, i) => <span className="mini-chip" key={i}>{n}</span>)}</span>
                  )}
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
              <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nuclear Safety Culture Foundations" />

              <label>Capabilities this training delivers</label>
              <div className="caps-editor">
                {caps.map((cap) => (
                  <div className="cap-edit-row" key={cap.key}>
                    <select className="field cap-comp" value={cap.competency_id} onChange={(e) => setCap(cap.key, { competency_id: e.target.value })}>
                      <option value="">Select a competency…</option>
                      {compGroups.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <select className="field cap-lvl" value={cap.from_level} onChange={(e) => { const f = Number(e.target.value); setCap(cap.key, { from_level: f, ...(cap.to_level <= f ? { to_level: f + 1 } : {}) }); }}>
                      {LEVELS.filter((l) => l.n <= 4).map((l) => <option key={l.n} value={l.n}>{l.n}</option>)}
                    </select>
                    <span className="cap-arrow">→</span>
                    <select className="field cap-lvl" value={cap.to_level} onChange={(e) => setCap(cap.key, { to_level: Number(e.target.value) })}>
                      {LEVELS.filter((l) => l.n > cap.from_level).map((l) => <option key={l.n} value={l.n}>{l.n}</option>)}
                    </select>
                    <span className="cap-preview"><StarBand from={cap.from_level} to={cap.to_level} /></span>
                    {caps.length > 1 && <button className="chip-x cap-del" onClick={() => setCaps((cs) => cs.filter((c) => c.key !== cap.key))} aria-label="Remove">×</button>}
                  </div>
                ))}
                <button className="add-comp-btn" onClick={() => setCaps((cs) => [...cs, newCap()])}>+ Add capability</button>
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
                      <input type="checkbox" checked={delivererIds.includes(tr.id)} onChange={() => setDelivererIds((ids) => ids.includes(tr.id) ? ids.filter((x) => x !== tr.id) : [...ids, tr.id])} />
                      <span className="browse-name">{tr.display_name}</span>
                      <span className="browse-tag">{tr.kind === 'technical_director' ? 'TD' : tr.kind === 'consultant' ? 'Consultant' : 'External'}</span>
                    </label>
                  ))}
                </div>
              )}

              <label>Notes (optional)</label>
              <textarea className="field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything useful about this training" />

              <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim() || validCaps.length === 0}>
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
