import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import type { Trainer, Training, TrainingDeliverer } from '../lib/types';

type Status = 'active' | 'required';
type Modal = { mode: 'new' } | { mode: 'edit'; training: Training } | null;

export default function TrainingCatalogue() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [links, setLinks] = useState<TrainingDeliverer[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>(null);
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [notes, setNotes] = useState('');
  const [delivererIds, setDelivererIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [t, l, r] = await Promise.all([
      supabase.from('trainings').select('*').order('title'),
      supabase.from('training_deliverers').select('*'),
      supabase.from('trainers').select('*').order('display_name'),
    ]);
    const err = t.error || l.error || r.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setTrainings((t.data as Training[]) ?? []);
      setLinks((l.data as TrainingDeliverer[]) ?? []);
      setTrainers((r.data as Trainer[]) ?? []);
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
    setConfirm({
      title: 'Delete training',
      message: `Delete "${t.title}"? This cannot be undone.`,
      onYes: () => supabase.from('trainings').delete().eq('id', t.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); load(); }),
    });
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
        <div className="card"><p className="muted">No trainings yet. Use “Add training”.</p></div>
      ) : (
        <div className="training-list">
          {trainings.map((t) => {
            const required = t.status === 'required';
            const dels = (delByTraining[t.id] ?? []).map((id) => trainerById[id]?.display_name).filter(Boolean);
            return (
              <div className={`training-card${required ? ' required' : ''}`} key={t.id}>
                <div className="training-head">
                  <div className="training-title">{t.title}</div>
                  <div className="tree-actions">
                    <button className="link-btn" onClick={() => openEdit(t)}>Edit</button>
                    <button className="link-btn danger" onClick={() => del(t)}>Delete</button>
                  </div>
                </div>
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
          })}
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
