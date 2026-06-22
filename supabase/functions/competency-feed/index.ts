import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FEED_TOKEN = Deno.env.get('FEED_TOKEN')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
const SCALE = [
  { level: 1, name: 'No knowledge' }, { level: 2, name: 'Awareness' }, { level: 3, name: 'Basic competence' },
  { level: 4, name: 'Full competence (SQEP)' }, { level: 5, name: 'Expert' },
]
async function rest(path: string) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: { apikey: SR, Authorization: `Bearer ${SR}` } })
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`)
  return r.json()
}
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!FEED_TOKEN || token !== FEED_TOKEN) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const cats = await rest('competency_categories?select=name,sort_order&order=sort_order')
    const comps = await rest('competencies?select=code,name,description,sort_order,category:competency_categories(name),subcategory:competency_subcategories(name)&order=sort_order')
    const roles = await rest('roles?select=code,name,is_base,sort_order,role_competencies(required_level,competency:competencies(code))&order=sort_order')
    const body = {
      generated_at: new Date().toISOString(),
      scale: SCALE,
      categories: cats.map((c: any) => ({ name: c.name, sort_order: c.sort_order })),
      competencies: comps.map((c: any) => ({ code: c.code, name: c.name, description: c.description, sort_order: c.sort_order, category: c.category?.name ?? null, subcategory: c.subcategory?.name ?? null })),
      roles: roles.map((r: any) => ({ code: r.code, name: r.name, is_base: r.is_base, sort_order: r.sort_order, competencies: (r.role_competencies ?? []).map((rc: any) => ({ competency_code: rc.competency?.code ?? null, required_level: rc.required_level })) })),
    }
    return new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
