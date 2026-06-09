import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import ConfirmDialog from './ConfirmDialog';
import type { AppUser, ProductRole } from '../lib/types';

const ROLE_LABEL: Record<ProductRole, string> = {
  superadmin: 'Superadmin',
  technical_director: 'Technical Director',
  consultant: 'Consultant',
};

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'technical_director' | 'superadmin'>('technical_director');
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, product_role, consultant_id, is_active')
      .order('product_role')
      .order('full_name');
    if (error) setError(error.message);
    else { setError(null); setUsers((data as AppUser[]) ?? []); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const backOffice = useMemo(() => users.filter((u) => u.product_role === 'superadmin' || u.product_role === 'technical_director'), [users]);
  const consultants = useMemo(
    () => users.filter((u) => u.product_role === 'consultant').sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [users],
  );

  async function addUser() {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setAdding(true); setError(null); setMsg(null);
    const existing = users.find((u) => u.email.toLowerCase() === e);
    if (existing) {
      const { error } = await supabase.from('users').update({ product_role: role, is_active: true, full_name: name.trim() || existing.full_name }).eq('id', existing.id);
      if (error) setError(error.message);
      else setMsg(`${e} updated to ${ROLE_LABEL[role]}.`);
    } else {
      const { error } = await supabase.from('users').insert({ email: e, full_name: name.trim() || null, product_role: role, is_active: true });
      if (error) setError(error.message);
      else setMsg(`${e} added as ${ROLE_LABEL[role]}. They sign in with Microsoft 365 using that email.`);
    }
    setAdding(false); setEmail(''); setName(''); load();
  }

  function removeUser(u: AppUser) {
    setConfirm({
      title: 'Remove access',
      message: `Remove ${u.full_name || u.email} from the back office? They lose access to SQEPify. This doesn't touch the Control Room.`,
      onYes: () => supabase.from('users').delete().eq('id', u.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); load(); }),
    });
  }

  return (
    <>
      <div className="card">
        <h2 className="panel-title">Back office</h2>
        <p className="muted card-hint">Superadmins and Technical Directors who can sign in to manage consultants. Access is by Microsoft 365 email.</p>

        {error && <p className="sync-msg err">{error}</p>}
        {msg && <p className="sync-msg ok">{msg}</p>}

        <div className="um-add">
          <input className="field" type="email" placeholder="name@thenuclearhouse.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="field" placeholder="Full name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as 'technical_director' | 'superadmin')}>
            <option value="technical_director">Technical Director</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <button className="btn btn-primary" onClick={addUser} disabled={adding || !email.trim()}>{adding ? 'Saving…' : 'Add'}</button>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : backOffice.length === 0 ? (
          <p className="muted">No back-office users yet.</p>
        ) : (
          <div className="dash-list">
            {backOffice.map((u) => (
              <div className="dash-row static" key={u.id}>
                <div className="dash-row-main">
                  <div className="dash-row-name">{u.full_name || u.email}</div>
                  <div className="dash-row-sub">{u.email}</div>
                </div>
                <span className={`role-pill ${u.product_role}`}>{ROLE_LABEL[u.product_role]}</span>
                {user?.id === u.id ? (
                  <span className="muted um-you">you</span>
                ) : (
                  <button className="link-btn danger" onClick={() => removeUser(u)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="panel-title">Consultant users</h2>
        <p className="muted card-hint">Consultants with access, provisioned automatically from the Control Room sync. Manage who exists in the Control Room; this list is read-only.</p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : consultants.length === 0 ? (
          <p className="muted">No consultant users yet. They appear after the first sync.</p>
        ) : (
          <div className="dash-list">
            {consultants.map((u) => (
              <div className="dash-row static" key={u.id}>
                <div className="dash-row-main">
                  <div className="dash-row-name">{u.full_name || u.email}</div>
                  <div className="dash-row-sub">{u.email}</div>
                </div>
                <span className={`status-pill ${u.is_active ? 'act' : 'req'}`}>{u.is_active ? 'Active' : 'Left'}</span>
              </div>
            ))}
          </div>
        )}
        <p className="muted card-hint" style={{ marginTop: 10 }}>{consultants.filter((u) => u.is_active).length} active of {consultants.length}.</p>
      </div>

      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={() => confirm.onYes()} onCancel={() => setConfirm(null)} />}
    </>
  );
}
