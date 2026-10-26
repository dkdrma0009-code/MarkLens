import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-10-25/26 outage: every article analysis threw inside the AI call, analyze-pending still answered 200, the
// collect cron never alerted, and the same three articles were retried all run. These tests pin the new contract
// with mocked responses only (no AI call, no database).
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const cache = new Map()
  const loadFile = abs => {
    if (cache.has(abs)) return cache.get(abs).exports
    const mod = { exports: {} }
    cache.set(abs, mod)
    const code = ts.transpileModule(readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const req = name => {
      if (name in mocks) return mocks[name]
      if (name.startsWith('.') || name.startsWith('@/')) {
        const base = name.startsWith('@/') ? join('src', name.slice(2)) : join(dirname(abs), name)
        for (const ext of ['', '.ts', '.tsx']) try { if (statSync(base + ext).isFile()) return loadFile(resolve(base + ext)) } catch { /* next */ }
      }
      return require(name)
    }
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
    return mod.exports
  }
  return loadFile(resolve(file))
}

const KEY = 'AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE1234567'
const geminiQuota = () => new Error(`Gemini error 429: ${JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded for metric generate_content_free_tier_requests (key=${KEY})` } })}`)
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }

test('error summaries keep provider, status and message, never keys', () => {
  const { summarizeError, redactSecrets } = load('src/lib/ai/errors.ts')
  const s = summarizeError(geminiQuota())
  assert.match(s, /^Gemini error 429 RESOURCE_EXHAUSTED Quota exceeded/)
  assert.ok(!s.includes(KEY))
  assert.equal(redactSecrets(`https://x/y?key=${KEY}&a=1 Bearer abc.def sk-ant-abcdefghijklmnopqrstu`), 'https://x/y?key=***&a=1 Bearer *** ***')
  assert.match(summarizeError(Object.assign(new Error('credit balance is too low'), { status: 400 })), /^400 credit balance/)
})

test('candidate pick: keeps order, skips ids tried in this run and articles that failed within 20 hours', () => {
  const { pickCandidates, parseExclude, RETRY_COOLDOWN_HOURS } = load('src/lib/analysis/candidates.ts')
  const now = new Date('2026-10-27T01:00:00Z')
  const id = n => `00000000-0000-4000-8000-00000000000${n}`
  const rows = [
    { id: id(1), created_at: '2026-10-27T00:56:00Z', updated_at: '2026-10-27T00:56:00Z' },          // new
    { id: id(2), created_at: '2026-10-26T00:56:00Z', updated_at: '2026-10-27T00:57:30Z' },          // failed 3 min ago
    { id: id(3), created_at: '2026-10-25T00:56:00Z', updated_at: '2026-10-26T00:58:00Z' },          // failed 24h ago → retry
    { id: id(4), created_at: '2026-10-26T00:56:00Z', updated_at: '2026-10-26T00:56:00Z' },          // excluded below
    { id: id(5), created_at: '2026-10-26T00:56:00Z', updated_at: null },
  ]
  const { picked, skipped } = pickCandidates(rows, { exclude: parseExclude(`${id(4)},not-a-uuid`), now, limit: 3 })
  assert.deepEqual(picked.map(r => r.id), [id(1), id(3), id(5)])
  assert.equal(skipped, 2)
  assert.equal(RETRY_COOLDOWN_HOURS, 20)
  assert.equal(parseExclude('x,y').size, 0)
})

test('generateText: when every provider fails, the error names each provider (Gemini first) without the key', async () => {
  const realFetch = globalThis.fetch
  process.env.GEMINI_API_KEY = KEY
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded (key=${KEY})` } }) })
  class Anthropic { constructor() { this.messages = { create: async () => { throw Object.assign(new Error('Your credit balance is too low'), { status: 400 }) } } } }
  class OpenAI { constructor() { this.chat = { completions: { create: async () => { throw Object.assign(new Error('You exceeded your current quota'), { status: 429 }) } } } } }
  try {
    const { generateText } = load('src/lib/ai/llm.ts', { '@anthropic-ai/sdk': { __esModule: true, default: Anthropic }, openai: { __esModule: true, default: OpenAI } })
    await assert.rejects(generateText({ system: 's', prompt: 'p' }), err => {
      assert.match(err.message, /^AI 공급자 모두 실패 — gemini: flash-lite: Gemini error 429 RESOURCE_EXHAUSTED/)
      assert.match(err.message, /claude: 400 Your credit balance/)
      assert.match(err.message, /openai: 429 You exceeded/)
      assert.ok(!err.message.includes(KEY))
      return true
    })
    // Within the cooldown the next call says Gemini was skipped and why.
    await assert.rejects(generateText({ system: 's', prompt: 'p' }), /gemini: 건너뜀\(최근 실패 — flash-lite: Gemini error 429/)
  } finally { globalThis.fetch = realFetch }
})

// ── analyze-pending ──
function fakeDb(pool, { poolError = null } = {}) {
  const updates = [], upserts = []
  const from = table => {
    if (table === 'insights') return { upsert: async row => { upserts.push(row); return { error: null } } }
    const q = { select: () => q, eq: () => q, not: () => q, or: () => q, order: () => q, limit: async () => ({ data: pool, error: poolError }) }
    q.update = values => { const u = { values, filters: [] }; updates.push(u); const c = { eq: (k, v) => { u.filters.push([k, v]); return c }, then: (r, j) => Promise.resolve({ error: null }).then(r, j) }; return c }
    return q
  }
  return { db: { from }, updates, upserts }
}
const article = (n, over = {}) => ({ id: `00000000-0000-4000-8000-00000000010${n}`, title: `t${n}`, raw_content: 'x'.repeat(200), url: `https://e.com/${n}`, created_at: '2026-10-27T00:56:00Z', updated_at: '2026-10-27T00:56:00Z', ...over })
function analyzeRoute(db, behaviour) {
  process.env.N8N_WEBHOOK_SECRET = 's3'
  return load('src/app/api/webhooks/analyze-pending/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/utils': { buildInsightSlug: (_t, _h, id) => `slug-${id.slice(-3)}` },
    '@/lib/ai/analyze': { analyzeArticle: async a => behaviour[a.title](a) },
  }).POST
}
const call = (POST, q = '') => POST(new Request(`https://x/api/webhooks/analyze-pending?secret=s3&order=desc${q}`, { method: 'POST' }))

test('analyze-pending: every attempt failing is a 502 with secret-free errors; rows go back to pending', async () => {
  const { db, updates } = fakeDb([article(1), article(2), article(3)])
  const fail = () => { throw geminiQuota() }
  const res = await call(analyzeRoute(db, { t1: fail, t2: fail, t3: fail }))
  assert.equal(res.status, 502)
  assert.equal(res.body.attempted, 3); assert.equal(res.body.failed, 3); assert.equal(res.body.analyzed, 0)
  assert.equal(res.body.ids.length, 3)
  assert.ok(res.body.errors.every(e => e.includes('RESOURCE_EXHAUSTED') && !e.includes(KEY)))
  assert.equal(updates.filter(u => u.values.status === 'pending').length, 3)
})

test('analyze-pending: partial success is 200 with counts; no candidates is a normal skip; a query error is 500', async () => {
  const { db } = fakeDb([article(1), article(2), article(3)])
  const ok = { hook: '훅', summary: 's' }
  const res = await call(analyzeRoute(db, { t1: () => ok, t2: () => { throw geminiQuota() }, t3: () => ({ hook: '' }) }))
  assert.equal(res.status, 200)
  assert.deepEqual([res.body.analyzed, res.body.rejected, res.body.failed, res.body.partial], [1, 1, 1, true])

  const empty = await call(analyzeRoute(fakeDb([]).db, {}))
  assert.equal(empty.status, 200); assert.equal(empty.body.message, 'No pending articles'); assert.equal(empty.body.attempted, 0)

  const broken = await call(analyzeRoute(fakeDb(null, { poolError: { message: 'boom' } }).db, {}))
  assert.equal(broken.status, 500)
})

test('analyze-pending: ids from this run and recently failed articles are not picked again', async () => {
  const recent = article(4, { created_at: '2026-10-26T00:56:00Z', updated_at: new Date(Date.now() - 3600_000).toISOString() })
  const { db } = fakeDb([article(1), article(2), recent, article(5)])
  const seen = []
  const ok = a => { seen.push(a.title); return { hook: 'h' } }
  const res = await call(analyzeRoute(db, { t1: ok, t2: ok, t4: ok, t5: ok }), `&exclude=${article(1).id}`)
  assert.deepEqual(seen.sort(), ['t2', 't5'])
  assert.equal(res.body.skipped, 2)
})

// ── collect cron ──
function collectRoute(analyzeResponses, alerts, urls) {
  process.env.CRON_SECRET = 'c1'; process.env.N8N_WEBHOOK_SECRET = 's3'; process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test'
  globalThis.fetch = async url => {
    urls.push(String(url))
    if (String(url).includes('/api/webhooks/collect')) return { ok: true, status: 200, json: async () => ({ collected: 3 }) }
    const r = analyzeResponses.shift() ?? { status: 200, body: { message: 'No pending articles', attempted: 0 } }
    return { ok: r.status < 400, status: r.status, json: async () => r.body }
  }
  const count = { select: () => count, eq: () => count, lt: () => count, or: () => Promise.resolve({ count: 0 }) }
  const db = { from: () => ({ ...count, select: () => ({ eq: () => ({ single: async () => ({ data: { value: 'off' } }) }), ...count }) }) }
  return load('src/app/api/cron/collect/route.ts', {
    'next/server': { NextResponse },
    '@/lib/alert': { sendAdminAlert: async (subject, body) => { alerts.push({ subject, body }) } },
    '@/lib/newsletter/onboarding': { runOnboardingDrip: async () => ({ sent: 0 }) },
    '@/lib/release/guard.mjs': { blockedReason: () => null },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/fallback-image': { backfillFallbackImages: async () => ({ filled: 0 }) },
    '@/lib/revalidate': { revalidatePublicContent: () => {} },
  }).GET
}
const cron = GET => GET(new Request('https://site.test/api/cron/collect', { headers: { authorization: 'Bearer c1' } }))

test('collect: an analysis outage stops the loop and sends one alert with the error summary', async () => {
  const realFetch = globalThis.fetch
  const alerts = [], urls = []
  try {
    const failBody = { attempted: 3, analyzed: 0, rejected: 0, failed: 3, ids: ['00000000-0000-4000-8000-000000000201'], errors: ['00000000: Gemini error 429 RESOURCE_EXHAUSTED Quota exceeded'] }
    const res = await cron(collectRoute([{ status: 502, body: failBody }], alerts, urls))
    assert.equal(urls.filter(u => u.includes('analyze-pending')).length, 1, 'no further batches after an outage')
    assert.equal(alerts.length, 1)
    assert.match(alerts[0].subject, /기사 분석 실패/)
    assert.match(alerts[0].body, /RESOURCE_EXHAUSTED/)
    assert.equal(res.body.analysis.outage, true); assert.equal(res.body.analysis.failed, 3)
  } finally { globalThis.fetch = realFetch }
})

test('collect: a partial failure warns without an alert and excludes tried ids from the next call', async () => {
  const realFetch = globalThis.fetch
  const alerts = [], urls = []
  const ids = ['00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000303']
  try {
    const res = await cron(collectRoute([
      { status: 200, body: { attempted: 3, analyzed: 2, rejected: 0, failed: 1, partial: true, ids, errors: ['x: timeout'] } },
      { status: 200, body: { message: 'No pending articles', attempted: 0, ids: [] } },
    ], alerts, urls))
    assert.equal(alerts.length, 0)
    const second = urls.filter(u => u.includes('analyze-pending'))[1]
    assert.ok(second.includes(`exclude=${ids.join(',')}`), second)
    assert.deepEqual([res.body.analysis.analyzed, res.body.analysis.failed, res.body.analysis.outage], [2, 1, false])
  } finally { globalThis.fetch = realFetch }
})

test('collect: nothing to analyse is a quiet skip; the stale-backlog alert only counts analysable (fresh) articles', async () => {
  const realFetch = globalThis.fetch
  const alerts = [], urls = []
  try {
    const res = await cron(collectRoute([], alerts, urls))
    assert.equal(alerts.length, 0); assert.equal(res.body.analysis.attempted, 0)
  } finally { globalThis.fetch = realFetch }
  const src = readFileSync('src/app/api/cron/collect/route.ts', 'utf8')
  assert.match(src, /\.lt\("created_at", cutoff\)\s*\n\s*\.or\(freshSourceFilter\(\)\)/)
})

// ── Deploy gate (owner, 2026-10-26): normal / partial / outage paths, 502 end to end, alert count, retry window, secrets ──
test('analyze-pending: a normal run is 200 success with no warning', async () => {
  const warns = [], warn = console.warn
  console.warn = (...a) => warns.push(a.join(' '))
  try {
    const { db } = fakeDb([article(1), article(2), article(3)])
    const ok = () => ({ hook: 'h' })
    const res = await call(analyzeRoute(db, { t1: ok, t2: ok, t3: ok }))
    assert.equal(res.status, 200)
    assert.deepEqual([res.body.success, res.body.analyzed, res.body.failed, res.body.partial], [true, 3, 0, false])
    assert.equal(warns.length, 0)
  } finally { console.warn = warn }
})

test('retry window: a failure 19.9h ago is still skipped, 20.1h ago is retried', () => {
  const { pickCandidates } = load('src/lib/analysis/candidates.ts')
  const now = new Date('2026-10-27T01:00:00Z')
  const at = h => new Date(now.getTime() - h * 3600_000).toISOString()
  const rows = [
    { id: 'a', created_at: '2026-10-25T00:00:00Z', updated_at: at(19.9) },
    { id: 'b', created_at: '2026-10-25T00:00:00Z', updated_at: at(20.1) },
  ]
  assert.deepEqual(pickCandidates(rows, { now }).picked.map(r => r.id), ['b'])
})

test('502 end to end: the real analyze-pending route behind collect → one alert, loop stops, no key anywhere', async () => {
  const realFetch = globalThis.fetch, warn = console.warn, log = console.log
  const out = []
  console.warn = (...a) => out.push(a.join(' ')); console.log = (...a) => out.push(a.join(' '))
  const alerts = []
  try {
    const { db } = fakeDb([article(1), article(2), article(3), article(4), article(5)])
    const fail = () => { throw geminiQuota() }
    const POST = analyzeRoute(db, { t1: fail, t2: fail, t3: fail, t4: fail, t5: fail })
    let analyzeCalls = 0
    const GET = collectRoute([], alerts, [])
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('/api/webhooks/collect')) return { ok: true, status: 200, json: async () => ({ collected: 0 }) }
      analyzeCalls++
      const r = await POST(new Request(String(url), init))
      return { ok: r.status < 400, status: r.status, json: async () => r.body }
    }
    const res = await cron(GET)
    assert.equal(analyzeCalls, 1, 'the 502 stops the loop')
    assert.equal(alerts.length, 1); assert.match(alerts[0].subject, /기사 분석 실패/)
    assert.equal(res.body.analysis.outage, true); assert.equal(res.body.analysis.failed, 3)
    for (const text of [...out, alerts[0].body, JSON.stringify(res.body)]) assert.ok(!text.includes(KEY), 'no API key in logs, alert or response')
  } finally { globalThis.fetch = realFetch; console.warn = warn; console.log = log }
})

test('collect: partial then outage → no full-failure alert (some articles were analysed), only a warning', async () => {
  const realFetch = globalThis.fetch, warn = console.warn
  const warns = [], alerts = [], urls = []
  console.warn = (...a) => warns.push(a.join(' '))
  try {
    const res = await cron(collectRoute([
      { status: 200, body: { attempted: 3, analyzed: 1, rejected: 0, failed: 2, partial: true, ids: [], errors: ['a: e'] } },
      { status: 502, body: { attempted: 3, analyzed: 0, rejected: 0, failed: 3, ids: [], errors: ['b: e'] } },
    ], alerts, urls))
    assert.equal(alerts.length, 0)
    assert.ok(warns.some(w => w.includes('일부 실패')))
    assert.equal(urls.filter(u => u.includes('analyze-pending')).length, 2)
    assert.deepEqual([res.body.analysis.analyzed, res.body.analysis.failed, res.body.analysis.outage], [1, 5, true])
  } finally { globalThis.fetch = realFetch; console.warn = warn }
})

test('collect: a non-502 error keeps the existing alert, with the key masked', async () => {
  const realFetch = globalThis.fetch
  const alerts = []
  try {
    await cron(collectRoute([{ status: 500, body: { error: `pending query: boom key=${KEY}` } }], alerts, []))
    assert.equal(alerts.length, 1); assert.match(alerts[0].subject, /아티클 분석 cron 실패/)
    assert.ok(!alerts[0].body.includes(KEY))
  } finally { globalThis.fetch = realFetch }
})

test('collect: a normal run sends no alert', async () => {
  const realFetch = globalThis.fetch
  const alerts = []
  try {
    const res = await cron(collectRoute([
      { status: 200, body: { attempted: 3, analyzed: 3, rejected: 0, failed: 0, ids: [] } },
      { status: 200, body: { message: 'No pending articles', attempted: 0 } },
    ], alerts, []))
    assert.equal(alerts.length, 0); assert.equal(res.body.analysis.analyzed, 3); assert.equal(res.body.analyzed, 3)
  } finally { globalThis.fetch = realFetch }
})
