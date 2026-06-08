// =============================================================================
// EDGE FUNCTION: parse-cv-nuclear
// =============================================================================
// Input  (POST JSON): { competencies: [{ id, name, category?, subcategory? }],
//                       and ONE of: file_base64 + media_type | text | url }
//          - file_base64 is the uploaded file as base64 (no data: prefix); PDF, Word (.docx)
//            and images (jpeg/png/gif/webp) are supported. text is a pasted CV. url is a link.
//            or text extracted from a .docx in the browser via mammoth).
// Output (JSON): { results: [{ competency_id, level, evidence }], provider }
//          - level is 1..5 on SQEPify's scale. Only competencies the CV evidences are returned.
//
// Gated to technical_director and superadmin (matched by email, the app's identity).
// Embeds the canonical AI client verbatim (see supabase/functions/_shared/ai-client.ts).
// Deploy by pasting this whole file into a new Supabase edge function named parse-cv-nuclear.
// =============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as mammoth from 'npm:mammoth@1.6.0'

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

// Verify the caller and check their role by email (the app's identity model).
async function requireStaff(req: Request): Promise<{ ok: boolean; status?: number; message?: string }> {
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return { ok: false, status: 401, message: 'Missing auth token' }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE_ROLE },
  })
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
  if (!u || !u.is_active || !ALLOWED_ROLES.includes(u.product_role)) {
    return { ok: false, status: 403, message: 'Not permitted' }
  }
  return { ok: true }
}

const LEVEL_GUIDE = `SQEPify uses a 1 to 5 star scale:
1 = No knowledge
2 = Awareness (general knowledge of the topic)
3 = Basic competence (can apply it under supervision)
4 = Full competence / SQEP (works independently to good practice)
5 = Expert (can design, adapt and coach others)`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const gate = await requireStaff(req)
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.message ?? 'Not permitted' }), { status: gate.status ?? 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

  const competencies = Array.isArray(body?.competencies) ? body.competencies : []
  if (competencies.length === 0) return new Response(JSON.stringify({ error: 'Missing competencies' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const { text, file_base64, media_type, url } = body || {}
  if (!text && !file_base64 && !url) {
    return new Response(JSON.stringify({ error: 'Provide a CV file, text, or a URL to parse' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  // Build the CV content (proven dispatch from the Control Room's parse-requirement).
  let extractedText = ''
  let pdf: { data: string } | undefined
  let images: { media_type: string; data: string }[] | undefined
  try {
    if (url) {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      if (!pageResponse.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch URL: ${pageResponse.status} ${pageResponse.statusText}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const html = await pageResponse.text()
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15000)
      if (textContent.length < 50) {
        return new Response(JSON.stringify({ error: 'Could not extract meaningful content from the URL. The page may require login or JavaScript rendering.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      extractedText = `Content from ${url}:\n\n${textContent}`
    } else if (file_base64 && media_type) {
      const isDocx = media_type.includes('wordprocessingml') || media_type.includes('msword')
      const isPdf = media_type === 'application/pdf'
      const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(media_type)
      if (isDocx) {
        const buffer = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0))
        const result = await mammoth.convertToHtml({ buffer })
        const plain = String(result.value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        extractedText = `CV (Word document):\n\n${plain}`
      } else if (isPdf) {
        pdf = { data: file_base64 }
      } else if (isImage) {
        images = [{ media_type, data: file_base64 }]
      } else {
        return new Response(JSON.stringify({ error: 'Unsupported file type. Upload a PDF, Word document, or image, or paste the CV text.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    } else if (text) {
      extractedText = `CV:\n\n${String(text)}`
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `Could not read the CV: ${err?.message || err}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const list = competencies.map((c: any) => `- ${c.id} | ${[c.category, c.subcategory, c.name].filter(Boolean).join(' / ')}`).join('\n')

  const prompt = `You are assessing a nuclear engineering consultant's CV against a fixed competency library.

${LEVEL_GUIDE}

The competency library (id | path):
${list}

Task: read the CV provided and, ONLY for competencies the CV genuinely evidences, estimate the level (1 to 5) the CV supports, with a one-line justification quoting or paraphrasing the relevant CV detail. Do not include competencies with no evidence. Do not recommend training or next steps. Be conservative: if the CV does not clearly support a level, do not inflate it.

Return JSON only, no markdown and no preamble, in exactly this shape:
{"results":[{"competency_id":"<id from the library>","level":<1-5>,"evidence":"<short justification>"}]}
${extractedText ? `\n${extractedText}` : ''}`

  const callOpts: any = { prompt, maxTokens: 4000 }
  if (pdf) callOpts.pdf = pdf
  if (images) callOpts.images = images

  let aiText: string
  let provider: string
  try {
    const r = await callAI(callOpts)
    aiText = r.text; provider = r.provider
  } catch (err: any) {
    return new Response(JSON.stringify({ error: `AI call failed: ${err?.message || err}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const cleaned = aiText.replace(/```json/gi, '').replace(/```/g, '').trim()
  let parsed: any
  try { parsed = JSON.parse(cleaned) } catch {
    return new Response(JSON.stringify({ error: 'Model did not return valid JSON' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const results = Array.isArray(parsed?.results) ? parsed.results : []
  return new Response(JSON.stringify({ results, provider }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
