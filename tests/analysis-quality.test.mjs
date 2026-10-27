import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-10-28 stabilization: copied/duplicate titles, the 브랜딩 category skew, abandoned "analyzing" rows and a stall
// that no per-run alert sees. Mocked database and providers only — no AI call, no mail.
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
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }

// insights lookup mock: records filters, answers with `rows`
function hookDb(rows, error = null) {
  const calls = []
  const q = { eq: (k, v) => { calls.push(['eq', k, v]); return q }, neq: (k, v) => { calls.push(['neq', k, v]); return q }, limit: async () => ({ data: rows, error }) }
  return { db: { from: () => ({ select: () => q }) }, calls }
}

test('title: the prompt example hooks, word for word or nearly, count as copies; ordinary hooks do not', () => {
  const { copiesPromptExample } = load('src/lib/analysis/quality.ts')
  for (const h of ['검색은 죽지 않았다. 검색창이 사라졌을 뿐', '검색은 죽었다. 검색창이 사라졌을 뿐', 'SEO가 죽어가고 있다. 그 자리를 차지할 건 누구?']) assert.equal(copiesPromptExample(h), true, h)
  for (const h of ['ChatGPT 광고 89개국, 브랜드가 돈을 내도 AI의 답변은 바꿀 수 없다', '월마트 1시간 픽업, \'검색\' 대신 \'직행\'']) assert.equal(copiesPromptExample(h), false, h)
})

test('title: a hook another article already uses is a duplicate; the article\'s own insight and lookup errors are not', async () => {
  const { assertUsableHook, hookTaken } = load('src/lib/analysis/quality.ts')
  const taken = hookDb([{ id: 'x' }])
  await assert.rejects(assertUsableHook(taken.db, '같은 제목', 'a1'), /제목 중복/)
  assert.deepEqual(taken.calls, [['eq', 'hook', '같은 제목'], ['neq', 'article_id', 'a1']])
  await assert.rejects(assertUsableHook(hookDb([]).db, '검색은 죽었다. 검색창이 사라졌을 뿐', 'a1'), /예시 제목/)
  await assertUsableHook(hookDb([]).db, '새 제목', 'a1')
  assert.equal(await hookTaken(hookDb(null, { message: 'down' }).db, '새 제목', 'a1'), false)
})

test('analyze-pending: a copied example title is a failed analysis (back to pending, retried), not a saved insight', async () => {
  const updates = [], upserts = []
  const pool = [{ id: '00000000-0000-4000-8000-000000000301', title: 't1', raw_content: 'x'.repeat(200), url: 'https://e.com/1', created_at: '2026-10-27T00:56:00Z', updated_at: '2026-10-27T00:56:00Z' }]
  const none = { eq: () => none, neq: () => none, limit: async () => ({ data: [], error: null }) }
  const db = {
    from: table => {
      if (table === 'insights') return { upsert: async row => { upserts.push(row); return { error: null } }, select: () => none }
      const q = { select: () => q, eq: () => q, not: () => q, or: () => q, order: () => q, limit: async () => ({ data: pool, error: null }) }
      q.update = values => { const u = { values }; updates.push(u); const c = { eq: () => c, then: (r, j) => Promise.resolve({ error: null }).then(r, j) }; return c }
      return q
    },
  }
  process.env.N8N_WEBHOOK_SECRET = 's3'
  const { POST } = load('src/app/api/webhooks/analyze-pending/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/utils': { buildInsightSlug: () => 'slug' },
    '@/lib/ai/analyze': { analyzeArticle: async () => ({ hook: '검색은 죽지 않았다. 검색창이 사라졌을 뿐', summary: 's' }) },
  })
  const res = await POST(new Request('https://x/api/webhooks/analyze-pending?secret=s3&order=desc', { method: 'POST' }))
  assert.equal(res.status, 502)
  assert.deepEqual([res.body.analyzed, res.body.rejected, res.body.failed], [0, 0, 1])
  assert.match(res.body.errors[0], /예시 제목/)
  assert.equal(upserts.length, 0)
  assert.equal(updates.at(-1).values.status, 'pending')
})

test('category: slugs and Korean labels both map; the prompt no longer suggests branding; unknown still falls back', async () => {
  let prompt = '', answer = ''
  const { analyzeArticle, categorySlug } = load('src/lib/ai/analyze.ts', { '@/lib/ai/llm': { generateText: async a => { prompt ||= a.prompt; return answer } } })
  assert.equal(categorySlug('ai-marketing'), 'ai-marketing')
  assert.equal(categorySlug('AI 마케팅'), 'ai-marketing')
  assert.equal(categorySlug('AI마케팅'), 'ai-marketing')
  assert.equal(categorySlug('Social Media'), 'social-media')
  assert.equal(categorySlug('social_media'), 'social-media')
  assert.equal(categorySlug('기타'), null)
  const article = { title: 'T', content: 'x'.repeat(200), url: 'https://e.com/a' }
  answer = JSON.stringify({ category: 'AI 마케팅', hook: '훅', summary: 's' })
  assert.equal((await analyzeArticle(article)).category, 'AI 마케팅')
  assert.ok(!prompt.includes('branding 중 하나'))
  const warn = console.warn; console.warn = () => {}
  try {
    answer = JSON.stringify({ category: '기타', hook: '훅', summary: 's' })
    assert.equal((await analyzeArticle(article)).category, '브랜딩')
  } finally { console.warn = warn }
})

test('pipeline: abandoned "analyzing" rows older than an hour go back to pending', async () => {
  const { recoverStuckAnalyzing } = load('src/lib/analysis/health.ts')
  const seen = {}
  const db = { from: t => ({ update: v => { seen.table = t; seen.values = v; const c = { eq: (k, x) => { seen.eq = [k, x]; return c }, lt: (k, x) => { seen.lt = [k, x]; return c }, select: async () => ({ data: [{ id: 1 }, { id: 2 }], error: null }) }; return c } }) }
  const n = await recoverStuckAnalyzing(db, new Date('2026-10-28T01:00:00Z'))
  assert.equal(n, 2)
  assert.deepEqual([seen.table, seen.values.status, seen.eq, seen.lt], ['articles', 'pending', ['status', 'analyzing'], ['updated_at', '2026-10-28T00:00:00.000Z']])
})

test('pipeline: stalled only when analysable articles wait and no insight was made in 48 hours', async () => {
  const { analysisStall } = load('src/lib/analysis/health.ts')
  const db = (pending, recent) => ({
    from: t => {
      if (t === 'articles') { const q = { select: () => q, eq: () => q, or: async () => ({ count: pending, error: null }) }; return q }
      return { select: (_c, opts) => opts?.head ? { gte: async () => ({ count: recent, error: null }) } : { order: () => ({ limit: async () => ({ data: [{ created_at: '2026-10-12T00:58:00Z' }], error: null }) }) } }
    },
  })
  assert.deepEqual(await analysisStall(db(75, 0)), { stalled: true, freshPending: 75, recentInsights: 0, latestInsightAt: '2026-10-12T00:58:00Z' })
  assert.equal((await analysisStall(db(0, 0))).stalled, false, 'a quiet day with nothing to analyse')
  assert.equal((await analysisStall(db(75, 3))).stalled, false)
})

test('collect: recovers abandoned rows before analysing and alerts on a stall even when no batch answered', async () => {
  const realFetch = globalThis.fetch
  const alerts = [], order = []
  process.env.CRON_SECRET = 'c1'; process.env.N8N_WEBHOOK_SECRET = 's3'; process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test'
  globalThis.fetch = async url => {
    if (String(url).includes('/api/webhooks/collect')) return { ok: true, status: 200, json: async () => ({ collected: 0 }) }
    order.push('analyze')
    return { ok: true, status: 200, json: async () => ({ message: 'No pending articles', attempted: 0 }) }
  }
  const count = { select: () => count, eq: () => count, lt: () => count, or: () => Promise.resolve({ count: 0 }) }
  const db = { from: () => ({ ...count, select: () => ({ eq: () => ({ single: async () => ({ data: { value: 'off' } }) }), ...count }) }) }
  try {
    const { GET } = load('src/app/api/cron/collect/route.ts', {
      'next/server': { NextResponse },
      '@/lib/alert': { sendAdminAlert: async (subject, body) => { alerts.push({ subject, body }) } },
      '@/lib/newsletter/onboarding': { runOnboardingDrip: async () => ({ sent: 0 }) },
      '@/lib/release/guard.mjs': { blockedReason: () => null },
      '@/lib/supabase/admin': { createAdminClient: () => db },
      '@/lib/fallback-image': { backfillFallbackImages: async () => ({ filled: 0 }) },
      '@/lib/revalidate': { revalidatePublicContent: () => {} },
      '@/lib/analysis/health': {
        recoverStuckAnalyzing: async () => { order.push('recover'); return 2 },
        analysisStall: async () => ({ stalled: true, freshPending: 75, recentInsights: 0, latestInsightAt: '2026-10-12T00:58:00Z' }),
      },
    })
    const res = await GET(new Request('https://site.test/api/cron/collect', { headers: { authorization: 'Bearer c1' } }))
    assert.equal(order[0], 'recover')
    assert.equal(res.body.recoveredAnalyzing, 2)
    const stall = alerts.filter(a => /분석 정체/.test(a.subject))
    assert.equal(stall.length, 1)
    assert.match(stall[0].body, /대기 기사가 75건/)
    assert.match(stall[0].body, /시간 초과·중단 가능성/)
  } finally { globalThis.fetch = realFetch }
})

test('quiz: a Gemini failure keeps each model\'s status in the log instead of "Gemini unavailable" alone', async () => {
  const realFetch = globalThis.fetch, warn = console.warn, error = console.error
  const logs = []
  console.warn = (...a) => logs.push(a.join(' ')); console.error = () => {}
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }) })
  try {
    const { generateChunk } = load('src/lib/ai/quiz.ts', { '@/lib/ai/llm': { generateText: async () => { throw new Error('AI 공급자 모두 실패') } } })
    assert.deepEqual(await generateChunk(5, 'basic', 'concept', 1), [])
    assert.ok(logs.some(l => /gemini-2\.5-flash-lite: Gemini error 429 RESOURCE_EXHAUSTED/.test(l)), logs.join('\n'))
  } finally { globalThis.fetch = realFetch; console.warn = warn; console.error = error }
})
