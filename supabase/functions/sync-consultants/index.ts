// Supabase Edge Function: sync-consultants
//
// Pulls active consultants from the Control Room read-only feed and refreshes
// SQEPify's local cache (public.consultants). Leavers are detected by absence and
// kept as history (marked inactive with a left date), never deleted.
//
// Auth: callable by a SQEPify superadmin (via the app, with their session token) or
// by the service role (for the scheduled run). No one else.
//
// Required secrets (set in the dashboard): CONTROL_ROOM_FEED_URL, CONTROL_ROOM_FEED_TOKEN.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const FEED_URL = Deno.env.get('CONTROL_ROOM_FEED_URL');
  const FEED_TOKEN = Deno.env.get('CONTROL_ROOM_FEED_TOKEN');

  if (!FEED_URL || !FEED_TOKEN) {
    return json({ error: 'Feed not configured (set CONTROL_ROOM_FEED_URL and CONTROL_ROOM_FEED_TOKEN)' }, 500);
  }

  // ---- Authorise the caller: superadmin user, or the service role (cron) ----
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  let authorised = false;
  if (token && token === SERVICE) {
    authorised = true; // scheduled / system call
  } else if (token) {
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user?.email) {
      const { data: row } = await admin
        .from('users')
        .select('product_role, is_active')
        .ilike('email', user.email)
        .maybeSingle();
      authorised = row?.product_role === 'superadmin' && row?.is_active === true;
    }
  }
  if (!authorised) return json({ error: 'Forbidden' }, 403);

  // ---- Pull the feed ----
  let feed: { consultants?: unknown[]; synced_at?: string };
  try {
    const res = await fetch(FEED_URL, { method: 'GET', headers: { 'x-feed-token': FEED_TOKEN } });
    if (!res.ok) {
      const text = await res.text();
      return json({ error: `Feed returned ${res.status}`, detail: text.slice(0, 500) }, 502);
    }
    feed = await res.json();
  } catch (e) {
    return json({ error: 'Could not reach the feed', detail: String(e) }, 502);
  }

  const list = Array.isArray(feed.consultants) ? feed.consultants : [];
  const ranAt = new Date().toISOString();

  // ---- Map tolerantly, keyed off id ----
  type Row = Record<string, unknown>;
  const rows = list
    .map((c) => c as Row)
    .filter((c) => typeof c.id === 'string' && c.id)
    .map((c) => {
      const td = (c.technical_director ?? null) as Row | null;
      return {
        id: c.id as string,
        full_name: (c.full_name ?? null) as string | null,
        first_name: (c.first_name ?? null) as string | null,
        last_name: (c.last_name ?? null) as string | null,
        email: (c.email ?? '') as string,
        company_email: (c.company_email ?? null) as string | null,
        job_title: (c.job_title ?? null) as string | null,
        status: (c.status ?? null) as string | null,
        engineering_skills: Array.isArray(c.engineering_skills) ? (c.engineering_skills as string[]) : [],
        td_id: (td?.id ?? null) as string | null,
        td_full_name: (td?.full_name ?? null) as string | null,
        td_email: (td?.email ?? null) as string | null,
        is_active: true,
        last_seen_at: ranAt,
        left_at: null,
        updated_at: ranAt,
      };
    });

  // ---- Upsert the present consultants ----
  if (rows.length > 0) {
    const { error } = await admin.from('consultants').upsert(rows, { onConflict: 'id' });
    if (error) return json({ error: 'Upsert failed', detail: error.message }, 500);
  }

  // ---- Mark anyone not seen this run as a leaver (kept as history) ----
  const { data: left, error: leftErr } = await admin
    .from('consultants')
    .update({ is_active: false, left_at: ranAt })
    .eq('is_active', true)
    .lt('last_seen_at', ranAt)
    .select('id');
  if (leftErr) return json({ error: 'Leaver update failed', detail: leftErr.message }, 500);

  // Provision SQEPify logins for active consultants (by company email) and switch off
  // the logins of those who have left. Best effort; does not fail the sync.
  await admin.rpc('reconcile_consultant_users');

  // Record this successful run so the app can show when the last pull happened
  // (covers both manual and scheduled runs). Best effort; do not fail the sync if it errors.
  await admin.from('sync_state').upsert(
    {
      id: true,
      last_sync_at: ranAt,
      last_pulled: rows.length,
      last_marked_left: left?.length ?? 0,
      updated_at: ranAt,
    },
    { onConflict: 'id' },
  );

  return json({
    ok: true,
    pulled: rows.length,
    marked_left: left?.length ?? 0,
    feed_synced_at: feed.synced_at ?? null,
    ran_at: ranAt,
  });
});
