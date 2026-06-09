import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Consultant } from '../lib/types';

export default function Consultants() {
  const [rows, setRows] = useState<Consultant[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('consultants')
      .select('*')
      .order('is_active', { ascending: false })
      .order('full_name', { ascending: true });
    if (activeOnly) query = query.eq('is_active', true);

    query.then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data as Consultant[]) ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [activeOnly]);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('en-GB') : '';

  return (
    <div>
      <div className="page-head">
        <h1>Consultants</h1>
      </div>

      <div className="toolbar">
        <span className="count">{rows.length} shown</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <span>Active only</span>
        </label>
      </div>

      {loading ? (
        <div className="card"><p className="muted">Loading…</p></div>
      ) : error ? (
        <div className="card"><p className="muted">Could not load consultants: {error}</p></div>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="muted">
            No consultants yet. Run a sync from the System page to pull them from the
            Control Room.
          </p>
        </div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Technical Director</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.is_active ? '' : 'is-left'}>
                  <td>
                    <Link className="row-link" to={`/consultants/${c.id}`}>
                      {c.full_name || '-'}
                    </Link>
                  </td>
                  <td className="mono-cell">{c.company_email || c.email}</td>
                  <td>{c.job_title || '-'}</td>
                  <td>{c.td_full_name || c.td_email || '-'}</td>
                  <td>
                    {c.is_active ? (
                      <span className="badge badge-active">Active</span>
                    ) : (
                      <span className="badge badge-left">Left {fmtDate(c.left_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
