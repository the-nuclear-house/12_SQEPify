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
type View = 'category' | 'all';
type StatusFilter = 'all' | 'active' | 'required';

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
  const [view, setView] = useState<View>('category');

  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [notes, setNotes] = useState('');
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
  // This is what organises the catalogue, so a training is found by what it develops.
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
      if (!needle) return true;
      const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name ?? '');
      const uses = pathsByTraining[t.id] ?? [];
      const hay = [
        t.title,
        t.notes ?? '',
        ...dels,
        ...uses.map((u) => u.compName),
        ...uses.map((u) => u.catName),
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [trainings, q, statusFilter, delByTraining, trainerById, pathsByTraining]);

  // Grouped by competency category, in the library's own order. A training that
  // develops competencies in two categories appears under both. Anything on no
  // learning path is gathered at the end, because the plan builder can never
  // schedule it.
  const groups = useMemo(() => {
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
    setTitle(''); setHours(''); setStatus('active'); setNotes(''); setDelivererIds([]);
    setModal({ mode: 'new' });
  }
  function openEdit(t: Training) {
    setTitle(t.title);
    setHours(t.duration_hours != null ? String(t.duration_hours) : '');
    setStatus((t.status as Status) ?? 'active');
    setNotes(t.notes ?? '');
    setDelivererIds(delByTraining[t.id] ?? []);
    setModal({ mode: 'edit', training: t });
  }

  async function save() {
    if (!modal || !title.trim()) return;
    const payload = {
      title: title.trim(),
      duration_hours: hours.trim() === '' ? null : Math.max(0, Math.round(Number(hours))),
      status,
      notes: notes.trim() || null,
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
    const uses = pathsByTraining[t.id] ?? [];
    const names = [...new Set(uses.map((u) => u.compName))];
    const usedLine = names.length
      ? ` It is on the learning path of ${names.length === 1 ? names[0] : `${names.length} competencies (${names.join(', ')})`}, and is taken off ${names.length === 1 ? 'it' : 'them'}. Any training already scheduled on a consultant's plan is removed from that plan too.`
      : '';
    setConfirm({
      title: 'Delete training',
      message: `Delete "${t.title}"?${usedLine} This cannot be undone.`,
      onYes: () => supabase.from('trainings').delete().eq('id', t.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); load(); }),
    });
  }

  function card(t: Training) {
    const required = t.status === 'required';
    const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name).filter(Boolean);
    const uses = pathsByTraining[t.id] ?? [];
    return (
      <div className={`training-card${required ? ' required' : ''}`} key={t.id}>
        <div className="training-head">
          <div className="training-title">{t.title}</div>
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
          <span className={`status-pill ${required ? 'req' : 'act'}`}>{required ? 'Required' : 'Active'}</span>
          <span className="training-duration">{t.duration_hours != null ? `${t.duration_hours} hour${t.duration_hours === 1 ? '' : 's'}` : 'Duration not set'}</span>
          {dels.length > 0 && (
            <span className="training-deliverers">{dels.map((n, i) => <span className="mini-chip" key={i}>{n}</span>)}</span>
          )}
        </div>
        {t.notes && <p className="training-notes">{t.notes}</p>}
      </div>
    );
  }

  const filtering = q.trim() !== '' || statusFilter !== 'all';

  return (
    <div>
      <div className="lib-toolbar">
        <div className="view-toggle">
          <button className={view === 'category' ? 'active' : ''} onClick={() => setView('category')}>By category</button>
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All trainings</button>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add training</button>
      </div>

      <div className="training-filters">
        <input
          className="field training-search"
          placeholder="Search by training, competency, category or trainer…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="view-toggle">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>All</button>
          <button className={statusFilter === 'active' ? 'active' : ''} onClick={() => setStatusFilter('active')}>Active</button>
          <button className={statusFilter === 'required' ? 'active' : ''} onClick={() => setStatusFilter('required')}>Required</button>
        </div>
        {filtering && <button className="link-btn" onClick={() => { setQ(''); setStatusFilter('all'); }}>Clear</button>}
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

          {view === 'all' ? (
            <div className="training-list">{filtered.map(card)}</div>
          ) : (
            groups.map((g) => (
              <section className={`training-group${g.id === 'none' ? ' orphans' : ''}`} key={g.id}>
                <header className="training-group-head">
                  <span className="training-group-name">{g.name}</span>
                  <span className="training-group-count">{g.items.length}</span>
                </header>
                {g.id === 'none' && (
                  <p className="training-group-hint">
                    These are not attached to any competency, so the plan builder cannot use them. Add each one to a
                    competency's learning path on the Nuclear Competencies page.
                  </p>
                )}
                <div className="training-list">{g.items.map(card)}</div>
              </section>
            ))
          )}
        </>
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
              <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Nuclear Safety Culture Foundations" />

              <label>Status</label>
              <div className="status-toggle">
                <button type="button" className={status === 'active' ? 'active' : ''} onClick={() => setStatus('active')}>Active</button>
                <button type="button" className={status === 'required' ? 'active req' : 'req'} onClick={() => setStatus('required')}>Required</button>
              </div>
              <p className="muted card-hint">Required means the training is needed but not built yet. Its card shows red.</p>

              <label>Duration (hours)</label>
              <input className="field no-spin" type="number" min="0" step="1" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 16" />

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
