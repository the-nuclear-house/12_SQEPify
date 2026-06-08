import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import NuclearisationProcess from '../components/NuclearisationProcess';
import type { Consultant, Role, Assessment, AssessmentRole } from '../lib/types';

const STEPS = ['Set-up', 'Self-assessment', 'Validation', 'Plan', 'Nuclearised'];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Set-up in progress',
  self_assessment: 'With consultant for self-assessment',
  validation: 'Awaiting your validation',
  planning: 'Generating plan',
  plan_review: 'Plan in review',
  delivered: 'Nuclearised',
  cancelled: 'Cancelled',
};

function stepIndex(status: Assessment['status'] | null): number {
  switch (status) {
    case 'self_assessment': return 1;
    case 'validation': return 2;
    case 'planning':
    case 'plan_review': return 3;
    case 'delivered': return 4;
    default: return 0;
  }
}

export default function ConsultantProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalStep, setModalStep] = useState<number | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const [c, r, a] = await Promise.all([
      supabase.from('consultants').select('*').eq('id', id).maybeSingle(),
      supabase.from('roles').select('*').order('is_base', { ascending: false }).order('sort_order').order('name'),
      supabase.from('assessments').select('*').eq('consultant_id', id).neq('status', 'cancelled')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const err = c.error || r.error || a.error;
    if (err) { setError(err.message); setLoading(false); return; }
    setError(null);
    setConsultant((c.data as Consultant) ?? null);
    setRoles((r.data as Role[]) ?? []);
    const asmt = (a.data as Assessment) ?? null;
    setAssessment(asmt);
    if (asmt) {
      const { data: ar } = await supabase.from('assessment_roles').select('*').eq('assessment_id', asmt.id);
      setSelected(((ar as AssessmentRole[]) ?? []).map((x) => x.role_id));
    } else {
      setSelected([]);
    }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const baseRole = useMemo(() => roles.find((r) => r.is_base) ?? null, [roles]);
  const otherRoles = useMemo(() => roles.filter((r) => !r.is_base), [roles]);
  const roleName = (rid: string) => roles.find((r) => r.id === rid)?.name ?? '';
  const name = consultant?.full_name
    || [consultant?.first_name, consultant?.last_name].filter(Boolean).join(' ')
    || consultant?.email
    || 'Consultant';
  const current = stepIndex(assessment?.status ?? null);

  const toggle = (rid: string) =>
    setSelected((s) => (s.includes(rid) ? s.filter((x) => x !== rid) : [...s, rid]));

  async function saveSetup() {
    if (!id) return;
    setSaving(true);
    setError(null);
    let aid = assessment?.id ?? null;
    if (!aid) {
      const { data, error } = await supabase
        .from('assessments')
        .insert({ consultant_id: id, created_by: user?.id ?? null })
        .select('*').single();
      if (error) { setError(error.message); setSaving(false); return; }
      aid = (data as Assessment).id;
      setAssessment(data as Assessment);
    }
    await supabase.from('assessment_roles').delete().eq('assessment_id', aid);
    if (selected.length) {
      const { error } = await supabase.from('assessment_roles')
        .insert(selected.map((role_id) => ({ assessment_id: aid, role_id })));
      if (error) setError(error.message);
    }
    setSaving(false);
    setModalStep(null);
    load();
  }

  if (loading) return <div className="card"><p className="muted" style={{ padding: 16 }}>Loading…</p></div>;
  if (!consultant) return <div className="card"><p className="muted" style={{ padding: 16 }}>Consultant not found. <Link to="/consultants">Back to consultants</Link></p></div>;

  const skills = consultant.engineering_skills ?? [];

  return (
    <div>
      <div className="page-head">
        <Link className="back-link" to="/consultants">← Consultants</Link>
        <h1>{name}</h1>
        <p>{consultant.job_title ? consultant.job_title : 'Consultant'}{consultant.is_active ? '' : ' · Leaver'}</p>
      </div>

      {error && <p className="sync-msg err">{error}</p>}

      <NuclearisationProcess steps={STEPS} current={current} onSelect={(i) => setModalStep(i)} />

      <div className="profile-grid">
        <div className="card">
          <h2 className="panel-title">Details</h2>
          <dl className="info-list">
            <div><dt>Email</dt><dd>{consultant.company_email || consultant.email}</dd></div>
            <div><dt>Technical Director</dt><dd>{consultant.td_full_name || 'Not set'}</dd></div>
            <div><dt>Status</dt><dd>{consultant.is_active ? 'Active' : 'Left'}</dd></div>
            <div><dt>Last synced</dt><dd>{new Date(consultant.last_seen_at).toLocaleDateString('en-GB')}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h2 className="panel-title">Skills</h2>
          <p className="muted card-hint">From the Control Room.</p>
          {skills.length === 0 ? (
            <p className="muted">No skills listed.</p>
          ) : (
            <div className="chip-wrap">
              {skills.map((s, i) => <span className="skill-chip" key={i}>{s}</span>)}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="panel-title">Assessment</h2>
          {!assessment ? (
            <>
              <p className="assess-missing"><span className="dot-missing" />No assessment yet</p>
              <button className="btn btn-primary" onClick={() => setModalStep(0)}>Start assessment</button>
            </>
          ) : (
            <>
              <p className="assess-status">{STATUS_LABEL[assessment.status] ?? assessment.status}</p>
              <p className="muted card-hint">
                Roles: Base Nuclear{selected.length ? ', ' + selected.map(roleName).join(', ') : ''}
              </p>
              <button className="btn btn-sm" onClick={() => setModalStep(0)}>Open set-up</button>
            </>
          )}
        </div>
      </div>

      {/* Set-up modal */}
      {modalStep === 0 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal modal-tall" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Set-up</h2>
              <button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <p className="muted">
                Choose the roles this consultant is assessed against. Base Nuclear always applies; add any
                role-based competencies on top. The CV upload and AI assessment come next.
              </p>
              <div className="role-pick">
                {baseRole && (
                  <label className="role-pick-row locked">
                    <input type="checkbox" checked readOnly />
                    <span className="role-pick-name"><span className="base-tag">BASE</span>{baseRole.name}</span>
                    <span className="role-pick-tag">Always applies</span>
                  </label>
                )}
                {otherRoles.length === 0 && <p className="muted">No role-based roles defined yet.</p>}
                {otherRoles.map((r) => (
                  <label className="role-pick-row" key={r.id}>
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
                    <span className="role-pick-name">{r.name}</span>
                  </label>
                ))}
              </div>
              <button className="btn btn-primary btn-block" onClick={saveSetup} disabled={saving}>
                {saving ? 'Saving…' : assessment ? 'Save roles' : 'Start assessment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder modals for steps still to build */}
      {modalStep !== null && modalStep > 0 && (
        <div className="modal-overlay" onClick={() => setModalStep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{STEPS[modalStep]}</h2>
              <button className="modal-close" onClick={() => setModalStep(null)} aria-label="Close">×</button>
            </div>
            <div className="modal-step">
              <p className="muted">This step is being built next.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
