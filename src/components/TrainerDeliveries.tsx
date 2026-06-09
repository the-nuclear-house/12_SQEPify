import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { DeliveryAssignment, Training } from '../lib/types';

// A trainer's own delivery schedule: one lane per training they deliver, with a people
// icon per month showing the cohort assigned to them. Delivery is confirmed per consultant.
// The trainer delivers; they do NOT assess (that's the consultant's TD on the consultant page).

type Cohort = { training_id: string; month: number; items: DeliveryAssignment[] };

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor" />
    </svg>
  );
}

function groupStatus(items: DeliveryAssignment[]): 'planned' | 'delivered' | 'assessed' {
  if (items.every((i) => i.status === 'assessed')) return 'assessed';
  if (items.some((i) => i.status === 'delivered' || i.status === 'assessed')) return 'delivered';
  return 'planned';
}

export default function TrainerDeliveries() {
  const [rows, setRows] = useState<DeliveryAssignment[]>([]);
  const [trainings, setTrainings] = useState<Record<string, Training>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Cohort | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveMonth, setMoveMonth] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, t] = await Promise.all([
      supabase.rpc('my_delivery_assignments'),
      supabase.from('trainings').select('id, title'),
    ]);
    if (a.error) { setError(a.error.message); setLoading(false); return; }
    setRows((a.data as DeliveryAssignment[]) ?? []);
    const map: Record<string, Training> = {};
    ((t.data as Training[]) ?? []).forEach((x) => { map[x.id] = x; });
    setTrainings(map);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const total = useMemo(() => Math.max(18, ...rows.map((r) => (r.start_month ?? 0) + 1), 1), [rows]);
  const pos = (m: number) => (total <= 1 ? 0 : (m / (total - 1)) * 100);

  // lanes = trainings the trainer has assignments for
  const lanes = useMemo(() => {
    const byTraining = new Map<string, DeliveryAssignment[]>();
    rows.forEach((r) => { const a = byTraining.get(r.training_id) ?? []; a.push(r); byTraining.set(r.training_id, a); });
    return [...byTraining.entries()].map(([training_id, items]) => {
      const byMonth = new Map<number, DeliveryAssignment[]>();
      items.forEach((it) => { const m = it.start_month ?? 0; const a = byMonth.get(m) ?? []; a.push(it); byMonth.set(m, a); });
      const cohorts: Cohort[] = [...byMonth.entries()].map(([month, its]) => ({ training_id, month, items: its }));
      return { training_id, title: trainings[training_id]?.title ?? 'Training', cohorts };
    }).sort((x, y) => x.title.localeCompare(y.title));
  }, [rows, trainings]);

  async function markDelivered(it: DeliveryAssignment) {
    setBusy(true);
    const { error } = await supabase.rpc('mark_training_delivered', { p_plan_item_id: it.plan_item_id });
    setBusy(false); setConfirmId(null);
    if (error) { setError(error.message); return; }
    setRows((rs) => rs.map((r) => (r.plan_item_id === it.plan_item_id ? { ...r, status: 'delivered' } : r)));
    setOpen((o) => (o ? { ...o, items: o.items.map((r) => (r.plan_item_id === it.plan_item_id ? { ...r, status: 'delivered' } : r)) } : o));
  }

  async function requestMove(it: DeliveryAssignment) {
    setBusy(true);
    const { error } = await supabase.rpc('request_training_move', { p_plan_item_id: it.plan_item_id, p_month: moveMonth });
    setBusy(false); setMoveId(null);
    if (error) { setError(error.message); return; }
    setRows((rs) => rs.map((r) => (r.plan_item_id === it.plan_item_id ? { ...r, pending_month: moveMonth } : r)));
    setOpen((o) => (o ? { ...o, items: o.items.map((r) => (r.plan_item_id === it.plan_item_id ? { ...r, pending_month: moveMonth } : r)) } : o));
  }

  if (loading) return <div className="card"><p className="muted" style={{ padding: 16 }}>Loading your schedule…</p></div>;

  return (
    <div className="card">
      <h2 className="panel-title">Your delivery schedule</h2>
      {error && <p className="sync-msg err">{error}</p>}
      {lanes.length === 0 ? (
        <p className="muted">Nothing assigned to you yet. A technical director assigns you to a training occurrence when they build a consultant's plan.</p>
      ) : (
        <div className="gantt2 td-gantt">
          <div className="gantt2-scroll"><div className="gantt2-grid">
            <div className="gantt2-axis">{Array.from({ length: total }, (_, m) => <span key={m} className="gantt2-tick" style={{ left: `${pos(m)}%` }}>M{m + 1}</span>)}</div>
            {lanes.map((lane) => (
              <div className="gantt2-lane" key={lane.training_id}>
                <div className="gantt2-lane-name" title={lane.title}>{lane.title}</div>
                <div className="gantt2-track">
                  <span className="gantt2-baseline" />
                  {lane.cohorts.map((co) => (
                    <button key={co.month} className={`td-person ${groupStatus(co.items)}`} style={{ left: `${pos(co.month)}%` }}
                      title={`${co.items.length} assigned · M${co.month + 1}`} onClick={() => { setOpen(co); setConfirmId(null); }}>
                      <PersonIcon />
                      {co.items.length > 1 && <span className="td-count">x{co.items.length}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div></div>
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{trainings[open.training_id]?.title ?? 'Training'} · M{open.month + 1}</h2>
              <button className="modal-close" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <p className="muted">{open.items.length} {open.items.length === 1 ? 'consultant' : 'consultants'} assigned to you this month. You confirm delivery; their technical director reassesses.</p>
              <div className="cohort-list">
                {open.items.map((it) => (
                  <div className="cohort-row" key={it.plan_item_id}>
                    <div className="cohort-main">
                      <div className="cohort-name">{it.consultant_name}</div>
                      <div className="cohort-td muted">TD: {it.td_full_name || it.td_email || 'unassigned'}</div>
                    </div>
                    {confirmId === it.plan_item_id ? (
                      <div className="cohort-confirm">
                        <span>Confirm you delivered this training to {it.consultant_name}?</span>
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => markDelivered(it)}>{busy ? 'Saving…' : 'Yes, delivered'}</button>
                        <button className="link-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                      </div>
                    ) : it.status === 'planned' ? (
                      it.pending_month != null ? (
                        <span className="cohort-pill">Move to M{it.pending_month + 1} requested</span>
                      ) : moveId === it.plan_item_id ? (
                        <div className="cohort-confirm">
                          <span>Ask the TD to move to</span>
                          <select className="field cohort-month" value={moveMonth} onChange={(e) => setMoveMonth(Number(e.target.value))}>
                            {Array.from({ length: total }, (_, m) => <option key={m} value={m}>M{m + 1}</option>)}
                          </select>
                          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => requestMove(it)}>{busy ? 'Sending…' : 'Request'}</button>
                          <button className="link-btn" onClick={() => setMoveId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="cohort-actions">
                          <button className="btn btn-sm" onClick={() => setConfirmId(it.plan_item_id)}>Mark delivered</button>
                          <button className="link-btn" onClick={() => { setMoveId(it.plan_item_id); setMoveMonth(it.start_month); }}>Request move</button>
                        </div>
                      )
                    ) : it.status === 'delivered' ? (
                      <span className="cohort-pill amber">Delivered · awaiting reassessment</span>
                    ) : (
                      <span className="cohort-pill green">Assessed</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
