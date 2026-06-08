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

export default function ApprovedTrainers() {
  const { user } = useAuth();
  const isStaff =
    user?.product_role === 'superadmin' || user?.product_role === 'technical_director';

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tdOptions, setTdOptions] = useState<Pickable[]>([]);
  const [consultantOptions, setConsultantOptions] = useState<Pickable[]>([]);
  const [tdPick, setTdPick] = useState('');
  const [consultantPick, setConsultantPick] = useState('');
  const [showExternal, setShowExternal] = useState(false);
  const [ext, setExt] = useState({ company: '', contact: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('trainers')
      .select('*')
      .order('kind')
      .order('display_name');
    if (error) setError(error.message);
    else setTrainers((data as Trainer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Candidate pick lists come from a guarded lookup, so the underlying user and
  // consultant tables stay closed.
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

  async function addTd() {
    const opt = availableTds.find((o) => o.id === tdPick);
    if (!opt) return;
    const { error } = await supabase
      .from('trainers')
      .insert({ kind: 'technical_director', user_id: opt.id, display_name: opt.name });
    if (error) setError(error.message);
    setTdPick('');
    load();
  }

  async function addConsultant() {
    const opt = availableConsultants.find((o) => o.id === consultantPick);
    if (!opt) return;
    const { error } = await supabase
      .from('trainers')
      .insert({ kind: 'consultant', consultant_id: opt.id, display_name: opt.name });
    if (error) setError(error.message);
    setConsultantPick('');
    load();
  }

  async function addExternal() {
    if (!ext.company && !ext.contact) return;
    const { error } = await supabase.from('trainers').insert({
      kind: 'external',
      display_name: ext.company || ext.contact,
      company_name: ext.company || null,
      contact_name: ext.contact || null,
      contact_email: ext.email || null,
      contact_phone: ext.phone || null,
      notes: ext.notes || null,
    });
    if (error) setError(error.message);
    setExt({ company: '', contact: '', email: '', phone: '', notes: '' });
    setShowExternal(false);
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from('trainers').delete().eq('id', id);
    if (error) setError(error.message);
    load();
  }

  return (
    <div>
      {isStaff && (
        <div className="card add-trainers">
          <h2>Add an approved trainer</h2>
          <p className="muted">
            Only people and providers added here can be selected to deliver a training.
          </p>
          <div className="add-grid">
            <div className="add-block">
              <label>Technical Director</label>
              <div className="add-row">
                <select className="field" value={tdPick} onChange={(e) => setTdPick(e.target.value)}>
                  <option value="">Select…</option>
                  {availableTds.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button className="btn" onClick={addTd} disabled={!tdPick}>Add</button>
              </div>
            </div>
            <div className="add-block">
              <label>Consultant</label>
              <div className="add-row">
                <select className="field" value={consultantPick} onChange={(e) => setConsultantPick(e.target.value)}>
                  <option value="">Select…</option>
                  {availableConsultants.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                <button className="btn" onClick={addConsultant} disabled={!consultantPick}>Add</button>
              </div>
            </div>
            <div className="add-block">
              <label>External provider</label>
              <button className="btn" onClick={() => setShowExternal((s) => !s)}>
                {showExternal ? 'Cancel' : 'Add external…'}
              </button>
            </div>
          </div>

          {showExternal && (
            <div className="external-form">
              <input className="field" placeholder="Company name" value={ext.company} onChange={(e) => setExt({ ...ext, company: e.target.value })} />
              <input className="field" placeholder="Contact name" value={ext.contact} onChange={(e) => setExt({ ...ext, contact: e.target.value })} />
              <input className="field" placeholder="Contact email" value={ext.email} onChange={(e) => setExt({ ...ext, email: e.target.value })} />
              <input className="field" placeholder="Contact phone" value={ext.phone} onChange={(e) => setExt({ ...ext, phone: e.target.value })} />
              <input className="field" placeholder="Notes" value={ext.notes} onChange={(e) => setExt({ ...ext, notes: e.target.value })} />
              <button className="btn btn-primary" onClick={addExternal} disabled={!ext.company && !ext.contact}>Save external provider</button>
            </div>
          )}
          {error && <p className="sync-msg err">{error}</p>}
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
    </div>
  );
}
