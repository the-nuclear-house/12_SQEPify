import { useEffect, useMemo, useState, Fragment } from 'react';
import { supabase } from '../lib/supabase';
import type { Competency, Training, CompetencyLevelPath, CompetencyLevelTraining } from '../lib/types';

const LEVELS = [
  { n: 1, label: 'No knowledge', hint: 'Not yet exposed to this.', color: 'var(--brand-orange)' },
  { n: 2, label: 'Awareness', hint: 'General knowledge of the topic.', color: 'var(--brand-gold)' },
  { n: 3, label: 'Basic competence', hint: 'Can apply it under supervision.', color: 'var(--steel)' },
  { n: 4, label: 'Full competence (SQEP)', hint: 'Works independently to good practice.', color: 'var(--brand-green)' },
  { n: 5, label: 'Expert', hint: 'Can design, adapt and coach others.', color: 'var(--brand-cyan)' },
];
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function LearningPath({
  competency, onClose, onEdit, onDelete,
}: {
  competency: Competency;
  onClose: () => void;
  onEdit: (c: Competency) => void;
  onDelete: (c: Competency) => void;
}) {
  const [desc, setDesc] = useState<Record<number, string>>({});
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerLevel, setPickerLevel] = useState<number | null>(null);
  const [pickerQ, setPickerQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, lt, t] = await Promise.all([
        supabase.from('competency_level_paths').select('*').eq('competency_id', competency.id),
        supabase.from('competency_level_trainings').select('*').eq('competency_id', competency.id),
        supabase.from('trainings').select('*').order('title'),
      ]);
      const err = p.error || lt.error || t.error;
      if (err) setError(err.message);
      else {
        const d: Record<number, string> = {};
        ((p.data as CompetencyLevelPath[]) ?? []).forEach((r) => (d[r.level] = r.actions ?? ''));
        setDesc(d);
        const pk: Record<number, string[]> = {};
        ((lt.data as CompetencyLevelTraining[]) ?? []).forEach((r) => (pk[r.level] ??= []).push(r.training_id));
        setPicks(pk);
        setTrainings((t.data as Training[]) ?? []);
      }
      setLoading(false);
    })();
  }, [competency.id]);

  const trainingById = useMemo(() => Object.fromEntries(trainings.map((t) => [t.id, t])), [trainings]);

  const addTraining = (level: number, id: string) =>
    setPicks((p) => ({ ...p, [level]: [...(p[level] ?? []), id] }));
  const removeTraining = (level: number, id: string) =>
    setPicks((p) => ({ ...p, [level]: (p[level] ?? []).filter((x) => x !== id) }));

  // Available trainings for the open picker (not already chosen for that level), filtered by search.
  const pickerList = useMemo(() => {
    if (pickerLevel == null) return [];
    const chosen = new Set(picks[pickerLevel] ?? []);
    const q = pickerQ.trim().toLowerCase();
    return trainings.filter((t) => !chosen.has(t.id) && (!q || t.title.toLowerCase().includes(q)));
  }, [pickerLevel, picks, pickerQ, trainings]);

  async function save() {
    setSaving(true); setError(null);
    const descRows = LEVELS.map((l) => ({ competency_id: competency.id, level: l.n, actions: (desc[l.n] ?? '').trim() || null }));
    const e1 = (await supabase.from('competency_level_paths').upsert(descRows, { onConflict: 'competency_id,level' })).error;
    await supabase.from('competency_level_trainings').delete().eq('competency_id', competency.id);
    const trainRows = Object.entries(picks).flatMap(([level, ids]) =>
      ids.map((training_id) => ({ competency_id: competency.id, level: Number(level), training_id })),
    );
    const e2 = trainRows.length ? (await supabase.from('competency_level_trainings').insert(trainRows)).error : null;
    setSaving(false);
    if (e1 || e2) setError((e1 || e2)!.message);
    else onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{competency.name}</h2>
            <p className="modal-sub">Learning path</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading ? (
          <div className="modal-step"><p className="muted">Loading…</p></div>
        ) : (
          <div className="modal-step">
            {error && <p className="sync-msg err">{error}</p>}
            {competency.description && <p className="comp-modal-desc">{competency.description}</p>}
            <div className="lp-actions">
              <button className="btn btn-sm" onClick={() => onEdit(competency)}>Edit competency</button>
              <button className="link-btn danger" onClick={() => onDelete(competency)}>Delete</button>
            </div>

            <div className="lp-flow">
              {LEVELS.map((l) => {
                const selected = picks[l.n] ?? [];
                return (
                  <Fragment key={l.n}>
                    {l.n > 1 && (
                      <div className="lp-arrow-row">
                        <div className="lp-arrow"><span className="lp-arrow-dot">↓</span></div>
                        <div className="lp-train-strip">
                          <span className="lp-train-label">Trainings to reach {l.label}</span>
                          <div className="lp-train-chips">
                            {selected.length === 0 && <span className="muted lp-train-none">No training yet</span>}
                            {selected.map((id) => (
                              <span className="lp-train-chip" key={id}>
                                {trainingById[id]?.title ?? 'Unknown'}
                                <button className="chip-x" onClick={() => removeTraining(l.n, id)} aria-label="Remove">×</button>
                              </span>
                            ))}
                            <button className="lp-add-btn" onClick={() => { setPickerQ(''); setPickerLevel(l.n); }}>+ Add training</button>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="lp-card" style={{ borderLeftColor: l.color }}>
                      <div className="lp-card-head">
                        <span className={`level-chip lvl-${l.n}`}>{l.n}★</span>
                        <span className="lp-card-name">{l.label}</span>
                        <span className="lp-card-stars">{stars(l.n)}</span>
                      </div>
                      <span className="lp-meaning-lbl">What this level means</span>
                      <textarea
                        className="field lp-expect"
                        rows={2}
                        placeholder={l.hint}
                        value={desc[l.n] ?? ''}
                        onChange={(e) => setDesc((d) => ({ ...d, [l.n]: e.target.value }))}
                      />
                    </div>
                  </Fragment>
                );
              })}
            </div>

            <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save learning path'}
            </button>
          </div>
        )}
      </div>

      {pickerLevel != null && (
        <div className="modal-overlay lp-picker-overlay" onClick={(e) => { e.stopPropagation(); setPickerLevel(null); }}>
          <div className="modal lp-picker" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Add training</h2>
                <p className="modal-sub">To reach {LEVELS.find((x) => x.n === pickerLevel)?.label}</p>
              </div>
              <button className="modal-close" onClick={() => setPickerLevel(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <input className="field" placeholder="Search trainings…" value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} autoFocus />
              <div className="lp-picker-list">
                {pickerList.length === 0 && <p className="muted">No matching trainings to add.</p>}
                {pickerList.map((t) => (
                  <button className="lp-picker-item" key={t.id} onClick={() => addTraining(pickerLevel, t.id)}>
                    <span className="lp-picker-title">{t.title}</span>
                    <span className="lp-picker-meta">{t.duration_hours}h</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-block" onClick={() => setPickerLevel(null)} style={{ marginTop: 12 }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
