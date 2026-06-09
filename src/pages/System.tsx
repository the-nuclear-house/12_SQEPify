import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import UserManagement from '../components/UserManagement';

interface SyncResult {
  ok?: boolean;
  pulled?: number;
  marked_left?: number;
  ran_at?: string;
  error?: string;
}

interface SyncState {
  last_sync_at: string | null;
  last_pulled: number | null;
  last_marked_left: number | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function System() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSync, setLastSync] = useState<SyncState | null>(null);

  async function loadLastSync() {
    const { data } = await supabase
      .from('sync_state')
      .select('last_sync_at, last_pulled, last_marked_left')
      .maybeSingle();
    if (data) setLastSync(data as SyncState);
  }

  useEffect(() => {
    loadLastSync();
  }, []);

  async function syncNow() {
    setRunning(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke('sync-consultants', {
      method: 'POST',
    });

    if (error) {
      let detail = error.message;
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx && typeof ctx.text === 'function') {
        try {
          const raw = await ctx.text();
          try {
            const body = JSON.parse(raw);
            detail = body.error
              ? body.detail
                ? `${body.error}: ${body.detail}`
                : body.error
              : raw;
          } catch {
            detail = raw || error.message;
          }
        } catch {
          /* keep the generic message */
        }
      }
      setResult({ error: detail });
    } else {
      setResult(data as SyncResult);
      loadLastSync();
    }
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
          marked inactive. This also runs on a schedule twice a day.
        </p>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={syncNow} disabled={running}>
            {running ? 'Syncing…' : 'Sync now'}
          </button>
        </div>

        <p className="last-sync">
          {lastSync?.last_sync_at
            ? `Last successful pull: ${formatWhen(lastSync.last_sync_at)} (${lastSync.last_pulled ?? 0} active)`
            : 'No successful pull recorded yet.'}
        </p>

        {result && !result.error && (
          <p className="sync-msg ok">
            Pulled {result.pulled} active, marked {result.marked_left} as left.
          </p>
        )}
        {result?.error && <p className="sync-msg err">Sync failed: {result.error}</p>}
      </Card>

      <UserManagement />
    </div>
  );
}
