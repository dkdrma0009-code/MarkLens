import assert from 'node:assert/strict'
import { test, afterEach } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import * as guard from '../src/lib/release/guard.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const originalEnv = { ...process.env }
afterEach(() => { process.env = { ...originalEnv } })
const response = { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }
function loader(mocks = {}) {
  const cache = new Map()
  function load(file) {
    const path = resolve(file)
    if (cache.has(path)) return cache.get(path).exports
    const loaded = { exports: {} }
    cache.set(path, loaded)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const req = name => {
      if (name in mocks) return mocks[name]
      if (name === 'next/server') return response
      if (name === '@/lib/release/guard.mjs') return guard
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve('src', name.slice(2)) : resolve(dirname(path), name)
        for (const ext of ['', '.ts', '.mjs']) if (existsSync(base + ext)) return ext === '.mjs' ? require(base + ext) : load(base + ext)
      }
      return require(name)
    }
    new Function('require', 'module', 'exports', code)(req, loaded, loaded.exports)
    return loaded.exports
  }
  return load
}
const prod = { VERCEL_ENV: 'production' }

function kineticRoute({ admin = true, scriptError = new Error('real script failure') } = {}) {
  const calls = { db: 0, ai: 0 }
  const load = loader({
    '@/lib/api-auth': { isAdmin: async () => admin },
    '@/lib/supabase/admin': { createAdminClient: () => {
      calls.db++
      return { from: table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'insights' ? { summary: 'existing source', slug: 'source' } : null }) }) }) }) }
    } },
    '@/lib/cardnews/image': { fetchImageDataUri: () => { throw Error('unexpected image request') } },
    '@/lib/shorts/reel-script': { generateReelScript: async () => { calls.ai++; throw scriptError } },
  })
  return { calls, post: body => load('src/app/api/admin/shorts/render/route.ts').POST(new Request('https://local/api/admin/shorts/render', { method: 'POST', body: JSON.stringify(body) })) }
}

for (const flag of ['AI_KILL_SWITCH', 'AI_AUTO_PAUSED']) {
  test(`kinetic ${flag}: intentional skip before DB or provider; not a generation failure`, async () => {
    delete process.env.AI_KILL_SWITCH; delete process.env.AI_AUTO_PAUSED
    process.env[flag] = 'on'
    const route = kineticRoute({ scriptError: new guard.ReleaseGuardError('ai', 'stopped') })
    const result = await route.post({ articleId: 'sample', composition: 'ReelKineticVideo' })
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, guard.automaticAISkip())
    assert.deepEqual(route.calls, { db: 0, ai: 0 })
  })
}

test('kinetic pause preserves authentication and input errors', async () => {
  process.env.AI_AUTO_PAUSED = 'on'
  const denied = kineticRoute({ admin: false })
  assert.equal((await denied.post({ articleId: 'sample', composition: 'ReelKineticVideo' })).status, 401)
  assert.deepEqual(denied.calls, { db: 0, ai: 0 })
  const route = kineticRoute()
  assert.equal((await route.post({ composition: 'ReelKineticVideo' })).status, 400)
  assert.equal((await route.post({ articleId: 'sample', composition: 'invalid' })).status, 400)
  assert.deepEqual(route.calls, { db: 0, ai: 0 })
})

for (const composition of ['Shorts', 'Reel']) {
  test(`${composition}: non-AI render keeps existing missing-card response while paused`, async () => {
    process.env.AI_KILL_SWITCH = 'on'; process.env.AI_AUTO_PAUSED = 'on'
    const route = kineticRoute()
    const result = await route.post({ articleId: 'sample', composition })
    assert.equal(result.status, 404)
    assert.deepEqual(route.calls, { db: 1, ai: 0 })
  })
}

test('kinetic real generation error remains HTTP 500 when not paused', async () => {
  delete process.env.AI_KILL_SWITCH; delete process.env.AI_AUTO_PAUSED
  const route = kineticRoute()
  const result = await route.post({ articleId: 'sample', composition: 'ReelKineticVideo' })
  assert.equal(result.status, 500)
  assert.match(result.body.error, /real script failure/)
  assert.deepEqual(route.calls, { db: 1, ai: 1 })
})

for (const skipped of [true, false]) {
  test(`admin render consumer: ${skipped ? 'skip is informational without polling' : 'real failure remains an error'}`, async () => {
    const messages = [], urls = [], busyValues = []
    const previousFetch = globalThis.fetch
    globalThis.fetch = async url => {
      urls.push(url)
      assert.equal(urls.length, 1, 'no status polling after a skipped or failed render')
      return new Response(JSON.stringify(skipped ? guard.automaticAISkip() : { error: 'real failure' }), { status: skipped ? 200 : 500, headers: { 'content-type': 'application/json' } })
    }
    try {
      const hook = loader({
        react: { useRef: value => ({ current: value }), useState: value => [value, next => busyValues.push(next)] },
        'next/navigation': { useRouter: () => ({}) },
        sonner: { toast: Object.fromEntries(['loading', 'info', 'error', 'success'].map(kind => [kind, text => { messages.push(kind); return text }])) },
        '@/remotion/ReelComposition': { DEFAULT_REEL_SETTINGS: {} },
        './types': { socialDate: () => '' },
      })('src/components/admin-v2/social/useSocialOperations.ts').default({ initialRows: [], autoPublish: false })
      await hook.generateShorts({ articleId: 'sample' }, 'ReelKineticVideo')
      assert.equal(urls.length, 1)
      assert.deepEqual(messages, ['loading', skipped ? 'info' : 'error'])
      assert.equal(busyValues.length, 2, 'busy state released in finally')
    } finally { globalThis.fetch = previousFetch }
  })
}
test('separate bundled module copies share manual scope and provider budget', async () => {
  const route = loader()('src/lib/ai/manual-context.ts')
  const instrumentation = loader()('src/lib/ai/manual-context.ts')
  assert.equal(instrumentation.authorizeManualRequest(), false)
  await route.runManualAI(async () => {
    assert.equal(instrumentation.authorizeManualRequest(), true)
    assert.throws(() => instrumentation.authorizeManualRequest(), /budget exhausted/)
  })
})

test('real admin helper refuses authenticated nonadmins and absent allowlist', async () => {
  let user = { email: 'reader@example.com' }
  process.env.ADMIN_EMAIL = 'owner@example.com'
  const auth = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) } })('src/lib/api-auth.ts')
  assert.equal(await auth.getAdminEmail(), null)
  user = { email: ' OWNER@example.com ' }
  assert.equal(await auth.getAdminEmail(), 'owner@example.com')
  delete process.env.ADMIN_EMAIL
  assert.equal(await auth.getAdminEmail(), null)
})

for (const host of ['generativelanguage.googleapis.com', 'api.anthropic.com', 'api.openai.com']) {
  test(`kill overrides manual authorization: ${host}`, async () => {
    let sent = 0, authorized = 0
    const f = guard.guardFetch(async () => { sent++; return new Response() }, { ...prod, AI_KILL_SWITCH: 'on' }, () => { authorized++; return true })
    await assert.rejects(f(`https://${host}/mock`), guard.ReleaseGuardError)
    assert.equal(sent, 0); assert.equal(authorized, 0)
  })
  test(`auto pause refuses unscoped calls: ${host}`, async () => {
    let sent = 0
    const f = guard.guardFetch(async () => { sent++; return new Response() }, { ...prod, AI_AUTO_PAUSED: 'on' })
    await assert.rejects(f(`https://${host}/mock`, { headers: { 'x-manual-ai': 'true' } }), guard.ReleaseGuardError)
    assert.equal(sent, 0)
  })
}

test('pause retains ordinary reads; switch off retains original automatic AI behavior', async () => {
  let sent = 0
  const base = async () => { sent++; return new Response('{}') }
  await guard.guardFetch(base, { ...prod, AI_AUTO_PAUSED: 'on' })('https://example.com/rss')
  await guard.guardFetch(base, prod)('https://generativelanguage.googleapis.com/mock')
  assert.equal(sent, 2)
})

test('manual context is isolated; only one provider request including retries; deadline signal is supplied', async () => {
  const context = loader()('src/lib/ai/manual-context.ts')
  let sent = 0
  const f = guard.guardFetch(async (_url, init) => { sent++; assert.ok(init.signal); return new Response('{}') }, { ...prod, AI_AUTO_PAUSED: 'on' }, context.authorizeManualRequest)
  let release
  const pending = context.runManualAI(async () => {
    await f('https://api.anthropic.com/mock')
    await assert.rejects(f('https://api.openai.com/mock'), /budget exhausted/)
    await new Promise(r => { release = r })
    return 'sample'
  })
  await new Promise(r => setImmediate(r))
  await assert.rejects(f('https://api.openai.com/mock'), guard.ReleaseGuardError)
  release()
  assert.deepEqual(await pending, { result: 'sample', calls: 1 })
  assert.equal(sent, 1)
  assert.equal(context.authorizeManualRequest(), false)
})

for (const path of ['cron/quiz-seed', 'cron/newsletter', 'cron/curation-weekly', 'webhooks/analyze-pending', 'learn/seed', 'newsletter/generate']) {
  test(`${path}: authorized intentional pause skips before DB, AI, mail or persistence`, async () => {
    process.env.AI_AUTO_PAUSED = 'on'; delete process.env.AI_KILL_SWITCH
    process.env.CRON_SECRET = 'mock'; process.env.N8N_WEBHOOK_SECRET = 'mock'
    const forbidden = () => { throw Error('unexpected IO') }
    const load = loader(new Proxy({ '@/lib/supabase/admin': { createAdminClient: forbidden } }, {
      has: (o, k) => k in o || (typeof k === 'string' && k.startsWith('@/') && k !== '@/lib/release/guard.mjs'),
      get: (o, k) => k in o ? o[k] : new Proxy({}, { get: () => forbidden }),
    }))
    const route = load(`src/app/api/${path}/route.ts`)
    const req = new Request(`https://local/api/${path}?secret=mock`, { method: route.GET ? 'GET' : 'POST', headers: { authorization: 'Bearer mock' } })
    const result = await (route.GET ?? route.POST)(req)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { skipped: true, reason: 'automatic_ai_paused' })
  })
}

test('paused collect keeps RSS and real collection errors, suppresses analysis/stall/backlog alerts and recovery writes', async () => {
  process.env.AI_AUTO_PAUSED = 'on'; process.env.CRON_SECRET = 'mock'; process.env.N8N_WEBHOOK_SECRET = 'mock'
  const previousFetch = globalThis.fetch
  for (const rssStatus of [200, 500]) {
    const calls = [], alerts = []
    const query = { eq: () => query, lt: () => query, or: () => query, single: async () => ({ data: { value: 'off' } }), then: r => r({ count: 60 }) }
    const load = loader({
      '@/lib/alert': { sendAdminAlert: async s => alerts.push(s) },
      '@/lib/newsletter/onboarding': { runOnboardingDrip: async () => ({ sent: 0 }) },
      '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select: () => query }) }) },
      '@/lib/analysis/health': { analysisStall: async () => ({ stalled: true, freshPending: 100 }), recoverStuckAnalyzing: () => { throw Error('must not write') } },
      '@/lib/fallback-image': { backfillFallbackImages: async () => ({ filled: 0 }) },
    })
    globalThis.fetch = async url => { calls.push(String(url)); return new Response(JSON.stringify({ error: rssStatus === 500 ? 'RSS failed' : undefined }), { status: rssStatus }) }
    try {
      const result = await load('src/app/api/cron/collect/route.ts').GET(new Request('https://local', { headers: { authorization: 'Bearer mock' } }))
      assert.equal(result.status, 200); assert.equal(result.body.aiPaused, true)
      assert.equal(result.body.analyzed, 0); assert.equal(result.body.staleBacklog, 60)
      assert.equal(calls.length, 1); assert.match(calls[0], /webhooks\/collect/)
      assert.deepEqual(alerts, rssStatus === 500 ? ['아티클 수집 cron 실패'] : [])
    } finally { globalThis.fetch = previousFetch }
  }
})

function manualRoute({ actor = 'admin@example.test', quota = true, failure = false } = {}) {
  let quotas = 0, calls = 0
  const load = loader({
    '@/lib/api-auth': { getAdminEmail: async () => actor },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => { quotas++; return quota === 'error' ? { error: { code: 'missing' } } : { data: quota } } }) },
    '@/lib/ai/errors': { summarizeError: () => 'Mock provider failure' },
    '@/lib/ai/llm': { generateText: async args => {
      assert.equal(args.maxTokens, 1000)
      const context = load('src/lib/ai/manual-context.ts')
      const f = guard.guardFetch(async () => { calls++; if (failure) throw Error('mock failure'); return new Response('sample') }, process.env, context.authorizeManualRequest)
      return (await f('https://generativelanguage.googleapis.com/mock')).text()
    } },
  })
  return { route: load('src/app/api/admin/ai-test/route.ts'), counts: () => ({ quotas, calls }) }
}
const request = (body = { feature: 'article', sample: '실제 사실을 포함하는 샘플 내용입니다.', acceptCost: true }) => new Request('https://local/api/admin/ai-test?secret=mock', { method: 'POST', body: JSON.stringify(body) })
for (const [name, actor, enabled, kill, body, quota, status] of [
  ['unauthenticated webhook cannot authorize', null, 'on', '', undefined, true, 401],
  ['manual disabled by default', 'admin', '', '', undefined, true, 503],
  ['kill defeats manual enable', 'admin', 'on', 'on', undefined, true, 503],
  ['explicit cost consent required', 'admin', 'on', '', { feature: 'quiz', sample: 'sample sample sample' }, true, 400],
  ['unknown input rejected', 'admin', 'on', '', { feature: 'quiz', sample: 'sample sample sample', acceptCost: true, bypass: true }, true, 400],
  ['durable quota exhausted', 'admin', 'on', '', undefined, false, 429],
  ['quota errors fail closed', 'admin', 'on', '', undefined, 'error', 503],
]) test(`manual: ${name}`, async () => {
  process.env.AI_MANUAL_TEST_ENABLED = enabled; process.env.AI_KILL_SWITCH = kill; process.env.AI_AUTO_PAUSED = 'on'
  const m = manualRoute({ actor, quota })
  assert.equal((await m.route.POST(request(body))).status, status)
  assert.equal(m.counts().calls, 0)
})
for (const feature of ['article', 'interview', 'quiz', 'newsletter', 'cardnews']) test(`manual ${feature}: authenticated consent + quota only, returns nonpersisted sample`, async () => {
  process.env.AI_MANUAL_TEST_ENABLED = 'on'; delete process.env.AI_KILL_SWITCH; process.env.AI_AUTO_PAUSED = 'on'
  const m = manualRoute()
  const result = await m.route.POST(request({ feature, sample: '검증할 입력 사실과 내용입니다.', acceptCost: true }))
  assert.equal(result.status, 200); assert.equal(result.body.persisted, false); assert.equal(result.body.calls, 1)
  assert.deepEqual(m.counts(), { quotas: 1, calls: 1 })
})
test('manual failure is reported; no extra provider calls or content writes', async () => {
  process.env.AI_MANUAL_TEST_ENABLED = 'on'; delete process.env.AI_KILL_SWITCH; process.env.AI_AUTO_PAUSED = 'on'
  const m = manualRoute({ failure: true })
  assert.equal((await m.route.POST(request())).status, 502)
  assert.deepEqual(m.counts(), { quotas: 1, calls: 1 })
})
test('public API stays disabled until separate opt-in, before quota writes', async () => {
  delete process.env.AI_PUBLIC_ENABLED; delete process.env.AI_KILL_SWITCH
  const mod = loader({ '@/lib/supabase/admin': { createAdminClient: () => { throw Error('quota write') } } })('src/lib/ai/budget.ts')
  assert.equal((await mod.checkAiBudget(new Request('https://local'), 'chat')).status, 503)
})

test('Preview AI denial still overrides admin opt-in and auto-pause exemption', async () => {
  process.env.MARKLENS_DEPLOYMENT = 'preview'; delete process.env.PREVIEW_ALLOW_AI
  process.env.AI_MANUAL_TEST_ENABLED = 'on'; delete process.env.AI_KILL_SWITCH
  const m = manualRoute()
  assert.equal((await m.route.POST(request())).status, 503)
  assert.deepEqual(m.counts(), { quotas: 0, calls: 0 })
})

test('real provider fallback chain cannot spend a second request in a manual scope', async () => {
  const previousFetch = globalThis.fetch
  let sent = 0
  process.env.GEMINI_API_KEY = 'mock'
  const sdkRequest = () => globalThis.fetch('https://api.anthropic.com/mock')
  class MockClaude { messages = { create: sdkRequest } }
  class MockOpenAI { chat = { completions: { create: sdkRequest } } }
  const load = loader({ '@anthropic-ai/sdk': MockClaude, openai: MockOpenAI })
  const context = load('src/lib/ai/manual-context.ts')
  globalThis.fetch = guard.guardFetch(async () => {
    sent++
    return new Response(JSON.stringify({ error: { message: 'mock 503' } }), { status: 503 })
  }, { ...prod, AI_AUTO_PAUSED: 'on' }, context.authorizeManualRequest)
  try {
    await assert.rejects(context.runManualAI(() => load('src/lib/ai/llm.ts').generateText({ system: 'test', prompt: 'mock', maxTokens: 1000 })))
    assert.equal(sent, 1)
    assert.equal(context.authorizeManualRequest(), false)
  } finally { globalThis.fetch = previousFetch }
})

test('admin health distinguishes intentional pause, reports backlog, and does not probe Gemini', async () => {
  process.env.AI_AUTO_PAUSED = 'on'; process.env.GEMINI_API_KEY = 'mock'; process.env.N8N_WEBHOOK_SECRET = 'mock'
  delete process.env.BREVO_API_KEY
  const load = loader({
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ count: 10 }) }) }) }) },
    '@/lib/supabase/server': {},
    '@/lib/instagram': { checkInstagram: async () => ({ ok: true }) },
    '@/lib/threads': { checkThreads: async () => ({ ok: true }) },
    '@/lib/ga4': { checkGa4: async () => ({ ok: true }) },
    '@/lib/analysis/health': { analysisStall: async () => ({ stalled: true, freshPending: 99, recentInsights: 0 }) },
  })
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw Error('unexpected remote call') }
  try {
    const result = await load('src/app/api/admin/health/route.ts').GET(new Request('https://local?secret=mock'))
    assert.equal(result.body.checks.analysis.ok, true)
    assert.match(result.body.checks.analysis.detail, /일시 중지.*99/)
    assert.equal(result.body.checks.gemini.ok, true)
    assert.match(result.body.checks.gemini.detail, /조회하지 않음/)
    assert.equal(result.body.checks.brevo.ok, false) // genuine missing integration still reported
  } finally { globalThis.fetch = previousFetch }
})
