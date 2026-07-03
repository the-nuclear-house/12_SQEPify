// Supabase Edge Function: competency-suggestion-inbox
//
// Receives competency suggestions pushed from Control Room and stores them in
// public.competency_suggestion_inbox for a SQEPify technical director to review
// (dismiss, or add to the library). This is the reverse direction of the
// competency-feed: Control Room -> SQEPify. The feed still carries the framework
// the other way once a suggestion is added.
//
// Auth: a single shared bearer token, the SAME secret the competency-feed
// validates (COMPETENCY_FEED_TOKEN). Control Room holds the same value as
// SQEPIFY_COMPETENCY_FEED_TOKEN. No Supabase JWT is involved, so deploy this
// function with "Verify JWT" OFF.
//
// Required secrets (set in the dashboard): COMPETENCY_FEED_TOKEN.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const FEED_TOKEN = Deno.env.get('COMPETENCY_FEED_TOKEN');

  // ---- Authorise: the shared feed token, and nothing else ----
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!FEED_TOKEN || token !== FEED_TOKEN) return json({ error: 'Unauthorized' }, 401);

  // ---- Parse and validate the payload ----
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const s = payload?.suggestion;
  if (!s || typeof s !== 'object') return json({ error: 'Missing suggestion object' }, 400);
  if (!s.external_ref || !String(s.external_ref).trim()) return json({ error: 'suggestion.external_ref is required' }, 400);
  if (!s.name || !String(s.name).trim()) return json({ error: 'suggestion.name is required' }, 400);

  // external_ref keys the row: a re-send with the same ref updates rather than
  // duplicates. status is deliberately left out of the write, so a first arrival
  // gets the table default 'pending' and a re-send never resurrects a decision a
  // reviewer has already made (dismissed / added).
  const row = {
    external_ref: String(s.external_ref).trim(),
    source: payload.source ? String(payload.source) : 'control_room',
    origin_type: s.origin_type ?? null,
    origin_id: s.origin_id != null ? String(s.origin_id) : null,
    origin_label: s.origin_label ?? null,
    name: String(s.name).trim(),
    category: s.category ?? null,
    description: s.description ?? null,
    rationale: s.rationale ?? null,
    submitted_by_name: s.submitted_by_name ?? null,
    submitted_by_email: s.submitted_by_email ?? null,
    submitted_at: s.submitted_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from('competency_suggestion_inbox')
    .upsert(row, { onConflict: 'external_ref' })
    .select('id, status')
    .single();
  if (error) return json({ error: 'Inbox write failed', detail: error.message }, 500);

  return json({ ok: true, id: data?.id ?? null, status: data?.status ?? null, external_ref: row.external_ref });
});
