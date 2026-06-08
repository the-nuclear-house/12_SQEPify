import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';

interface SyncResult {
  ok?: boolean;
  pulled?: number;
  marked_left?: number;
  feed_synced_at?: string | null;
  ran_at?: string;
  error?: string;
  detail?: string;
}

export default function System() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function syncNow() {
    setRunning(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('sync-consultants', {
      method: 'POST',
    });
    if (error) setResult({ error: error.message });
    else setResult(data as SyncResult);
    setRunning(false);
  }

  return (
    <div>
      <div className="page-head">
        <h1>System</h1>
        <p>
          Administration. Microsoft 365 handles sign in; this is where the consultant
          data is refreshed and, later, users and roles are managed.
        </p>
      </div>

      <Card title="Control Room sync">
        <p className="muted">
          Pull the latest active consultants from the Control Room into SQEPify.
          Consultants who have left the Control Room are kept here as history and
          marked inactive.
        </p>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={syncNow} disabled={running}>
            {running ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        {result && !result.error && (
          <p className="sync-msg ok">
            Pulled {result.pulled} active, marked {result.marked_left} as left.
            {result.ran_at ? ` At ${new Date(result.ran_at).toLocaleString('en-GB')}.` : ''}
          </p>
        )}
        {result?.error && (
          <p className="sync-msg err">
            Sync failed: {result.error}
            {result.detail ? ` (${result.detail})` : ''}
          </p>
        )}
      </Card>

      <Card title="User management">
        <p className="muted">
          Creating users and assigning roles through this screen comes in a later step.
          For now, users are seeded directly in the database, as recorded in the
          changelog.
        </p>
        <span className="stub-note">build order, later step</span>
      </Card>
    </div>
  );
}
