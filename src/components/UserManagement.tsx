import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import ConfirmDialog from './ConfirmDialog';
import type { AppUser, ProductRole } from '../lib/types';

/*
 * User management (superadmin only, on the System page).
 * Decisions, kept here rather than as on-screen copy:
 * - The UI only ADDS Technical Directors. There is a single superadmin; adding
 *   more superadmins is a manual Supabase change, not a front-end option.
 * - Name is required (we always want a real person's name against the account).
 * - "Remove" is a deactivate (is_active = false), never a hard delete: profiles
 *   carry history and dependencies (e.g. assessments.created_by). Hard deletes
 *   are a manual Supabase query only. Deactivated users can be reactivated here.
 * - Consultant users are provisioned by the Control Room sync and are read-only.
 * - Access is matched by Microsoft 365 email; the auth lookup requires is_active.
 */

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
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
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

  const backOffice = useMemo(
    () => users.filter((u) => u.product_role === 'superadmin' || u.product_role === 'technical_director')
      .sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [users],
  );
  const consultants = useMemo(
    () => users.filter((u) => u.product_role === 'consultant').sort((a, b) => Number(b.is_active) - Number(a.is_active)),
    [users],
  );

  async function addUser() {
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!e || !n) return;
    setAdding(true); setError(null); setMsg(null);
    const existing = users.find((u) => u.email.toLowerCase() === e);
    let err;
    if (existing?.product_role === 'superadmin') {
      setAdding(false); setError('That email is the superadmin and is managed in Supabase.'); return;
    }
    if (existing) {
      err = (await supabase.from('users').update({ product_role: 'technical_director', is_active: true, full_name: n }).eq('id', existing.id)).error;
      if (!err) setMsg(`${n} is now a Technical Director.`);
    } else {
      err = (await supabase.from('users').insert({ email: e, full_name: n, product_role: 'technical_director', is_active: true })).error;
      if (!err) setMsg(`${n} added. They sign in with Microsoft 365 using ${e}.`);
    }
    setAdding(false);
    if (err) { setError(err.message); return; }
    setEmail(''); setName(''); setShowAdd(false); load();
  }

  function openAdd() { setEmail(''); setName(''); setError(null); setShowAdd(true); }

  function deactivate(u: AppUser) {
    setConfirm({
      title: 'Deactivate access',
      message: `Deactivate ${u.full_name || u.email}? They keep their history but lose access to SQEPify from their next sign-in. You can reactivate them here at any time.`,
      onYes: () => supabase.from('users').update({ is_active: false }).eq('id', u.id).then(({ error }) => { if (error) setError(error.message); setConfirm(null); setMsg(`${u.email} deactivated.`); load(); }),
    });
  }

  async function reactivate(u: AppUser) {
    setError(null);
    const { error } = await supabase.from('users').update({ is_active: true }).eq('id', u.id);
    if (error) setError(error.message); else setMsg(`${u.email} reactivated.`);
    load();
  }

  return (
    <>
      <div className="card">
        <div className="um-head">
          <h2 className="panel-title">Back office</h2>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Technical Director</button>
        </div>

        {error && !showAdd && <p className="sync-msg err">{error}</p>}
        {msg && <p className="sync-msg ok">{msg}</p>}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : backOffice.length === 0 ? (
          <p className="muted">No back-office users yet.</p>
        ) : (
          <div className="dash-list">
            {backOffice.map((u) => (
              <div className={`dash-row static${u.is_active ? '' : ' is-inactive'}`} key={u.id}>
                <div className="dash-row-main">
                  <div className="dash-row-name">{u.full_name || u.email}</div>
                  <div className="dash-row-sub">{u.email}</div>
                </div>
                <span className={`role-pill ${u.product_role}`}>{ROLE_LABEL[u.product_role]}</span>
                <span className={`status-pill ${u.is_active ? 'act' : 'req'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                {user?.id === u.id ? (
                  <span className="muted um-you">you</span>
                ) : u.is_active ? (
                  <button className="link-btn danger" onClick={() => deactivate(u)}>Deactivate</button>
                ) : (
                  <button className="link-btn" onClick={() => reactivate(u)}>Reactivate</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="panel-title">Consultant users</h2>
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

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Add Technical Director</h2><button className="modal-close" onClick={() => setShowAdd(false)} aria-label="Close">×</button></div>
            <div className="modal-step">
              <label>Name</label>
              <input className="field" autoFocus placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <label>Microsoft 365 email</label>
              <input className="field" type="email" placeholder="name@thenuclearhouse.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} />
              {error && <p className="sync-msg err">{error}</p>}
              <button className="btn btn-primary btn-block" onClick={addUser} disabled={adding || !email.trim() || !name.trim()}>{adding ? 'Saving…' : 'Add Technical Director'}</button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={() => confirm.onYes()} onCancel={() => setConfirm(null)} />}
    </>
  );
}
