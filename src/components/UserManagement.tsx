import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
 * - Consultant users are provisioned by the Control Room sync and are read-only:
 *   editing one here would be overwritten by the next sync.
 * - Access is matched by Microsoft 365 email; the auth lookup requires is_active.
 *   So changing an email changes who can sign in to that account, which is why
 *   the edit form says so plainly rather than treating it as an ordinary field.
 */

const ROLE_LABEL: Record<ProductRole, string> = {
  superadmin: 'Superadmin',
  technical_director: 'Technical Director',
  consultant: 'Consultant',
};

export default function UserManagement() {
  const { user, startViewAs } = useAuth();
  const navigate = useNavigate();

  // View-as changes which pages are reachable, and the System page is superadmin
  // only, so land on the dashboard rather than being bounced off this one.
  function viewAsUser(u: AppUser) {
    startViewAs(u);
    navigate('/');
  }
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [modal, setModal] = useState<{ mode: 'new' } | { mode: 'edit'; u: AppUser } | null>(null);
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

  async function saveUser() {
    const e = email.trim().toLowerCase();
    const n = name.trim();
    if (!modal || !e || !n) return;
    setAdding(true); setError(null); setMsg(null);
    let err;

    if (modal.mode === 'edit') {
      // Name and email only. Role and active state have their own controls, and
      // a consultant record is never edited here.
      err = (await supabase.from('users').update({ full_name: n, email: e }).eq('id', modal.u.id)).error;
      if (!err) {
        setMsg(e === modal.u.email.toLowerCase()
          ? `${n} updated.`
          : `${n} updated. They now sign in with ${e}.`);
      }
    } else {
      const existing = users.find((u) => u.email.toLowerCase() === e);
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
    }

    setAdding(false);
    if (err) { setError(err.message); return; }
    setEmail(''); setName(''); setModal(null); load();
  }

  function openAdd() { setEmail(''); setName(''); setError(null); setModal({ mode: 'new' }); }
  function openEdit(u: AppUser) {
    setEmail(u.email); setName(u.full_name ?? ''); setError(null); setModal({ mode: 'edit', u });
  }

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

  const editing = modal?.mode === 'edit' ? modal.u : null;
  const emailChanged = !!editing && email.trim().toLowerCase() !== editing.email.toLowerCase();
  const editingSelf = !!editing && user?.id === editing.id;
  const nothingChanged =
    !!editing && !emailChanged && name.trim() === (editing.full_name ?? '');

  return (
    <>
      <div className="card">
        <div className="um-head">
          <h2 className="panel-title">Back office</h2>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Technical Director</button>
        </div>

        {error && !modal && <p className="sync-msg err">{error}</p>}
        {msg && <p className="sync-msg ok">{msg}</p>}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : backOffice.length === 0 ? (
          <p className="muted">No back-office users yet.</p>
        ) : (
          <div className="dash-list">
            {backOffice.map((u) => (
              <div className={`dash-row static um-row${u.is_active ? '' : ' is-inactive'}`} key={u.id}>
                <div className="dash-row-main">
                  <div className="dash-row-name">{u.full_name || u.email}</div>
                  <div className="dash-row-sub">{u.email}</div>
                </div>
                <span className={`role-pill ${u.product_role}`}>{ROLE_LABEL[u.product_role]}</span>
                <span className={`status-pill ${u.is_active ? 'act' : 'req'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                <div className="um-actions">
                  {user?.id !== u.id && u.is_active && (
                    <button className="link-btn" onClick={() => viewAsUser(u)} title={`See SQEPify as ${u.full_name || u.email}`}>View as</button>
                  )}
                  <button className="link-btn" onClick={() => openEdit(u)}>Edit</button>
                  {user?.id === u.id ? (
                    <span className="muted um-you">you</span>
                  ) : u.is_active ? (
                    <button className="link-btn danger" onClick={() => deactivate(u)}>Deactivate</button>
                  ) : (
                    <button className="link-btn" onClick={() => reactivate(u)}>Reactivate</button>
                  )}
                </div>
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
              <div className="dash-row static um-row um-row-consultant" key={u.id}>
                <div className="dash-row-main">
                  <div className="dash-row-name">{u.full_name || u.email}</div>
                  <div className="dash-row-sub">{u.email}</div>
                </div>
                <span className={`status-pill ${u.is_active ? 'act' : 'req'}`}>{u.is_active ? 'Active' : 'Left'}</span>
                <div className="um-actions">
                  {u.is_active && (
                    <button className="link-btn" onClick={() => viewAsUser(u)} title={`See SQEPify as ${u.full_name || u.email}`}>View as</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted card-hint" style={{ marginTop: 10 }}>{consultants.filter((u) => u.is_active).length} active of {consultants.length}.</p>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'new' ? 'Add Technical Director' : 'Edit profile'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              {modal.mode === 'edit' && (
                <p className="muted card-hint" style={{ marginTop: 0 }}>
                  {ROLE_LABEL[modal.u.product_role]}. The role and whether the account is active are
                  changed from the list, not here.
                </p>
              )}
              <label>Name</label>
              <input className="field" autoFocus placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <label>Microsoft 365 email</label>
              <input className="field" type="email" placeholder="name@thenuclearhouse.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} />

              {emailChanged && (
                <p className="sync-msg warn">
                  {editingSelf
                    ? 'This is your own account. Access is matched on this address, so if it does not match the Microsoft 365 account you sign in with, you will lock yourself out.'
                    : `Access is matched on this address. ${name.trim() || 'They'} will only be able to sign in with the Microsoft 365 account for the new address.`}
                </p>
              )}

              {error && <p className="sync-msg err">{error}</p>}
              <button
                className="btn btn-primary btn-block"
                onClick={saveUser}
                disabled={adding || !email.trim() || !name.trim() || nothingChanged}
              >
                {adding ? 'Saving…' : modal.mode === 'new' ? 'Add Technical Director' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={() => confirm.onYes()} onCancel={() => setConfirm(null)} />}
    </>
  );
}
