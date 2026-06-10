// =============================================================================
// EDGE FUNCTION: plan-summary
// =============================================================================
// Input  (POST JSON): {
//   consultant_name: string, horizon_months: number,
//   competencies: [{ name, category, current, required }],   // current vs required levels
//   steps: [{ competency, training, to_level, month }]        // the deterministic roadmap
// }
// Output (JSON): { summary: string, provider }
//   A short, client-facing narrative of where the consultant stands and how the
//   plan invests time to bring them to the required level. British English.
//
// Gated to technical_director and superadmin (matched by email).
// Deploy by pasting this whole file into a new Supabase edge function named plan-summary.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------------------------------------------------------------------------
// BEGIN canonical AI client (verbatim copy of _shared/ai-client.ts)
// ---------------------------------------------------------------------------
type AIProvider = 'anthropic' | 'openai'
interface AIImage { media_type: string; data: string }
interface AIPdfFile { data: string }
interface CallAIOptions { prompt: string; images?: AIImage[]; pdf?: AIPdfFile; maxTokens?: number }
interface AIResult { text: string; provider: AIProvider }
interface AISettings { primary: AIProvider; modelAnthropic: string; modelOpenAI: string }

const AI_TIMEOUT_MS = 90_000

// Sane fallbacks if the settings table can't be read for any reason — the tool
// keeps working with current models rather than dying on a missing row.
const DEFAULT_MODEL_ANTHROPIC = 'claude-sonnet-4-6'
const DEFAULT_MODEL_OPENAI = 'gpt-4o'

/**
 * Read all three AI-related settings (primary provider + the two model
 * strings) in a single REST call. Falling back to sensible defaults if the
 * table can't be read keeps the tool working even when something is mis-
 * configured.
 */
async function getAISettings(): Promise<AISettings> {
  const fallback: AISettings = {
    primary: 'anthropic',
    modelAnthropic: DEFAULT_MODEL_ANTHROPIC,
    modelOpenAI: DEFAULT_MODEL_OPENAI,
  }
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) return fallback
    const res = await fetch(
      `${url}/rest/v1/app_settings?key=in.(ai_primary_provider,ai_model_anthropic,ai_model_openai)&select=key,value`,
      { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } },
    )
    if (!res.ok) return fallback
    const rows = await res.json() as Array<{ key: string; value: unknown }>
    const out = { ...fallback }
    for (const r of rows) {
      if (r.key === 'ai_primary_provider' && r.value === 'openai') out.primary = 'openai'
      if (r.key === 'ai_primary_provider' && r.value === 'anthropic') out.primary = 'anthropic'
      if (r.key === 'ai_model_anthropic' && typeof r.value === 'string' && r.value.trim()) out.modelAnthropic = r.value
      if (r.key === 'ai_model_openai' && typeof r.value === 'string' && r.value.trim()) out.modelOpenAI = r.value
    }
    return out
  } catch {
    return fallback
  }
}

async function callAnthropic(opts: CallAIOptions, model: string): Promise<string> {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')
  const content: any[] = []
  if (opts.pdf) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.pdf.data } })
  for (const img of opts.images || []) content.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })
  content.push({ type: 'text', text: opts.prompt })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4000,
        messages: [{ role: 'user', content: content.length === 1 ? opts.prompt : content }],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const err = new Error(body?.error?.message || `Anthropic ${res.status}`) as any
      err.status = res.status; throw err
    }
    const data = await res.json()
    const text = (data.content || []).map((c: any) => c.text || '').join('').trim()
    if (!text) throw new Error('Anthropic returned an empty response')
    return text
  } finally { clearTimeout(timer) }
}

async function callOpenAI(opts: CallAIOptions, model: string): Promise<string> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) throw new Error('OPENAI_API_KEY not configured')
  if (opts.pdf) { const err = new Error('OpenAI cannot process raw PDF files') as any; err.status = 400; err.noFailover = true; throw err }
  let content: any
  if (opts.images && opts.images.length > 0) {
    content = [{ type: 'text', text: opts.prompt },
      ...opts.images.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.media_type};base64,${img.data}` } }))]
  } else { content = opts.prompt }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 4000, messages: [{ role: 'user', content }] }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const err = new Error(body?.error?.message || `OpenAI ${res.status}`) as any
      err.status = res.status; throw err
    }
    const data = await res.json()
    const text = (data.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('OpenAI returned an empty response')
    return text
  } finally { clearTimeout(timer) }
}

function shouldFailover(error: any): boolean {
  if (error?.noFailover) return false
  if (error?.name === 'AbortError') return true
  const status = error?.status
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500 && status < 600) return true
  if (error?.message?.includes('fetch failed')) return true
  if (error?.message?.includes('empty response')) return true
  return false
}

async function callAI(opts: CallAIOptions): Promise<AIResult> {
  const settings = await getAISettings()
  const modelFor: Record<AIProvider, string> = { anthropic: settings.modelAnthropic, openai: settings.modelOpenAI }
  const callers: Record<AIProvider, (o: CallAIOptions, model: string) => Promise<string>> = {
    anthropic: callAnthropic,
    openai: callOpenAI,
  }
  if (opts.pdf) {
    console.log(`[ai-client] raw PDF task — routing to anthropic (${modelFor.anthropic})`)
    const text = await callAnthropic(opts, modelFor.anthropic)
    return { text, provider: 'anthropic' }
  }
  const primary = settings.primary
  const secondary: AIProvider = primary === 'anthropic' ? 'openai' : 'anthropic'
  const chain: AIProvider[] = [primary, secondary]
  let lastError: any = null
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]
    try {
      console.log(`[ai-client] trying ${provider} (${modelFor[provider]})${i > 0 ? ' [failover]' : ' [primary]'}`)
      const text = await callers[provider](opts, modelFor[provider])
      console.log(`[ai-client] success with ${provider}`)
      return { text, provider }
    } catch (err: any) {
      lastError = err
      console.error(`[ai-client] ${provider} failed — ${err?.message || err}`)
      if (i < chain.length - 1 && shouldFailover(err)) { console.log(`[ai-client] failing over to ${chain[i + 1]}`); continue }
      throw err
    }
  }
  throw lastError || new Error('All AI providers failed')
}
// ---------------------------------------------------------------------------
// END canonical AI client
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOWED_ROLES = ['technical_director', 'superadmin']

async function requireStaff(req: Request): Promise<{ ok: boolean; status?: number; message?: string }> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return { ok: false, status: 401, message: 'Missing auth token' }
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE } })
  if (!userRes.ok) return { ok: false, status: 401, message: 'Invalid or expired session' }
  const authUser = await userRes.json()
  const email = authUser?.email
  if (!email) return { ok: false, status: 401, message: 'No email on session' }
  const roleRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=product_role,is_active`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  )
  if (!roleRes.ok) return { ok: false, status: 500, message: 'Could not read user role' }
  const rows = await roleRes.json() as Array<{ product_role: string; is_active: boolean }>
  const u = rows[0]
  if (!u || !u.is_active || !ALLOWED_ROLES.includes(u.product_role)) return { ok: false, status: 403, message: 'Not permitted' }
  return { ok: true }
}

const LEVELS: Record<number, string> = { 0: 'not assessed', 1: 'No knowledge', 2: 'Awareness', 3: 'Basic competence', 4: 'Full competence (SQEP)', 5: 'Expert' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const gate = await requireStaff(req)
  if (!gate.ok) return new Response(JSON.stringify({ error: gate.message ?? 'Not permitted' }), { status: gate.status ?? 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

  const name = String(body?.consultant_name ?? 'The consultant')
  const horizon = Number(body?.horizon_months ?? 18)
  const comps = Array.isArray(body?.competencies) ? body.competencies : []
  const steps = Array.isArray(body?.steps) ? body.steps : []
  if (comps.length === 0) return new Response(JSON.stringify({ error: 'Missing competencies' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const atReq = comps.filter((c: any) => c.required > 0 && c.current >= c.required).length
  const gaps = comps.filter((c: any) => c.required > 0 && c.current < c.required)
    .sort((a: any, b: any) => (b.required - b.current) - (a.required - a.current))
  const gapLines = gaps.map((c: any) => `- ${c.name} (${c.category}): now ${LEVELS[c.current] ?? c.current}, needs ${LEVELS[c.required] ?? c.required}`).join('\n')
  const stepLines = steps.map((s: any) => `- ${s.competency}: ${s.training} -> level ${s.to_level}, around month ${s.month}`).join('\n')

  const prompt = `You are writing a short, professional brief for a UK nuclear consultancy (The Nuclear House) to send to a client about an upskilling plan for one of their consultants. Write in British English, understated and factual, no hype, no em-dashes. 3 to 5 sentences, plain prose, no headings or bullet points.

Cover: where ${name} stands now overall, the main areas needing investment to reach the required level, and how the plan develops them step by step over the ${horizon}-month horizon. Refer to levels by name (Awareness, Basic competence, Full competence (SQEP), Expert), not numbers.

${name}: ${atReq} of ${comps.length} competencies already at the required level.

Competencies below the required level (biggest gap first):
${gapLines || '(none)'}

Planned development steps:
${stepLines || '(none)'}

Write only the brief itself, nothing else.`

  try {
    const { text, provider } = await callAI({ prompt, maxTokens: 600 })
    return new Response(JSON.stringify({ summary: text, provider }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? 'AI call failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
