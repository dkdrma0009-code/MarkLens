import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyPreviewDb, PUBLIC_READ, MEMBER_READ, ROLE_DENIED, RPC_DENIED } from '../scripts/release/verify-preview-db.mjs'
import { checkedMigrations } from '../scripts/release/preflight.mjs'

// R-3: verify-preview-db.mjs confirms from an env file alone that its project is the initialised Preview database and that
// anon / authenticated see only what they should. It never sends a request to production or to an unprovable URL, and its
// function probe never writes (GET runs read-only).
const PREVIEW = 'https://previewtestproject01.supabase.co'
const env = { NEXT_PUBLIC_SUPABASE_URL: PREVIEW, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-secret-1', SUPABASE_SERVICE_ROLE_KEY: 'service-secret-2', ADMIN_EMAIL: 'preview-admin@example.test', ADMIN_PASSWORD: 'password-secret-3' }
const schemaOk = checkedMigrations().map(migration => ({ migration, present: true }))
const tables = ['articles', 'insights', 'subscribers', 'newsletter_issues', 'newsletter_events', 'insight_challenges', 'insight_sessions', 'content_metrics', 'curations', 'app_config', 'cardnews', 'feedback', 'follower_snapshots', 'quiz_questions', 'site_feedback', 'brand_entities', 'brand_watch_profiles', 'brand_takes', 'ai_usage']
const cols = { newsletter_issues: ['topic_headline', 'approved_at'], subscribers: ['drip_step', 'source', 'confirmation_token'], cardnews: ['reel_settings', 'ig_publish_state', 'threads_publish_state'], insights: ['legacy_slug', 'hook', 'marketing_terms', 'quiz', 'video_url'], articles: ['site_published_at', 'fallback_image'], brand_takes: ['confidence'] }
const serviceRpcs = [...new Set(['issue_subscription_confirmation', 'brand_watch_approve_evidence', 'brand_watch_publish_pattern', 'consume_ai_quota', 'random_quiz', ...RPC_DENIED])]

// A correctly initialised Preview project as PostgREST, Storage and Auth answer each role; `tweak` breaks one thing.
function fakePreview(tweak = {}) {
  const seen = []
  const fetchImpl = async (url, init) => {
    const u = new URL(url), bearer = init.headers.Authorization.replace('Bearer ', '')
    const role = bearer === 'service-secret-2' ? 'service' : bearer === 'user-jwt' ? 'authenticated' : 'anon'
    seen.push({ url, method: init.method, role, path: u.pathname, query: u.search })
    const json = (body, status = 200, range) => new Response(JSON.stringify(body), { status, headers: range ? { 'content-range': range } : {} })
    if (u.pathname === '/auth/v1/token') return JSON.parse(init.body).password === 'password-secret-3' && !tweak.badPassword ? json({ access_token: 'user-jwt' }) : json({ error: 'invalid_grant' }, 400)
    if (u.pathname === '/rest/v1/') {
      if (role !== 'service') return json({ message: 'not allowed' }, 401) // as Supabase answers anon / users
      const definitions = Object.fromEntries(tables.filter(t => t !== tweak.dropTable).map(t => [t, { properties: Object.fromEntries((cols[t] ?? ['id']).map(c => [c, {}])) }]))
      if (tweak.competitions) definitions.competitions = { properties: {} }
      const post = { parameters: [{ in: 'body', name: 'args', schema: { properties: { p_key: { type: 'string', format: 'text' }, p_limit: { type: 'integer', format: 'int32' } } } }] }
      return json({ definitions, paths: Object.fromEntries(serviceRpcs.map(f => [`/rpc/${f}`, { post }])) })
    }
    if (u.pathname.startsWith('/rest/v1/rpc/')) {
      const f = u.pathname.split('/').pop()
      if (init.method !== 'GET') return json({ message: 'unexpected write' }, 500)
      if (role === 'service') return json({ code: '25006' }, 405)
      if (f === tweak.exposedRpc) return json({ code: '25006', message: 'cannot execute INSERT in a read-only transaction' }, 405)
      if (f === tweak.unclearRpc) return json({ code: 'PGRST202', message: 'Could not find the function' }, 404)
      return json({ code: '42501', message: `permission denied for function ${f}` }, 401)
    }
    const table = u.pathname.replace('/rest/v1/', '')
    if (role !== 'service') {
      if (PUBLIC_READ.includes(table)) return json([], 200, `0-0/${table === 'insights' ? 3 : 0}`)
      if (MEMBER_READ.includes(table) && role === 'authenticated') return json([], 200, `0-0/${tweak.othersRows ? 2 : 0}`) // RLS: own rows only
      if (table === tweak.leak) return json([{}], 200, '0-0/1')
      return json({ code: '42501', message: `permission denied for table ${table}` }, 401)
    }
    if (table === 'app_config') return json(tweak.noMarker ? [] : [{ value: 'preview' }])
    const counts = { articles: 3, insights: 3, quiz_questions: 2, subscribers: tweak.subscribers ?? 0 }
    if (table in counts) return json([], 200, `0-0/${counts[table]}`)
    if (u.pathname === '/storage/v1/bucket') return role === 'service' ? json(['ad-assets', 'ad-clips', 'cardnews-ig', 'stock-posters'].map(id => ({ id, public: id !== tweak.privateBucket }))) : json([])
    if (u.pathname === '/auth/v1/admin/users') return json({ users: tweak.noAdmin ? [] : [{ email: 'preview-admin@example.test' }] })
    return json({}, 404)
  }
  return { fetchImpl, seen }
}
const levels = results => Object.fromEntries(results.filter(r => r.level !== 'PASS').map(r => [r.name, r.level]))

test('verify: a correctly initialised Preview passes for service, anon and the signed-in admin; nothing written or printed', async () => {
  const { fetchImpl, seen } = fakePreview()
  const results = await verifyPreviewDb(env, fetchImpl, schemaOk)
  assert.deepEqual(levels(results), {})
  assert.ok(seen.every(r => r.url.startsWith(PREVIEW + '/')))
  assert.deepEqual(seen.filter(r => r.method !== 'GET').map(r => r.path), ['/auth/v1/token']) // the one sign-in, nothing else written
  for (const role of ['anon', 'authenticated']) {
    for (const t of ROLE_DENIED) assert.ok(seen.some(r => r.role === role && r.path === `/rest/v1/${t}`), `${role} ${t}`)
    for (const f of RPC_DENIED) assert.ok(seen.some(r => r.role === role && r.method === 'GET' && r.path === `/rest/v1/rpc/${f}` && r.query.includes('p_key=x')), `${role} ${f}`)
  }
  assert.ok(!JSON.stringify(results).includes('secret') && !JSON.stringify(results).includes('user-jwt'), 'a credential was printed')
})

test('verify: production, an unprovable URL or the wrong Preview ref is refused before any request', async () => {
  for (const url of ['https://ndehtnchkgvpjbxlkazk.supabase.co', 'https://db.example.com', '', 'http://127.0.0.1:54321']) {
    const { fetchImpl, seen } = fakePreview()
    const results = await verifyPreviewDb({ ...env, NEXT_PUBLIC_SUPABASE_URL: url }, fetchImpl, schemaOk)
    assert.equal(seen.length, 0, url)
    assert.deepEqual(levels(results), { 'Preview project (not production, provable)': 'FAIL' }, url)
  }
  const { fetchImpl, seen } = fakePreview()
  assert.deepEqual(levels(await verifyPreviewDb({ ...env, MARKLENS_PREVIEW_REF: 'umysmkhttlupmhttjzwi' }, fetchImpl, schemaOk)), { 'ref matches the expected Preview project': 'FAIL' })
  assert.equal(seen.length, 0)
})

test('verify: each broken piece fails; what cannot be checked is UNKNOWN, never PASS', async () => {
  const cases = {
    dropTable: ['ai_usage', { 'tables of migrations 001–024 and 001a': 'FAIL' }],
    noMarker: [true, { 'environment marker = preview (seeded by the Preview bundle)': 'FAIL' }],
    competitions: [true, { 'production parity: competitions dropped': 'FAIL' }],
    privateBucket: ['ad-clips', { 'storage buckets (4, public)': 'FAIL' }],
    noAdmin: [true, { 'test admin user exists in Preview Auth': 'FAIL' }],
    subscribers: [12, { 'synthetic seed only (3 articles, 3 insights, 2 quiz questions, 0 subscribers)': 'FAIL' }],
    leak: ['subscribers', { [`anon: denied on ${ROLE_DENIED.length} sensitive tables`]: 'FAIL', [`authenticated: denied on ${ROLE_DENIED.length} sensitive tables`]: 'FAIL' }],
    exposedRpc: ['consume_ai_quota', { 'anon: service-only commands not executable': 'FAIL', 'authenticated: service-only commands not executable': 'FAIL' }],
    unclearRpc: ['confirm_subscription', { 'anon: service-only commands not executable': 'UNKNOWN', 'authenticated: service-only commands not executable': 'UNKNOWN' }],
    badPassword: [true, { 'test admin signs in (Preview Auth)': 'FAIL' }],
    othersRows: [true, { [`authenticated: own Insight Lab rows only (${MEMBER_READ.join(', ')})`]: 'FAIL' }],
  }
  for (const [key, [value, expected]] of Object.entries(cases)) {
    const { fetchImpl } = fakePreview({ [key]: value })
    assert.deepEqual(levels(await verifyPreviewDb(env, fetchImpl, schemaOk)), expected, key)
  }
  let { fetchImpl } = fakePreview()
  assert.deepEqual(levels(await verifyPreviewDb({ ...env, ADMIN_PASSWORD: undefined }, fetchImpl, schemaOk)), { 'authenticated role': 'UNKNOWN' })
  ;({ fetchImpl } = fakePreview())
  assert.deepEqual(levels(await verifyPreviewDb(env, fetchImpl)), { 'trigger-only migrations 017, 022': 'UNKNOWN' })
  ;({ fetchImpl } = fakePreview())
  assert.deepEqual(levels(await verifyPreviewDb(env, fetchImpl, schemaOk.map(r => r.migration === '022' ? { ...r, present: false } : r))), { 'SQL check: all migrations present (incl. trigger-only 017, 022)': 'FAIL' })
})
