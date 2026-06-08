import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
} from '../lib/types';

type EditNode = { kind: 'category' | 'subcategory'; id: string } | null;

type CompModal =
  | { mode: 'new'; categoryId: string; subcategoryId: string | null }
  | { mode: 'view'; comp: Competency }
  | { mode: 'edit'; comp: Competency }
  | null;

export default function Competencies() {
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [subText, setSubText] = useState('');

  const [edit, setEdit] = useState<EditNode>(null);
  const [editName, setEditName] = useState('');

  const [modal, setModal] = useState<CompModal>(null);
  const [mName, setMName] = useState('');
  const [mDesc, setMDesc] = useState('');

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
      const key = c.subcategory_id ?? `cat:${c.category_id}`;
      (m[key] ??= []).push(c);
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
  const delNode = (kind: 'category' | 'subcategory', id: string, warn: string) => {
    if (!window.confirm(warn)) return;
    const table = kind === 'category' ? 'competency_categories' : 'competency_subcategories';
    run(supabase.from(table).delete().eq('id', id));
  };

  function openNew(categoryId: string, subcategoryId: string | null) {
    setMName('');
    setMDesc('');
    setModal({ mode: 'new', categoryId, subcategoryId });
  }
  function openView(comp: Competency) {
    setModal({ mode: 'view', comp });
  }
  function startEditComp(comp: Competency) {
    setMName(comp.name);
    setMDesc(comp.description ?? '');
    setModal({ mode: 'edit', comp });
  }
  const saveComp = () => {
    if (!modal || modal.mode === 'view') return;
    if (!mName.trim() || !mDesc.trim()) return;
    if (modal.mode === 'new') {
      run(
        supabase.from('competencies').insert({
          category_id: modal.categoryId,
          subcategory_id: modal.subcategoryId,
          name: mName.trim(),
          description: mDesc.trim(),
        }),
      );
    } else {
      run(
        supabase
          .from('competencies')
          .update({ name: mName.trim(), description: mDesc.trim() })
          .eq('id', modal.comp.id),
      );
    }
  };
  const deleteComp = (comp: Competency) => {
    if (!window.confirm(`Delete competency "${comp.name}"?`)) return;
    run(supabase.from('competencies').delete().eq('id', comp.id));
  };

  function competencyGrid(list: Competency[], categoryId: string, subcategoryId: string | null) {
    return (
      <div className="comp-grid">
        {list.map((c) => (
          <button className="comp-card" key={c.id} onClick={() => openView(c)} title="View details">
            <span className="c-name">{c.name}</span>
          </button>
        ))}
        <button className="comp-card comp-add" onClick={() => openNew(categoryId, subcategoryId)}>
          <span className="plus">+</span>
          <span>Add competency</span>
        </button>
      </div>
    );
  }

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
          The competency library, organised as Category, then optional Subcategory, then
          Competency. Click a competency to see its detail.
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
            const directComps = compsBySub[`cat:${cat.id}`] ?? [];
            const catEditing = edit?.kind === 'category' && edit.id === cat.id;
            return (
              <section className="comp-cat" key={cat.id}>
                <header className="comp-cat-head">
                  {catEditing ? renameRow : (
                    <>
                      <h2>{cat.name}</h2>
                      <div className="tree-actions">
                        <button className="link-btn" onClick={() => { setEdit({ kind: 'category', id: cat.id }); setEditName(cat.name); }}>Rename</button>
                        <button className="link-btn danger" onClick={() => delNode('category', cat.id, `Delete category "${cat.name}" and everything under it?`)}>Delete</button>
                      </div>
                    </>
                  )}
                </header>

                <div className="comp-cat-body">
                  {competencyGrid(directComps, cat.id, null)}

                  {catSubs.map((sub) => {
                    const subComps = compsBySub[sub.id] ?? [];
                    const subEditing = edit?.kind === 'subcategory' && edit.id === sub.id;
                    return (
                      <div className="comp-sub" key={sub.id}>
                        <div className="comp-sub-head">
                          {subEditing ? renameRow : (
                            <>
                              <span className="comp-sub-name"><span className="sub-tag">Subcategory</span>{sub.name}</span>
                              <div className="tree-actions">
                                <button className="link-btn" onClick={() => { setEdit({ kind: 'subcategory', id: sub.id }); setEditName(sub.name); }}>Rename</button>
                                <button className="link-btn danger" onClick={() => delNode('subcategory', sub.id, `Delete subcategory "${sub.name}"? Its competencies stay under the category.`)}>Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                        {competencyGrid(subComps, cat.id, sub.id)}
                      </div>
                    );
                  })}

                  {addingSubFor === cat.id ? (
                    <div className="rename-row sub-add">
                      <input className="field" value={subText} onChange={(e) => setSubText(e.target.value)} placeholder="Subcategory name" autoFocus />
                      <button className="btn btn-sm btn-primary" onClick={() => addSubcategory(cat.id)} disabled={!subText.trim()}>Add</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => { setAddingSubFor(null); setSubText(''); }}>Cancel</button>
                    </div>
                  ) : (
                    <button className="link-btn add sub" onClick={() => { setAddingSubFor(cat.id); setSubText(''); }}>+ Add subcategory</button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'view' ? modal.comp.name : modal.mode === 'edit' ? 'Edit competency' : 'Add competency'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>

            {modal.mode === 'view' ? (
              <div className="modal-body">
                <p className="comp-modal-desc">{modal.comp.description || 'No description.'}</p>
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
                <textarea className="field" rows={3} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="What this competency covers" />
                <button className="btn btn-primary btn-block" onClick={saveComp} disabled={!mName.trim() || !mDesc.trim()}>
                  {modal.mode === 'new' ? 'Add competency' : 'Save changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
