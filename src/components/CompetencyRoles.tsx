import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
  Role,
  RoleCompetency,
} from '../lib/types';

const REQ_LEVELS = [
  { n: 2, label: 'Awareness' },
  { n: 3, label: 'Basic' },
  { n: 4, label: 'SQEP' },
  { n: 5, label: 'Expert' },
];

export default function CompetencyRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [rc, setRc] = useState<RoleCompetency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<{ mode: 'new' } | { mode: 'edit'; role: Role } | null>(null);
  const [roleName, setRoleName] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [r, c, s, k, j] = await Promise.all([
      supabase.from('roles').select('*').order('is_base', { ascending: false }).order('sort_order').order('name'),
      supabase.from('competency_categories').select('*').order('sort_order').order('name'),
      supabase.from('competency_subcategories').select('*').order('sort_order').order('name'),
      supabase.from('competencies').select('*').order('sort_order').order('name'),
      supabase.from('role_competencies').select('*'),
    ]);
    const err = r.error || c.error || s.error || k.error || j.error;
    if (err) setError(err.message);
    else {
      setError(null);
      const rs = (r.data as Role[]) ?? [];
      setRoles(rs);
      setCats((c.data as CompetencyCategory[]) ?? []);
      setSubs((s.data as CompetencySubcategory[]) ?? []);
      setComps((k.data as Competency[]) ?? []);
      setRc((j.data as RoleCompetency[]) ?? []);
      setSelectedRoleId((prev) => (prev && rs.some((x) => x.id === prev) ? prev : null));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const baseRoleId = useMemo(() => roles.find((r) => r.is_base)?.id ?? null, [roles]);
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const catsById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const subsById = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s])), [subs]);

  const rolesOfComp = useMemo(() => {
    const m: Record<string, string[]> = {};
    rc.forEach((x) => (m[x.competency_id] ??= []).push(x.role_id));
    return m;
  }, [rc]);

  const inSelected = useMemo(
    () => new Set(rc.filter((x) => x.role_id === selectedRoleId).map((x) => x.competency_id)),
    [rc, selectedRoleId],
  );

  const reqByComp = useMemo(() => {
    const m: Record<string, number> = {};
    rc.filter((x) => x.role_id === selectedRoleId).forEach((x) => (m[x.competency_id] = x.required_level));
    return m;
  }, [rc, selectedRoleId]);

  async function setLevel(c: Competency, level: number) {
    if (!selectedRoleId) return;
    setRc((prev) => prev.map((x) => (x.role_id === selectedRoleId && x.competency_id === c.id ? { ...x, required_level: level } : x)));
    const { error } = await supabase
      .from('role_competencies')
      .update({ required_level: level })
      .eq('role_id', selectedRoleId)
      .eq('competency_id', c.id);
    if (error) { setError(error.message); refresh(); }
  }

  function count(roleId: string) {
    return rc.filter((x) => x.role_id === roleId).length;
  }

  // group a set of competencies by category -> subcategory for display
  function grouped(items: Competency[]) {
    const byCat: Record<string, Record<string, Competency[]>> = {};
    items.forEach((c) => {
      const ck = c.category_id;
      const sk = c.subcategory_id ?? 'none';
      ((byCat[ck] ??= {})[sk] ??= []).push(c);
    });
    return byCat;
  }

  async function refresh() { await load(); }

  const addRole = () => {
    if (!roleName.trim()) return;
    supabase.from('roles').insert({ name: roleName.trim() }).then(({ error }) => {
      if (error) setError(error.message);
      setRoleModal(null); setRoleName(''); refresh();
    });
  };
  const renameRole = (role: Role) => {
    if (!roleName.trim()) return;
    supabase.from('roles').update({ name: roleName.trim() }).eq('id', role.id).then(({ error }) => {
      if (error) setError(error.message);
      setRoleModal(null); setRoleName(''); refresh();
    });
  };
  const deleteRole = (role: Role) => {
    setConfirm({
      title: 'Delete role',
      message: `Delete the role "${role.name}"? Its competency assignments are removed. The competencies themselves stay in the library.`,
      onYes: () => supabase.from('roles').delete().eq('id', role.id).then(({ error }) => {
        if (error) setError(error.message);
        setConfirm(null); refresh();
      }),
    });
  };

  async function toggleComp(c: Competency) {
    if (!selectedRoleId) return;
    if (inSelected.has(c.id)) {
      const { error } = await supabase.from('role_competencies').delete().eq('role_id', selectedRoleId).eq('competency_id', c.id);
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.from('role_competencies').insert({ role_id: selectedRoleId, competency_id: c.id });
      if (error) setError(error.message);
    }
    refresh();
  }

  // eligibility of a competency for the selected role (when not already in it)
  function ineligibleReason(c: Competency): string | null {
    if (!selectedRole) return null;
    const inRoles = rolesOfComp[c.id] ?? [];
    if (selectedRole.is_base) {
      const others = inRoles.filter((rid) => rid !== baseRoleId);
      if (others.length) {
        const names = others.map((rid) => roles.find((r) => r.id === rid)?.name).filter(Boolean).join(', ');
        return `In role: ${names}`;
      }
    } else {
      if (baseRoleId && inRoles.includes(baseRoleId)) return 'In Base Nuclear, everyone';
    }
    return null;
  }

  const selectedComps = comps.filter((c) => inSelected.has(c.id));
  const selectedGrouped = grouped(selectedComps);

  return (
    <div>
      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : selectedRole ? (
        <section className="comp-cat">
          <header className="comp-cat-head">
            <h2>
              <button className="back-link" onClick={() => setSelectedRoleId(null)}>← All roles</button>
              {selectedRole.is_base && <span className="base-tag">BASE</span>}{selectedRole.name}
            </h2>
            <div className="tree-actions">
              {!selectedRole.is_base && (
                <>
                  <button className="link-btn" onClick={() => { setRoleName(selectedRole.name); setRoleModal({ mode: 'edit', role: selectedRole }); }}>Rename</button>
                  <button className="link-btn danger" onClick={() => deleteRole(selectedRole)}>Delete</button>
                </>
              )}
            </div>
          </header>
          <div className="comp-cat-body">
            {selectedRole.is_base && (
              <p className="muted role-note">Everyone is assessed against this role, plus any roles you select for them.</p>
            )}
            {selectedComps.length > 0 && (
              <div className="role-cat-grid">
                {Object.entries(selectedGrouped).map(([catId, bySub]) => (
                  <div className="role-cat-card" key={catId}>
                    <div className="role-grp-cat">{catsById[catId]?.name ?? 'Category'}</div>
                    {Object.entries(bySub).map(([subId, items]) => (
                      <div className="role-grp-sub-block" key={subId}>
                        {subId !== 'none' && <div className="role-grp-sub">{subsById[subId]?.name ?? ''}</div>}
                        <div className="chip-wrap">
                          {items.map((c) => (
                            <span className="comp-chip" key={c.id}>
                              {c.name}
                              <select
                                className="chip-level"
                                value={reqByComp[c.id] ?? 4}
                                onChange={(e) => setLevel(c, Number(e.target.value))}
                                title="Required level"
                                aria-label={`Required level for ${c.name}`}
                              >
                                {REQ_LEVELS.map((l) => (
                                  <option key={l.n} value={l.n}>{l.n}★ {l.label}</option>
                                ))}
                              </select>
                              <button className="chip-x" onClick={() => toggleComp(c)} title="Remove" aria-label={`Remove ${c.name}`}>×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <button className="add-comp-btn" onClick={() => setBrowseOpen(true)}>+ Add competencies</button>
          </div>
        </section>
      ) : (
        <div className="role-card-grid">
          {roles.map((r) => (
            <button className="role-card" key={r.id} onClick={() => setSelectedRoleId(r.id)}>
              <div className="role-card-top">
                {r.is_base && <span className="base-tag">BASE</span>}
                <span className="role-card-name">{r.name}</span>
              </div>
              <span className="role-card-count">{count(r.id)} {count(r.id) === 1 ? 'competency' : 'competencies'}</span>
            </button>
          ))}
          <button className="role-card role-card-add" onClick={() => { setRoleName(''); setRoleModal({ mode: 'new' }); }}>
            <span className="plus">+</span>
            <span>Add role</span>
          </button>
        </div>
      )}

      {/* add / rename role modal */}
      {roleModal && (
        <div className="modal-overlay" onClick={() => setRoleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{roleModal.mode === 'new' ? 'Add role' : 'Edit role'}</h2>
              <button className="modal-close" onClick={() => setRoleModal(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <label>Role name</label>
              <input className="field" autoFocus value={roleName} onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. EC&I Engineer"
                onKeyDown={(e) => { if (e.key === 'Enter' && roleName.trim()) (roleModal.mode === 'new' ? addRole() : renameRole(roleModal.role)); }} />
              <button className="btn btn-primary btn-block" onClick={() => roleModal.mode === 'new' ? addRole() : renameRole(roleModal.role)} disabled={!roleName.trim()}>
                {roleModal.mode === 'new' ? 'Add role' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* competency browser */}
      {browseOpen && selectedRole && (
        <div className="modal-overlay" onClick={() => setBrowseOpen(false)}>
          <div className="modal modal-tall modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add competencies to {selectedRole.name}</h2>
              <button className="modal-close" onClick={() => setBrowseOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>Tick to include. Greyed ones are not eligible for this role.</p>
            <div className="browse">
              {cats.map((cat) => {
                const catSubs = subs.filter((s) => s.category_id === cat.id);
                if (catSubs.length === 0) return null;
                return (
                  <div className="browse-cat" key={cat.id}>
                    <div className="role-grp-cat">{cat.name}</div>
                    {catSubs.map((sub) => {
                      const items = comps.filter((c) => c.subcategory_id === sub.id);
                      if (items.length === 0) return null;
                      return (
                        <div key={sub.id}>
                          <div className="role-grp-sub">{sub.name}</div>
                          {items.map((c) => {
                            const checked = inSelected.has(c.id);
                            const reason = checked ? null : ineligibleReason(c);
                            const disabled = !!reason;
                            return (
                              <label className={disabled ? 'browse-row disabled' : 'browse-row'} key={c.id}>
                                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleComp(c)} />
                                <span className="browse-name">{c.name}</span>
                                {reason && <span className="browse-tag">{reason}</span>}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {comps.length === 0 && <p className="muted">The library is empty. Add competencies in the Library tab first.</p>}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setBrowseOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => confirm.onYes()}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
