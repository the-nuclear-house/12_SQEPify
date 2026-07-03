import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const URL = Deno.env.get('SUPABASE_URL')!
const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FEED_TOKEN = Deno.env.get('COMPETENCY_FEED_TOKEN')!
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
    const comps = await rest('competencies?select=id,code,name,description,sort_order,category:competency_categories(name),subcategory:competency_subcategories(name)&order=sort_order')
    const roles = await rest('roles?select=code,name,is_base,sort_order,role_competencies(required_level,competency:competencies(code))&order=sort_order')

    // What happened to each proposal Control Room sent us: added (with the code of the
    // competency it became) or dismissed. Built from the review inbox. Kept deliberately
    // tolerant: if the inbox cannot be read, the core framework feed must still serve, so
    // we fall back to an empty list rather than failing the whole request.
    const codeById: Record<string, string> = Object.fromEntries(comps.map((c: any) => [c.id, c.code]))
    let decided: any[] = []
    try {
      decided = await rest('competency_suggestion_inbox?select=external_ref,origin_type,status,added_as_competency_id&status=in.(added,dismissed)&order=reviewed_at.desc&limit=500')
    } catch (_e) {
      decided = []
    }
    const suggestion_decisions = decided.map((d: any) => {
      const base: any = { external_ref: d.external_ref, origin_type: d.origin_type ?? null, status: d.status }
      if (d.status === 'added') base.competency_code = codeById[d.added_as_competency_id] ?? null
      return base
    })
    // Control Room consumes role_templates. SQEPify's `roles` table IS the template store, so
    // one query feeds both the legacy `roles` array (raw 1-5 levels, kept for back-compat) and
    // the richer `role_templates` array below. Fields SQEPify does not model are synthesised:
    //   importance -> always 'H' (SQEPify has no must-have/good-to-have flag; everything assigned
    //                 to a role is required). required_level -> mapped from SQEPify's 1-5 scale to
    //                 Control Room's 0-4 by subtracting 1 (1 No knowledge -> 0 ... 5 Expert -> 4).
    //   discipline/description/notes -> null (no such columns). is_active -> always true (roles
    //                 are not archived in SQEPify; deleting a role removes it outright).
    const role_templates = roles.map((r: any) => ({
      code: r.code,
      name: r.name,
      discipline: null,
      description: null,
      is_active: true,
      is_base: r.is_base,
      sort_order: r.sort_order,
      competencies: (r.role_competencies ?? [])
        .filter((rc: any) => rc.competency?.code)
        .map((rc: any) => ({
          competency_code: rc.competency.code,
          importance: 'H',
          required_level: Math.min(4, Math.max(0, (rc.required_level ?? 1) - 1)),
          notes: null,
        })),
    }))
    const body = {
      generated_at: new Date().toISOString(),
      scale: SCALE,
      categories: cats.map((c: any) => ({ name: c.name, sort_order: c.sort_order })),
      competencies: comps.map((c: any) => ({ code: c.code, name: c.name, description: c.description, sort_order: c.sort_order, category: c.category?.name ?? null, subcategory: c.subcategory?.name ?? null })),
      roles: roles.map((r: any) => ({ code: r.code, name: r.name, is_base: r.is_base, sort_order: r.sort_order, competencies: (r.role_competencies ?? []).map((rc: any) => ({ competency_code: rc.competency?.code ?? null, required_level: rc.required_level })) })),
      role_templates,
      suggestion_decisions,
    }
    return new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
