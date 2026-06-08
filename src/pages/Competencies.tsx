import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from '../components/ConfirmDialog';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
} from '../lib/types';

type EditNode = { kind: 'category' | 'subcategory'; id: string } | null;

type CompModal =
  | { mode: 'new'; subcategoryId: string; categoryId: string }
  | { mode: 'view'; comp: Competency }
  | { mode: 'edit'; comp: Competency }
  | null;

const STAR_LEVELS = [
  { n: 1, label: 'No knowledge' },
  { n: 2, label: 'Awareness' },
  { n: 3, label: 'Basic competence' },
  { n: 4, label: 'Full competence (SQEP)' },
  { n: 5, label: 'Expert / can train others' },
];

export default function Competencies() {
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subText, setSubText] = useState('');
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});

  const [edit, setEdit] = useState<EditNode>(null);
  const [editName, setEditName] = useState('');

  const [modal, setModal] = useState<CompModal>(null);
  const [mName, setMName] = useState('');
  const [mDesc, setMDesc] = useState('');
  const [mLevels, setMLevels] = useState<Record<string, string>>({});
  const [showLevels, setShowLevels] = useState(false);

  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);

  async function load() {
    setLoading(true);
    const [c, s, k] = await Promise.all([
      supabase.from('competency_categories').select('*').order('sort_order').order('name'),
      supabase.from('competency_subcategories').select('*').order('sort_order').order('name'),
      supabase.from('competencies').select('*').order('sort_order').order('name'),
    ]);
    const err = c.error || s.error || k.error;
    if (err) setError(err.message);
    else {
      setError(null);
      setCats((c.data as CompetencyCategory[]) ?? []);
      setSubs((s.data as CompetencySubcategory[]) ?? []);
      setComps((k.data as Competency[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const subsByCat = useMemo(() => {
    const m: Record<string, CompetencySubcategory[]> = {};
    subs.forEach((s) => (m[s.category_id] ??= []).push(s));
    return m;
  }, [subs]);

  const compsBySub = useMemo(() => {
    const m: Record<string, Competency[]> = {};
    comps.forEach((c) => {
      if (c.subcategory_id) (m[c.subcategory_id] ??= []).push(c);
    });
    return m;
  }, [comps]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) setError(error.message);
    setEdit(null);
    setAddingSubFor(null);
    setSubText('');
    setModal(null);
    load();
  }

  const addCategory = () => {
    if (!newCat.trim()) return;
    run(supabase.from('competency_categories').insert({ name: newCat.trim() }));
    setNewCat('');
  };
  const addSubcategory = (categoryId: string) => {
    if (!subText.trim()) return;
    run(supabase.from('competency_subcategories').insert({ category_id: categoryId, name: subText.trim() }));
  };
  const renameNode = () => {
    if (!edit || !editName.trim()) return;
    const table = edit.kind === 'category' ? 'competency_categories' : 'competency_subcategories';
    run(supabase.from(table).update({ name: editName.trim() }).eq('id', edit.id));
  };
  const delNode = (kind: 'category' | 'subcategory', id: string, name: string) => {
    const table = kind === 'category' ? 'competency_categories' : 'competency_subcategories';
    setConfirm({
      title: kind === 'category' ? 'Delete category' : 'Delete subcategory',
      message:
        kind === 'category'
          ? `Delete "${name}"? This removes the category and every subcategory and competency inside it. This cannot be undone.`
          : `Delete "${name}"? This removes the subcategory and the competencies inside it. This cannot be undone.`,
      onYes: () => run(supabase.from(table).delete().eq('id', id)),
    });
  };

  function openNew(categoryId: string, subcategoryId: string) {
    setMName(''); setMDesc(''); setMLevels({}); setShowLevels(false);
    setModal({ mode: 'new', categoryId, subcategoryId });
  }
  function openView(comp: Competency) {
    setModal({ mode: 'view', comp });
  }
  function startEditComp(comp: Competency) {
    setMName(comp.name); setMDesc(comp.description ?? '');
    setMLevels(comp.level_descriptors ?? {});
    setShowLevels(!!comp.level_descriptors && Object.keys(comp.level_descriptors).length > 0);
    setModal({ mode: 'edit', comp });
  }
  const saveComp = () => {
    if (!modal || modal.mode === 'view') return;
    if (!mName.trim() || !mDesc.trim()) return;
    const ld: Record<string, string> = {};
    STAR_LEVELS.forEach((l) => { const v = (mLevels[l.n] ?? '').trim(); if (v) ld[String(l.n)] = v; });
    const level_descriptors = Object.keys(ld).length ? ld : null;
    if (modal.mode === 'new') {
      run(supabase.from('competencies').insert({
        category_id: modal.categoryId,
        subcategory_id: modal.subcategoryId,
        name: mName.trim(), description: mDesc.trim(), level_descriptors,
      }));
    } else {
      run(supabase.from('competencies').update({
        name: mName.trim(), description: mDesc.trim(), level_descriptors,
      }).eq('id', modal.comp.id));
    }
  };
  const deleteComp = (comp: Competency) => {
    setModal(null);
    setConfirm({
      title: 'Delete competency',
      message: `Delete "${comp.name}"? This removes it from the library. This cannot be undone.`,
      onYes: () => run(supabase.from('competencies').delete().eq('id', comp.id)),
    });
  };

  const renameRow = (
    <div className="rename-row">
      <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
      <button className="btn btn-sm btn-primary" onClick={renameNode} disabled={!editName.trim()}>Save</button>
      <button className="btn btn-sm btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <h1>Nuclear Competencies</h1>
        <p>
          Category, then Subcategory, then Competency. Pick a subcategory tab to see its
          competencies. Click a competency for its detail and star levels.
        </p>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : (
        <>
          {cats.length === 0 && (
            <div className="card"><p className="muted">No categories yet. Add the first one below.</p></div>
          )}

          {cats.map((cat) => {
            const catSubs = subsByCat[cat.id] ?? [];
            const active = activeSub[cat.id] ?? catSubs[0]?.id ?? null;
            const activeSubObj = catSubs.find((s) => s.id === active) ?? null;
            const activeComps = active ? compsBySub[active] ?? [] : [];
            const catEditing = edit?.kind === 'category' && edit.id === cat.id;
            const subEditing = edit?.kind === 'subcategory' && activeSubObj && edit.id === activeSubObj.id;
            return (
              <section className="comp-cat" key={cat.id}>
                <header className="comp-cat-head">
                  {catEditing ? renameRow : (
                    <>
                      <h2>{cat.name}</h2>
                      <div className="tree-actions">
                        <button className="link-btn" onClick={() => { setEdit({ kind: 'category', id: cat.id }); setEditName(cat.name); }}>Rename</button>
                        <button className="link-btn danger" onClick={() => delNode('category', cat.id, cat.name)}>Delete</button>
                      </div>
                    </>
                  )}
                </header>

                <div className="comp-cat-body">
                  <div className="sub-tabs">
                    {catSubs.map((sub) => (
                      <button
                        key={sub.id}
                        className={sub.id === active ? 'sub-tab active' : 'sub-tab'}
                        onClick={() => setActiveSub({ ...activeSub, [cat.id]: sub.id })}
                      >
                        {sub.name}
                        <span className="sub-count">{(compsBySub[sub.id] ?? []).length}</span>
                      </button>
                    ))}
                    {addingSubFor === cat.id ? (
                      <span className="rename-row sub-add">
                        <input className="field" value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Subcategory name" autoFocus />
                        <button className="btn btn-sm btn-primary" onClick={() => addSubcategory(cat.id)} disabled={!subText.trim()}>Add</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setAddingSubFor(null); setSubText(''); }}>Cancel</button>
                      </span>
                    ) : (
                      <button className="sub-tab add" onClick={() => { setAddingSubFor(cat.id); setSubText(''); }}>+ Subcategory</button>
                    )}
                  </div>

                  {activeSubObj ? (
                    <>
                      <div className="sub-bar">
                        {subEditing ? renameRow : (
                          <div className="tree-actions">
                            <button className="link-btn" onClick={() => { setEdit({ kind: 'subcategory', id: activeSubObj.id }); setEditName(activeSubObj.name); }}>Rename subcategory</button>
                            <button className="link-btn danger" onClick={() => delNode('subcategory', activeSubObj.id, activeSubObj.name)}>Delete subcategory</button>
                          </div>
                        )}
                      </div>
                      <div className="comp-grid">
                        {activeComps.map((c) => (
                          <button className="comp-card" key={c.id} onClick={() => openView(c)} title="View details">
                            <span className="c-name">{c.name}</span>
                          </button>
                        ))}
                        <button className="comp-card comp-add" onClick={() => openNew(cat.id, activeSubObj.id)}>
                          <span className="plus">+</span><span>Add competency</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="muted" style={{ marginTop: 12 }}>Add a subcategory to start adding competencies.</p>
                  )}
                </div>
              </section>
            );
          })}

          <div className="card add-category">
            <label>Add a category</label>
            <div className="add-row">
              <input className="field" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Nuclear Safety" />
              <button className="btn btn-primary" onClick={addCategory} disabled={!newCat.trim()}>Add category</button>
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'view' ? modal.comp.name : modal.mode === 'edit' ? 'Edit competency' : 'Add competency'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>

            {modal.mode === 'view' ? (
              <div className="modal-body">
                <p className="comp-modal-desc">{modal.comp.description || 'No description.'}</p>
                {modal.comp.level_descriptors && Object.keys(modal.comp.level_descriptors).length > 0 && (
                  <div className="level-list">
                    {STAR_LEVELS.map((l) => {
                      const v = modal.comp.level_descriptors?.[String(l.n)];
                      if (!v) return null;
                      return (
                        <div className="level-line" key={l.n}>
                          <span className={`level-chip lvl-${l.n}`}>{l.n}★</span>
                          <span className="level-text"><strong>{l.label}.</strong> {v}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn btn-sm" onClick={() => startEditComp(modal.comp)}>Edit</button>
                  <button className="link-btn danger" onClick={() => deleteComp(modal.comp)}>Delete</button>
                </div>
              </div>
            ) : (
              <div className="modal-step">
                <label>Name</label>
                <input className="field" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Competency name" autoFocus />
                <label>Description</label>
                <textarea className="field" rows={2} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="What this competency covers" />

                <button className="levels-toggle" onClick={() => setShowLevels((s) => !s)}>
                  {showLevels ? '▾' : '▸'} Star level descriptors (optional)
                </button>
                {showLevels && (
                  <div className="levels-edit">
                    {STAR_LEVELS.map((l) => (
                      <div className="level-edit-row" key={l.n}>
                        <span className={`level-chip lvl-${l.n}`}>{l.n}★</span>
                        <input
                          className="field"
                          placeholder={`${l.label} — what this looks like here`}
                          value={mLevels[l.n] ?? ''}
                          onChange={(e) => setMLevels({ ...mLevels, [l.n]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button className="btn btn-primary btn-block" onClick={saveComp} disabled={!mName.trim() || !mDesc.trim()}>
                  {modal.mode === 'new' ? 'Add competency' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => { confirm.onYes(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
