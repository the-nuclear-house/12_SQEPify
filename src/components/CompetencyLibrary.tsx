import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import LearningPath from './LearningPath';
import type {
  Competency,
  CompetencyCategory,
  CompetencySubcategory,
} from '../lib/types';

type NodeModal =
  | { kind: 'category'; mode: 'new' }
  | { kind: 'category'; mode: 'edit'; id: string }
  | { kind: 'subcategory'; mode: 'new'; categoryId: string }
  | { kind: 'subcategory'; mode: 'edit'; id: string }
  | null;

type CompModal =
  | { mode: 'new'; subcategoryId: string; categoryId: string }
  | { mode: 'edit'; comp: Competency }
  | null;

export default function CompetencyLibrary() {
  const [cats, setCats] = useState<CompetencyCategory[]>([]);
  const [subs, setSubs] = useState<CompetencySubcategory[]>([]);
  const [comps, setComps] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSub, setActiveSub] = useState<Record<string, string>>({});

  const [nodeModal, setNodeModal] = useState<NodeModal>(null);
  const [nodeName, setNodeName] = useState('');

  const [modal, setModal] = useState<CompModal>(null);
  const [pathComp, setPathComp] = useState<Competency | null>(null);
  const [view, setView] = useState<'category' | 'all'>('category');
  const [mName, setMName] = useState('');
  const [mDesc, setMDesc] = useState('');

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

  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c.name])), [cats]);
  const subById = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s.name])), [subs]);
  const allComps = useMemo(() => [...comps].sort((a, b) => a.name.localeCompare(b.name)), [comps]);

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    if (error) setError(error.message);
    setNodeModal(null);
    setNodeName('');
    setModal(null);
    load();
  }

  // ----- category / subcategory add + edit (all via modal) -----
  function openAddCategory() { setNodeName(''); setNodeModal({ kind: 'category', mode: 'new' }); }
  function openEditCategory(cat: CompetencyCategory) { setNodeName(cat.name); setNodeModal({ kind: 'category', mode: 'edit', id: cat.id }); }
  function openAddSub(categoryId: string) { setNodeName(''); setNodeModal({ kind: 'subcategory', mode: 'new', categoryId }); }
  function openEditSub(sub: CompetencySubcategory) { setNodeName(sub.name); setNodeModal({ kind: 'subcategory', mode: 'edit', id: sub.id }); }

  const saveNode = () => {
    if (!nodeModal || !nodeName.trim()) return;
    const n = nodeName.trim();
    if (nodeModal.kind === 'category') {
      if (nodeModal.mode === 'new') run(supabase.from('competency_categories').insert({ name: n }));
      else run(supabase.from('competency_categories').update({ name: n }).eq('id', nodeModal.id));
    } else {
      if (nodeModal.mode === 'new') run(supabase.from('competency_subcategories').insert({ category_id: nodeModal.categoryId, name: n }));
      else run(supabase.from('competency_subcategories').update({ name: n }).eq('id', nodeModal.id));
    }
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

  // ----- competency add / view / edit -----
  function openNew(categoryId: string, subcategoryId: string) {
    setMName(''); setMDesc('');
    setModal({ mode: 'new', categoryId, subcategoryId });
  }
  function startEditComp(comp: Competency) {
    setMName(comp.name); setMDesc(comp.description ?? '');
    setModal({ mode: 'edit', comp });
  }
  const saveComp = () => {
    if (!modal) return;
    if (!mName.trim() || !mDesc.trim()) return;
    if (modal.mode === 'new') {
      run(supabase.from('competencies').insert({
        category_id: modal.categoryId, subcategory_id: modal.subcategoryId,
        name: mName.trim(), description: mDesc.trim(),
      }));
    } else {
      run(supabase.from('competencies').update({
        name: mName.trim(), description: mDesc.trim(),
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

  const nodeTitle = !nodeModal
    ? ''
    : `${nodeModal.mode === 'new' ? 'Add' : 'Edit'} ${nodeModal.kind === 'category' ? 'category' : 'subcategory'}`;

  return (
    <div>
      <div className="lib-toolbar">
        <div className="view-toggle">
          <button className={view === 'category' ? 'active' : ''} onClick={() => setView('category')}>By category</button>
          <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All competencies</button>
        </div>
        {view === 'category' && <button className="btn btn-primary" onClick={openAddCategory}>+ Add category</button>}
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      {loading ? (
        <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>
      ) : view === 'all' ? (
        allComps.length === 0 ? (
          <div className="card"><p className="muted">No competencies yet.</p></div>
        ) : (
          <div className="comp-grid comp-grid-all">
            {allComps.map((c) => (
              <button className="comp-card" key={c.id} onClick={() => setPathComp(c)} title="Open learning path">
                <span className="c-breadcrumb">{catById[c.category_id]}{c.subcategory_id && subById[c.subcategory_id] ? ` · ${subById[c.subcategory_id]}` : ''}</span>
                <span className="c-name">{c.name}</span>
              </button>
            ))}
          </div>
        )
      ) : cats.length === 0 ? (
        <div className="card"><p className="muted">No categories yet. Use “Add category” to create the first one.</p></div>
      ) : (
        cats.map((cat) => {
          const catSubs = subsByCat[cat.id] ?? [];
          const active = activeSub[cat.id] ?? catSubs[0]?.id ?? null;
          const activeSubObj = catSubs.find((s) => s.id === active) ?? null;
          const activeComps = active ? compsBySub[active] ?? [] : [];
          return (
            <section className="comp-cat" key={cat.id}>
              <header className="comp-cat-head">
                <h2>{cat.name}</h2>
                <div className="tree-actions">
                  <button className="link-btn" onClick={() => openEditCategory(cat)}>Edit</button>
                  <button className="link-btn danger" onClick={() => delNode('category', cat.id, cat.name)}>Delete</button>
                </div>
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
                  <button className="sub-tab add" onClick={() => openAddSub(cat.id)}>+ Subcategory</button>
                </div>

                {activeSubObj ? (
                  <>
                    <div className="sub-bar">
                      <div className="tree-actions">
                        <button className="link-btn" onClick={() => openEditSub(activeSubObj)}>Edit subcategory</button>
                        <button className="link-btn danger" onClick={() => delNode('subcategory', activeSubObj.id, activeSubObj.name)}>Delete subcategory</button>
                      </div>
                    </div>
                    <div className="comp-grid">
                      {activeComps.map((c) => (
                        <button className="comp-card" key={c.id} onClick={() => setPathComp(c)} title="Open learning path">
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
        })
      )}

      {/* category / subcategory add + edit modal */}
      {nodeModal && (
        <div className="modal-overlay" onClick={() => setNodeModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{nodeTitle}</h2>
              <button className="modal-close" onClick={() => setNodeModal(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <label>Name</label>
              <input
                className="field"
                autoFocus
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                placeholder={nodeModal.kind === 'category' ? 'e.g. Nuclear Safety & Culture' : 'e.g. Safety Case'}
                onKeyDown={(e) => { if (e.key === 'Enter' && nodeName.trim()) saveNode(); }}
              />
              <button className="btn btn-primary btn-block" onClick={saveNode} disabled={!nodeName.trim()}>
                {nodeModal.mode === 'new' ? 'Add' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* competency add / edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{modal.mode === 'edit' ? 'Edit competency' : 'Add competency'}</h2>
              <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
            </div>

            <div className="modal-step">
              <label>Name</label>
              <input className="field" value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Competency name" autoFocus />
              <label>Description</label>
              <textarea className="field" rows={2} value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="What this competency covers" />
              <button className="btn btn-primary btn-block" onClick={saveComp} disabled={!mName.trim() || !mDesc.trim()}>
                {modal.mode === 'new' ? 'Add competency' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pathComp && (
        <LearningPath
          competency={pathComp}
          onClose={() => setPathComp(null)}
          onEdit={(c) => { setPathComp(null); startEditComp(c); }}
          onDelete={(c) => { setPathComp(null); deleteComp(c); }}
        />
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
