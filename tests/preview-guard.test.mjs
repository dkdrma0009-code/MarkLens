import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as guard from '../src/lib/release/guard.mjs'

// R-2: a Preview deployment cannot write to a production database, post, mail, render on AWS, run crons or spend on
// AI; production and local runs behave exactly as before. Real modules run with stubbed I/O — nothing leaves the test.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name === '@/lib/release/guard.mjs') return guard; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, loaded, loaded.exports)
  return loaded.exports
}
const PROD_URL = 'https://ndehtnchkgvpjbxlkazk.supabase.co', TEST_URL = 'https://previewtestproject01.supabase.co'
const KEYS = ['VERCEL', 'VERCEL_ENV', 'MARKLENS_DEPLOYMENT', 'NEXT_PUBLIC_SUPABASE_URL', 'PREVIEW_ALLOW_AI', 'MARKLENS_PRODUCTION_SUPABASE_REFS', 'CRON_SECRET']
async function withEnv(env, run) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]))
  for (const k of KEYS) delete process.env[k]
  Object.assign(process.env, env)
  try { return await run() } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } }
}
const preview = (url = PROD_URL, extra = {}) => ({ VERCEL: '1', VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: url, ...extra })
const production = { VERCEL: '1', VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: PROD_URL }

test('classification: only VERCEL_ENV=production is production; any other Vercel run is a guarded Preview', () => {
  assert.equal(guard.deployment({ VERCEL: '1', VERCEL_ENV: 'production' }), 'production')
  assert.equal(guard.deployment({ VERCEL: '1', VERCEL_ENV: 'preview' }), 'preview')
  assert.equal(guard.deployment({ VERCEL: '1', VERCEL_ENV: 'development' }), 'preview')
  assert.equal(guard.deployment({ VERCEL: '1' }), 'preview') // on Vercel without a recognised environment: fail closed
  assert.equal(guard.deployment({ VERCEL_ENV: 'production', MARKLENS_DEPLOYMENT: 'preview' }), 'preview')
  assert.equal(guard.deployment({}), 'local')
  assert.equal(guard.supabaseRef({ NEXT_PUBLIC_SUPABASE_URL: PROD_URL }), 'ndehtnchkgvpjbxlkazk')
  for (const url of [PROD_URL, undefined, '', 'https://db.example.com', 'not a url']) assert.equal(guard.databaseIsolated({ NEXT_PUBLIC_SUPABASE_URL: url }), false, String(url))
  assert.equal(guard.databaseIsolated({ NEXT_PUBLIC_SUPABASE_URL: TEST_URL }), true)
  assert.equal(guard.databaseIsolated({ NEXT_PUBLIC_SUPABASE_URL: TEST_URL, MARKLENS_PRODUCTION_SUPABASE_REFS: 'previewtestproject01' }), false)
})

test('policy matrix: the seven Preview scenarios and production', () => {
  const ACTIONS = ['db-write', 'instagram', 'threads', 'email', 'aws', 'ai', 'cron']
  const allowed = env => ACTIONS.filter(a => !guard.blockedReason(a, env))
  assert.deepEqual(allowed(preview(TEST_URL)), ['db-write'])                     // 1. Preview + test DB: test writes only
  assert.deepEqual(allowed(preview(PROD_URL)), [])                                // 2. Preview + production DB: nothing
  assert.ok(guard.blockedReason('instagram', preview(TEST_URL)))                   // 3. IG publish refused even with keys
  assert.ok(guard.blockedReason('email', preview(TEST_URL)))                       // 4. Brevo send refused
  assert.deepEqual(allowed({ VERCEL: '1' }), [])                                  // 5. misconfigured: no env, no DB → fail closed
  assert.deepEqual(allowed(preview(TEST_URL, { PREVIEW_ALLOW_AI: 'true' })), ['db-write', 'ai'])
  assert.deepEqual(allowed(production), ACTIONS)                                  // 6. production unchanged
  assert.deepEqual(allowed({}), ACTIONS)                                          //    local unchanged
  assert.throws(() => guard.assertAllowed('cron', preview(TEST_URL)), err => err instanceof guard.ReleaseGuardError && err.status === 403 && err.action === 'cron')
})

test('egress: a Preview cannot reach posting, mail or paid AI hosts; reads and production pass through', async () => {
  const sent = []
  const base = async (input, init) => { sent.push(`${init?.method ?? 'GET'} ${String(input)}`); return new Response('{}') }
  assert.equal(guard.guardFetch(base, production), base)
  assert.equal(guard.guardFetch(base, {}), base)
  const f = guard.guardFetch(base, preview(TEST_URL))
  for (const [url, method] of [['https://api.brevo.com/v3/smtp/email', 'POST'], ['https://graph.instagram.com/v21.0/1/media_publish', 'POST'],
    ['https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token', 'GET'], ['https://graph.instagram.com/refresh_access_token?x=1', 'GET'],
    ['https://generativelanguage.googleapis.com/v1beta/models/x:generateContent', 'POST'], ['https://api.anthropic.com/v1/messages', 'POST'], ['https://api.openai.com/v1/chat/completions', 'POST']]) {
    await assert.rejects(f(url, { method }), guard.ReleaseGuardError, url)
  }
  await f('https://graph.instagram.com/v21.0/1?fields=followers_count', {})
  await f('https://api.brevo.com/v3/account', {})
  await f(new Request('https://images.weserv.nl/?url=x'))
  assert.equal(sent.length, 3)
  await assert.rejects(f(new Request('https://api.brevo.com/v3/smtp/email', { method: 'POST' })), guard.ReleaseGuardError)
  const ai = guard.guardFetch(base, preview(TEST_URL, { PREVIEW_ALLOW_AI: 'true' }))
  await ai('https://api.anthropic.com/v1/messages', { method: 'POST' })
  assert.equal(sent.length, 4)
  // The SDKs MarkLens builds per request take the global fetch at construction, so the egress guard covers them too.
  for (const file of ['node_modules/@anthropic-ai/sdk/client.js', 'node_modules/openai/client.js']) assert.match(readFileSync(file, 'utf8'), /this\.fetch = options\.fetch \?\? Shims\.getDefaultFetch\(\)/)
  assert.match(readFileSync('src/instrumentation.ts', 'utf8'), /globalThis\.fetch = guardFetch\(globalThis\.fetch\)/)
})

// A minimal supabase-js-shaped client that records what reached it.
function fakeSupabase() {
  const reached = []
  const builder = (table, op) => { const q = { eq: () => q, select: () => q, single: () => q, then: r => { reached.push(`${op} ${table}`); r({ data: op === 'select' ? [{ id: 1 }] : null, error: null }) } }; return q }
  const client = {
    from: table => ({ select: () => builder(table, 'select'), insert: () => builder(table, 'insert'), update: () => builder(table, 'update'), upsert: () => builder(table, 'upsert'), delete: () => builder(table, 'delete') }),
    rpc: fn => builder(fn, 'rpc'),
    auth: { getUser: async () => ({ data: { user: null } }) },
    get storage() { return { createBucket: async () => { reached.push('createBucket') }, from: bucket => ({ upload: async () => { reached.push(`upload ${bucket}`); return { error: null } }, remove: async () => { reached.push(`remove ${bucket}`) }, getPublicUrl: path => ({ data: { publicUrl: `https://x/${path}` } }) }) } },
  }
  return { client, reached }
}
const { guardWrites } = load('src/lib/supabase/guard.ts')

test('database: Preview on a production-suspect project blocks every write path; reads, auth and read-only RPCs pass', async () => {
  await withEnv(preview(PROD_URL), async () => {
    const { client, reached } = fakeSupabase()
    const db = guardWrites(client)
    for (const write of [db.from('subscribers').insert({}), db.from('insights').update({}).eq('id', 1), db.from('cardnews').upsert({}).select().single(), db.from('articles').delete().eq('id', 1), db.rpc('issue_subscription_confirmation', {}), db.storage.from('cardnews-ig').upload('a', 'b'), db.storage.createBucket('x')]) {
      const res = await write
      assert.equal(res.error?.code, 'PREVIEW_WRITE_BLOCKED'); assert.equal(res.data, null)
    }
    assert.deepEqual((await db.from('insights').select('*').eq('id', 1)).data, [{ id: 1 }])
    await db.rpc('random_quiz', {})
    assert.deepEqual(db.storage.from('cardnews-ig').getPublicUrl('p').data, { publicUrl: 'https://x/p' })
    assert.deepEqual((await db.auth.getUser()).data, { user: null })
    assert.deepEqual(reached, ['select insights', 'rpc random_quiz'])
  })
  for (const env of [production, {}, preview(TEST_URL)]) await withEnv(env, () => { const { client } = fakeSupabase(); assert.equal(guardWrites(client), client) })
  for (const file of ['src/lib/supabase/admin.ts', 'src/lib/supabase/server.ts']) assert.ok((readFileSync(file, 'utf8').match(/guardWrites\(/g) ?? []).length >= (file.endsWith('server.ts') ? 2 : 1), file)
})

test('call sites: Instagram, Threads, mail, AWS render and crons refuse in Preview before any request; production proceeds', async () => {
  const calls = []
  globalThis.fetch = async url => { calls.push(String(url)); return new Response(JSON.stringify({ id: 'ok', status_code: 'FINISHED' })) }
  const admin = { '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { value: 'token' } }) }) }), upsert: async () => ({}) }) }) } }
  const ig = load('src/lib/instagram.ts', admin), th = load('src/lib/threads.ts', admin)
  await withEnv({ ...preview(TEST_URL), IG_USER_ID: '1', THREADS_USER_ID: '1' }, async () => {
    await assert.rejects(ig.publishCarousel(['https://i/1.jpg'], 'c'), guard.ReleaseGuardError)
    await assert.rejects(ig.publishReel('https://v.mp4', 'c'), guard.ReleaseGuardError)
    await assert.rejects(ig.refreshIgToken(), guard.ReleaseGuardError)
    await assert.rejects(th.publishThreadsCarousel(['https://i/1.jpg'], 'c'), guard.ReleaseGuardError)
    await assert.rejects(th.refreshThreadsToken(), guard.ReleaseGuardError)
  })
  assert.equal(calls.length, 0)
  process.env.IG_USER_ID = '1'
  await withEnv(production, () => ig.publishCarousel(['https://i/1.jpg'], 'c'))
  assert.ok(calls.some(u => u.includes('/media_publish')))

  const server = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } }
  const stub = new Proxy(function () {}, { get: (_, k) => k === '__esModule' ? false : stub, apply: () => stub })
  const loose = file => load(file, new Proxy({ 'next/server': server, '@/lib/release/guard.mjs': guard }, { has: () => true, get: (m, k) => k in m ? m[k] : stub }))
  await withEnv({ ...preview(TEST_URL), CRON_SECRET: 's' }, async () => {
    for (const name of ['collect', 'curation-weekly', 'ig-daily', 'newsletter', 'quiz-seed']) {
      const { GET } = loose(`src/app/api/cron/${name}/route.ts`)
      assert.equal((await GET(new Request('https://x/api/cron/' + name, { headers: { authorization: 'Bearer s' } }))).status, 403, name) // 7b. valid secret, Preview
      assert.equal((await GET(new Request('https://x/api/cron/' + name))).status, 401, name)                                          // 7.  no credentials
    }
  })
  await withEnv({ ...preview(TEST_URL) }, async () => {
    const { POST } = load('src/app/api/newsletter/send/route.ts', { 'next/server': server, '@/lib/api-auth': { isAdmin: async () => true }, '@/lib/supabase/admin': {}, '@/app/api/unsubscribe/route': {}, '@/lib/newsletter/html': {} })
    const res = await POST(new Request('https://x/api/newsletter/send', { method: 'POST', body: '{"issueId":"i1","testEmail":"qa@example.test"}' }))
    assert.equal(res.status, 403); assert.match(res.body.error, /이메일 발송/)
  })
  const render = readFileSync('src/app/api/admin/shorts/render/route.ts', 'utf8')
  assert.ok(render.indexOf('blockedReason("aws")') < render.indexOf('renderMediaOnLambda'))
  for (const file of ['src/app/api/admin/shorts/download/route.ts', 'src/app/api/admin/shorts/reels/route.ts']) assert.match(readFileSync(file, 'utf8'), /if \(parsed && !blockedReason\("aws"\)\)/)
  assert.equal(calls.filter(u => u.includes('brevo')).length, 0)
})

test('card news in Preview: a production-suspect DB refuses the claim; an isolated test DB records a retryable failure, nothing posted', async () => {
  const posted = []
  const mod = db => load('src/lib/cardnews/publish.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => guardWrites(db) },
    './render-buffers': { renderCardnewsBuffers: async () => ({ buffers: [Buffer.from('a')], caption: 'c' }) },
    '@/lib/instagram': { publishCarousel: async () => { guard.assertAllowed('instagram'); posted.push('ig'); return 'ig-1' } },
    '@/lib/threads': { publishThreadsCarousel: async () => { guard.assertAllowed('threads'); posted.push('th'); return 'th-1' } },
    './publish-state': load('src/lib/cardnews/publish-state.ts'),
  })
  // An in-memory cardnews row whose conditional UPDATE applies in one step.
  const row = { article_id: 'a1', posted_at: null, publish_status: null }
  const table = () => { const f = []; let upd = null, sel = false; const q = { update: v => { upd = v; return q }, select: () => { sel = true; return q }, eq: (c, v) => { f.push(r => r[c] === v); return q }, is: (c, v) => { f.push(r => v === null ? r[c] == null : r[c] === v); return q }, not: (c) => { f.push(r => r[c] != null); return q }, or: t => { f.push(r => t.split(',').some(p => { const [c, op, v] = p.split('.'); return op === 'is' ? r[c] == null : op === 'eq' ? r[c] === v : r[c] != null && r[c] !== v })); return q }, maybeSingle: () => q, single: () => q,
    then: res => { const hit = [row].filter(r => f.every(fn => fn(r))); if (upd) { hit.forEach(r => Object.assign(r, upd)); return res({ data: sel ? hit : null, error: null }) } res({ data: hit[0] ?? null, error: null }) } }; return q }
  const db = { from: () => table(), storage: { createBucket: async () => ({}), from: () => ({ upload: async () => ({ error: null }), getPublicUrl: p => ({ data: { publicUrl: p } }) }) } }
  await withEnv(preview(PROD_URL), async () => { await assert.rejects(mod(db).publishCardnews('a1'), /선점 실패: Preview 환경: 운영 DB/) })
  assert.equal(row.ig_publish_state, undefined)
  await withEnv(preview(TEST_URL), async () => { await assert.rejects(mod(db).publishCardnews('a1'), /Instagram 게시이\(가\) 차단/) })
  assert.equal(row.ig_publish_state, 'failed'); assert.equal(row.posted_at, null)
  assert.deepEqual(posted, [])
})
