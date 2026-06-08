import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Competency, Training, CompetencyLevelPath, CompetencyLevelTraining } from '../lib/types';

const LEVELS = [
  { n: 1, label: 'No knowledge', hint: 'Not yet exposed to this.' },
  { n: 2, label: 'Awareness', hint: 'General knowledge of the topic.' },
  { n: 3, label: 'Basic competence', hint: 'Can apply it under supervision.' },
  { n: 4, label: 'Full competence (SQEP)', hint: 'Works independently to good practice.' },
  { n: 5, label: 'Expert', hint: 'Can design, adapt and coach others.' },
];
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export default function LearningPath({
  competency,
  onClose,
  onEdit,
  onDelete,
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

  async function save() {
    setSaving(true);
    setError(null);
    const descRows = LEVELS.map((l) => ({
      competency_id: competency.id,
      level: l.n,
      actions: (desc[l.n] ?? '').trim() || null,
    }));
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

            <p className="lp-intro">
              What each level means for this competency, and the trainings someone takes to reach it.
            </p>

            {LEVELS.map((l) => {
              const selected = picks[l.n] ?? [];
              const available = trainings.filter((t) => !selected.includes(t.id));
              return (
                <div className="lp-level" key={l.n}>
                  <div className="lp-level-head">
                    <span className={`level-chip lvl-${l.n}`}>{l.n}★</span>
                    <span className="lp-level-name">{l.label}</span>
                    <span className="lp-stars-mini">{stars(l.n)}</span>
                  </div>
                  <label>What this level means</label>
                  <textarea
                    className="field"
                    rows={2}
                    placeholder={l.hint}
                    value={desc[l.n] ?? ''}
                    onChange={(e) => setDesc((d) => ({ ...d, [l.n]: e.target.value }))}
                  />
                  {l.n > 1 && (
                    <>
                      <label>Trainings to reach this level</label>
                      <div className="chip-wrap">
                        {selected.length === 0 && <span className="muted">None set.</span>}
                        {selected.map((id) => (
                          <span className="comp-chip" key={id}>
                            {trainingById[id]?.title ?? 'Unknown'}
                            <button className="chip-x" onClick={() => removeTraining(l.n, id)} aria-label="Remove">×</button>
                          </span>
                        ))}
                      </div>
                      {available.length > 0 && (
                        <select
                          className="field lp-add-training"
                          value=""
                          onChange={(e) => { if (e.target.value) addTraining(l.n, e.target.value); }}
                        >
                          <option value="">+ Add a training…</option>
                          {available.map((t) => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save learning path'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
