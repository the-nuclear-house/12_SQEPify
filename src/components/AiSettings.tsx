import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/*
 * AI model settings (superadmin, System page). Reads/writes the app_settings
 * key/value rows the shared AI client uses: ai_primary_provider (anthropic|openai),
 * ai_model_anthropic, ai_model_openai. Model strings are free text because they
 * change often and only work if the corresponding API key has access. Primary is
 * tried first; the client fails over to the other provider automatically.
 */
const KEYS = ['ai_primary_provider', 'ai_model_anthropic', 'ai_model_openai'];

export default function AiSettings() {
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [anthropicModel, setAnthropicModel] = useState('');
  const [openaiModel, setOpenaiModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from('app_settings').select('key, value').in('key', KEYS);
    if (error) { setError(error.message); setLoading(false); return; }
    const m = Object.fromEntries(((data as { key: string; value: string }[]) ?? []).map((r) => [r.key, r.value]));
    if (m.ai_primary_provider === 'openai' || m.ai_primary_provider === 'anthropic') setProvider(m.ai_primary_provider);
    setAnthropicModel(m.ai_model_anthropic ?? 'claude-sonnet-4-6');
    setOpenaiModel(m.ai_model_openai ?? 'gpt-4o');
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true); setError(null); setMsg(null);
    const now = new Date().toISOString();
    const rows = [
      { key: 'ai_primary_provider', value: provider, updated_at: now },
      { key: 'ai_model_anthropic', value: anthropicModel.trim(), updated_at: now },
      { key: 'ai_model_openai', value: openaiModel.trim(), updated_at: now },
    ];
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) setError(error.message); else setMsg('Saved.');
    setSaving(false);
  }

  return (
    <div className="card">
      <h2 className="panel-title">AI model</h2>
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <label>Primary provider</label>
          <div className="status-toggle">
            <button type="button" className={provider === 'anthropic' ? 'active' : ''} onClick={() => setProvider('anthropic')}>Anthropic</button>
            <button type="button" className={provider === 'openai' ? 'active' : ''} onClick={() => setProvider('openai')}>OpenAI</button>
          </div>
          <p className="muted card-hint">Primary is tried first; the other is the automatic fallback.</p>

          <label>Anthropic model</label>
          <input className="field" value={anthropicModel} onChange={(e) => setAnthropicModel(e.target.value)} placeholder="claude-sonnet-4-6" />

          <label>OpenAI model</label>
          <input className="field" value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} placeholder="gpt-4o" />

          {error && <p className="sync-msg err">{error}</p>}
          {msg && <p className="sync-msg ok">{msg}</p>}

          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>
      )}
    </div>
  );
}
