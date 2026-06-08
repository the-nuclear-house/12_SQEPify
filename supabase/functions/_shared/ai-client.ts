// =============================================================================
// CANONICAL AI CLIENT  —  reference copy
// =============================================================================
// Single source of truth for how every AI edge function talks to an LLM
// provider. Self-contained so it can be pasted into a Supabase edge function
// via the dashboard (this project does not deploy edge functions via the CLI).
//
// USAGE in an edge function:
//   const { text, provider } = await callAI({ prompt, maxTokens: 4000 })
//   // image task:
//   const { text } = await callAI({ prompt, images: [{ media_type, data }] })
//   // raw PDF file task (routes to Anthropic, the only provider that takes a
//   // PDF file directly):
//   const { text } = await callAI({ prompt, pdf: { data } })
//
// callAI reads three settings from the app_settings table in a single REST
// call at the start of every AI call:
//
//   ai_primary_provider   'anthropic' | 'openai' — which provider leads
//   ai_model_anthropic    the Claude model string (e.g. 'claude-sonnet-4-6')
//   ai_model_openai       the OpenAI model string (e.g. 'gpt-4o')
//
// The superadmin manages all three from the Settings page. When a provider
// deprecates a model, no code change is needed — the superadmin updates the
// model string. callAI tries the primary provider, falls over to the other
// on a transient error (timeout / 429 / 5xx / network blip).
//
// WHEN THIS BLOCK CHANGES: update this file FIRST, then re-paste the block
// into every AI edge function. The list is in _shared/README.md.
// =============================================================================

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
