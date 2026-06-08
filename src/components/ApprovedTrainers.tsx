import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import type { Trainer } from '../lib/types';

interface Pickable {
  id: string;
  name: string;
}

const KIND_LABEL: Record<Trainer['kind'], string> = {
  technical_director: 'Technical Director',
  consultant: 'Consultant',
  external: 'External provider',
};

type Step = 'choose' | 'technical_director' | 'consultant' | 'external';

export default function ApprovedTrainers() {
  const { user } = useAuth();
  const isStaff =
    user?.product_role === 'superadmin' || user?.product_role === 'technical_director';

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tdOptions, setTdOptions] = useState<Pickable[]>([]);
  const [consultantOptions, setConsultantOptions] = useState<Pickable[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [pick, setPick] = useState('');
  const [ext, setExt] = useState({ company: '', contact: '', email: '', phone: '', notes: '' });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .order('kind')
      .order('display_name');
    if (error) setError(error.message);
    else {
      setError(null);
      setTrainers((data as Trainer[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    supabase.rpc('trainer_candidates').then(({ data }) => {
      const rows = (data as { kind: string; id: string; name: string }[]) ?? [];
      setTdOptions(rows.filter((r) => r.kind === 'td').map((r) => ({ id: r.id, name: r.name })));
      setConsultantOptions(
        rows.filter((r) => r.kind === 'consultant').map((r) => ({ id: r.id, name: r.name })),
      );
    });
  }, [isStaff]);

  const usedUserIds = new Set(trainers.map((t) => t.user_id).filter(Boolean));
  const usedConsultantIds = new Set(trainers.map((t) => t.consultant_id).filter(Boolean));
  const availableTds = tdOptions.filter((o) => !usedUserIds.has(o.id));
  const availableConsultants = consultantOptions.filter((o) => !usedConsultantIds.has(o.id));

  function openModal() {
    setStep('choose');
    setPick('');
    setExt({ company: '', contact: '', email: '', phone: '', notes: '' });
    setError(null);
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
  }

  async function save(row: Record<string, unknown>) {
    const { error } = await supabase.from('trainers').insert(row);
    if (error) {
      setError(error.message);
      return;
    }
    closeModal();
    load();
  }

  async function saveTd() {
    const opt = availableTds.find((o) => o.id === pick);
    if (opt) await save({ kind: 'technical_director', user_id: opt.id, display_name: opt.name });
  }
  async function saveConsultant() {
    const opt = availableConsultants.find((o) => o.id === pick);
    if (opt) await save({ kind: 'consultant', consultant_id: opt.id, display_name: opt.name });
  }
  async function saveExternal() {
    if (!ext.company && !ext.contact) return;
    await save({
      kind: 'external',
      display_name: ext.company || ext.contact,
      company_name: ext.company || null,
      contact_name: ext.contact || null,
      contact_email: ext.email || null,
      contact_phone: ext.phone || null,
      notes: ext.notes || null,
    });
  }

  async function remove(id: string) {
    const { error } = await supabase.from('trainers').delete().eq('id', id);
    if (error) setError(error.message);
    load();
  }

  return (
    <div>
      {isStaff && (
        <div className="trainers-toolbar">
          <button className="btn btn-primary" onClick={openModal}>+ Add a new trainer</button>
          {error && !open && <span className="sync-msg err" style={{ margin: 0 }}>{error}</span>}
        </div>
      )}

      <div className="card table-card">
        {loading ? (
          <p className="muted" style={{ padding: 16 }}>Loading…</p>
        ) : trainers.length === 0 ? (
          <p className="muted" style={{ padding: 16 }}>No approved trainers yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Contact</th>
                {isStaff && <th></th>}
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr key={t.id}>
                  <td>{t.display_name}</td>
                  <td><span className={`badge kind-${t.kind}`}>{KIND_LABEL[t.kind]}</span></td>
                  <td className="mono-cell">
                    {t.kind === 'external'
                      ? [t.contact_email, t.contact_phone].filter(Boolean).join(' · ') || '-'
                      : '-'}
                  </td>
                  {isStaff && (
                    <td className="row-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(t.id)}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add a trainer</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Close">×</button>
            </div>

            {step === 'choose' && (
              <>
                <p className="muted">Who are you adding?</p>
                <div className="tile-grid">
                  <button className="tile" onClick={() => setStep('technical_director')}>
                    <span className="tile-mark cyan">TD</span>
                    Technical Director
                  </button>
                  <button className="tile" onClick={() => setStep('consultant')}>
                    <span className="tile-mark green">C</span>
                    Consultant
                  </button>
                  <button className="tile" onClick={() => setStep('external')}>
                    <span className="tile-mark gold">Ext</span>
                    External provider
                  </button>
                </div>
              </>
            )}

            {step === 'technical_director' && (
              <div className="modal-step">
                <button className="modal-back" onClick={() => setStep('choose')}>← Back</button>
                <label>Choose a Technical Director</label>
                <select className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Select…</option>
                  {availableTds.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {availableTds.length === 0 && <p className="muted">All Technical Directors are already added.</p>}
                <button className="btn btn-primary btn-block" onClick={saveTd} disabled={!pick}>Add trainer</button>
              </div>
            )}

            {step === 'consultant' && (
              <div className="modal-step">
                <button className="modal-back" onClick={() => setStep('choose')}>← Back</button>
                <label>Choose a consultant</label>
                <select className="field" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">Select…</option>
                  {availableConsultants.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {availableConsultants.length === 0 && <p className="muted">No consultants available to add.</p>}
                <button className="btn btn-primary btn-block" onClick={saveConsultant} disabled={!pick}>Add trainer</button>
              </div>
            )}

            {step === 'external' && (
              <div className="modal-step">
                <button className="modal-back" onClick={() => setStep('choose')}>← Back</button>
                <label>External provider details</label>
                <input className="field" placeholder="Company name" value={ext.company} onChange={(e) => setExt({ ...ext, company: e.target.value })} />
                <input className="field" placeholder="Contact name" value={ext.contact} onChange={(e) => setExt({ ...ext, contact: e.target.value })} />
                <input className="field" placeholder="Contact email" value={ext.email} onChange={(e) => setExt({ ...ext, email: e.target.value })} />
                <input className="field" placeholder="Contact phone" value={ext.phone} onChange={(e) => setExt({ ...ext, phone: e.target.value })} />
                <input className="field" placeholder="Notes (optional)" value={ext.notes} onChange={(e) => setExt({ ...ext, notes: e.target.value })} />
                <button className="btn btn-primary btn-block" onClick={saveExternal} disabled={!ext.company && !ext.contact}>Add trainer</button>
              </div>
            )}

            {error && open && <p className="sync-msg err">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
