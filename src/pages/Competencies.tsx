import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
} from '../lib/types';

type EditTarget =
  | { kind: 'category' | 'subcategory' | 'competency'; id: string }
  | null;

export default function Competencies() {
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [adder, setAdder] = useState<string | null>(null);
  const [adderText, setAdderText] = useState('');
  const [adderDesc, setAdderDesc] = useState('');

  const [edit, setEdit] = useState<EditTarget>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  async function load() {
    setLoading(true);
    const [c, s, k] = await Promise.all([
      supabase.from('competency_categories').select('*').order('name'),
      supabase.from('competency_subcategories').select('*').order('name'),
      supabase.from('competencies').select('*').order('name'),
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

  function resetAdder() {
    setAdder(null);
    setAdderText('');
    setAdderDesc('');
  }

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) setError(error.message);
    resetAdder();
    setEdit(null);
    load();
  }

  const addCategory = () => {
    if (!newCat.trim()) return;
    run(supabase.from('competency_categories').insert({ name: newCat.trim() }));
    setNewCat('');
  };
  const addSubcategory = (categoryId: string) => {
    if (!adderText.trim()) return;
    run(
      supabase
        .from('competency_subcategories')
        .insert({ category_id: categoryId, name: adderText.trim() }),
    );
  };
  const addCompetency = (categoryId: string, subcategoryId: string | null) => {
    if (!adderText.trim() || !adderDesc.trim()) return;
    run(
      supabase.from('competencies').insert({
        category_id: categoryId,
        subcategory_id: subcategoryId,
        name: adderText.trim(),
        description: adderDesc.trim(),
      }),
    );
  };

  const saveEdit = () => {
    if (!edit || !editName.trim()) return;
    if (edit.kind === 'competency' && !editDesc.trim()) return;
    const table =
      edit.kind === 'category'
        ? 'competency_categories'
        : edit.kind === 'subcategory'
          ? 'competency_subcategories'
          : 'competencies';
    const patch: Record<string, unknown> = { name: editName.trim() };
    if (edit.kind === 'competency') patch.description = editDesc.trim();
    run(supabase.from(table).update(patch).eq('id', edit.id));
  };

  const del = (kind: 'category' | 'subcategory' | 'competency', id: string, warn: string) => {
    if (!window.confirm(warn)) return;
    const table =
      kind === 'category'
        ? 'competency_categories'
        : kind === 'subcategory'
          ? 'competency_subcategories'
          : 'competencies';
    run(supabase.from(table).delete().eq('id', id));
  };

  function startEdit(t: Exclude<EditTarget, null>, name: string, desc?: string) {
    setEdit(t);
    setEditName(name);
    setEditDesc(desc ?? '');
  }

  // Plain render helpers (NOT nested components) so inputs keep focus while typing.
  function competencyRow(c: Competency) {
    const editing = edit?.kind === 'competency' && edit.id === c.id;
    if (editing) {
      return (
        <div className="comp-row editing" key={c.id}>
          <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Competency name" />
          <input className="field" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
          <div className="tree-actions">
            <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={!editName.trim() || !editDesc.trim()}>Save</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="comp-row" key={c.id}>
        <div className="comp-name">
          {c.name}
          {c.description && <span className="comp-desc">{c.description}</span>}
        </div>
        <div className="tree-actions">
          <button className="link-btn" onClick={() => startEdit({ kind: 'competency', id: c.id }, c.name, c.description ?? '')}>Edit</button>
          <button className="link-btn danger" onClick={() => del('competency', c.id, `Delete competency "${c.name}"?`)}>Delete</button>
        </div>
      </div>
    );
  }

  function addCompetencyRow(categoryId: string, subcategoryId: string | null) {
    const token = `comp:${subcategoryId ?? categoryId}`;
    if (adder !== token) {
      return (
        <button className="link-btn add" key={token} onClick={() => { resetAdder(); setAdder(token); }}>+ Add competency</button>
      );
    }
    return (
      <div className="comp-row editing" key={token}>
        <input className="field" value={adderText} onChange={(e) => setAdderText(e.target.value)} placeholder="Competency name" />
        <input className="field" value={adderDesc} onChange={(e) => setAdderDesc(e.target.value)} placeholder="Description" />
        <div className="tree-actions">
          <button className="btn btn-sm btn-primary" onClick={() => addCompetency(categoryId, subcategoryId)} disabled={!adderText.trim() || !adderDesc.trim()}>Add</button>
          <button className="btn btn-sm btn-ghost" onClick={resetAdder}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Nuclear Competencies</h1>
        <p>
          The competency library, organised as Category, then optional Subcategory, then
          Competency. This is the backbone the trainings and assessments hang off.
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
              <div className="card comp-cat" key={cat.id}>
                <div className="comp-cat-head">
                  {catEditing ? (
                    <div className="comp-row editing" style={{ flex: 1 }}>
                      <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                      <div className="tree-actions">
                        <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={!editName.trim()}>Save</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2>{cat.name}</h2>
                      <div className="tree-actions">
                        <button className="link-btn" onClick={() => startEdit({ kind: 'category', id: cat.id }, cat.name)}>Rename</button>
                        <button className="link-btn danger" onClick={() => del('category', cat.id, `Delete category "${cat.name}" and everything under it?`)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>

                {directComps.map((c) => competencyRow(c))}
                {addCompetencyRow(cat.id, null)}

                {catSubs.map((sub) => {
                  const subComps = compsBySub[sub.id] ?? [];
                  const subEditing = edit?.kind === 'subcategory' && edit.id === sub.id;
                  return (
                    <div className="comp-sub" key={sub.id}>
                      <div className="comp-sub-head">
                        {subEditing ? (
                          <div className="comp-row editing" style={{ flex: 1 }}>
                            <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                            <div className="tree-actions">
                              <button className="btn btn-sm btn-primary" onClick={saveEdit} disabled={!editName.trim()}>Save</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="comp-sub-name">{sub.name}</span>
                            <div className="tree-actions">
                              <button className="link-btn" onClick={() => startEdit({ kind: 'subcategory', id: sub.id }, sub.name)}>Rename</button>
                              <button className="link-btn danger" onClick={() => del('subcategory', sub.id, `Delete subcategory "${sub.name}"? Its competencies stay under the category.`)}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                      {subComps.map((c) => competencyRow(c))}
                      {addCompetencyRow(cat.id, sub.id)}
                    </div>
                  );
                })}

                {adder === `sub:${cat.id}` ? (
                  <div className="comp-row editing">
                    <input className="field" value={adderText} onChange={(e) => setAdderText(e.target.value)} placeholder="Subcategory name" />
                    <div className="tree-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => addSubcategory(cat.id)} disabled={!adderText.trim()}>Add</button>
                      <button className="btn btn-sm btn-ghost" onClick={resetAdder}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button className="link-btn add sub" onClick={() => { resetAdder(); setAdder(`sub:${cat.id}`); }}>+ Add subcategory</button>
                )}
              </div>
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
    </div>
  );
}
