import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-2: every public AI route takes a slot from a per-client and a service-wide daily quota (migration 024) before it
// calls a paid model; over quota → 429, quota unreadable → 503, quota not yet migrated → today's behaviour.
// Real modules with stubbed I/O; no AI provider is ever called.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, loaded, loaded.exports)
  return loaded.exports
}
const server = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } }
const rateLimit = load('src/lib/rate-limit.ts', { 'next/server': server })
function budgetWith(answers) {
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push(args); const a = answers.shift(); return typeof a === 'object' ? { data: null, error: a } : { data: a, error: null } } }
  const mod = load('src/lib/ai/budget.ts', { 'next/server': server, '@/lib/supabase/admin': { createAdminClient: () => db }, '@/lib/rate-limit': rateLimit })
  return { ...mod, calls }
}
const req = (ip = '203.0.113.7') => new Request('https://x/api/chat', { method: 'POST', headers: { 'x-forwarded-for': ip } })

test('limits: defaults sized from existing flows, overridable per feature through AI_DAILY_LIMITS', () => {
  const { aiDailyLimits, DEFAULT_AI_DAILY_LIMITS } = budgetWith([])
  assert.deepEqual(aiDailyLimits(undefined), DEFAULT_AI_DAILY_LIMITS)
  assert.deepEqual(aiDailyLimits('chat=10, global=500, bogus=1, learn=-3, interview=x'), { ...DEFAULT_AI_DAILY_LIMITS, chat: 10, global: 500 })
})

test('quota: per-client then service-wide; 429 when either is spent, 503 when unreadable, pass-through before migration 024', async () => {
  let b = budgetWith([true, true])
  assert.equal(await b.checkAiBudget(req(), 'chat'), null)
  assert.deepEqual(b.calls.map(c => [c.p_scope, c.p_window_seconds, c.p_limit]), [['feature:chat', 86400, 100], ['global', 86400, 3000]])
  assert.match(b.calls[0].p_key, /^ip:[0-9a-f]{32}$/)
  assert.ok(!b.calls[0].p_key.includes('203.0.113.7'), 'no raw address is stored')

  b = budgetWith([false])
  let res = await b.checkAiBudget(req(), 'interview')
  assert.equal(res.status, 429); assert.match(res.body.error, /이 기능의 AI 사용 한도/); assert.equal(b.calls.length, 1)
  b = budgetWith([true, false])
  res = await b.checkAiBudget(req(), 'learn')
  assert.equal(res.status, 429); assert.match(res.body.error, /오늘 AI 기능 사용량이 많아/)

  b = budgetWith([{ code: 'PGRST202', message: 'Could not find the function public.consume_ai_quota' }])
  assert.equal(await b.checkAiBudget(req(), 'chat'), null)
  for (const error of [{ code: '08006', message: 'connection failure' }, { code: 'PREVIEW_WRITE_BLOCKED', message: 'Preview 환경: …' }]) {
    b = budgetWith([error])
    res = await b.checkAiBudget(req(), 'chat')
    assert.equal(res.status, 503, error.code)
  }
  b = budgetWith([true, true])
  await b.checkAiBudget(req(), 'insight-lab', 'user-123')
  assert.equal(b.calls[0].p_key, 'user:user-123')
})

test('routes: every public AI endpoint checks the quota before its first paid call; Insight Lab after login and validation', async () => {
  const ROUTES = { chat: 'chat', 'interview/questions': 'interview', 'interview/feedback': 'interview', 'interview/report': 'interview', 'interview/custom-questions': 'interview', 'learn/generate': 'learn', 'learn/grade': 'learn', 'insight-lab/evaluate': 'insight-lab' }
  for (const [route, feature] of Object.entries(ROUTES)) {
    const source = readFileSync(`src/app/api/${route}/route.ts`, 'utf8')
    const check = source.indexOf(`checkAiBudget(req, "${feature}"`)
    assert.ok(check > 0, route)
    const firstAi = Math.min(...['geminiJson(', 'generateText(', 'generateQuestions(', 'new Anthropic(', 'callGemini('].map(c => source.indexOf(c, source.indexOf('export async function POST'))).filter(i => i > 0))
    assert.ok(check < firstAi, `${route}: quota before the first AI call`)
  }

  let aiCalls = 0, budgetCalls = 0
  const evaluate = (user, verdict) => load('src/app/api/insight-lab/evaluate/route.ts', {
    'next/server': server, '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { title: 't', summary: 's' } }) }) }) }) }) },
    '@/lib/ai/llm': { generateText: async () => { aiCalls++; return '{}' } }, '@/lib/rate-limit': rateLimit,
    '@/lib/ai/budget': { checkAiBudget: async (_r, f, id) => { budgetCalls++; assert.equal(f, 'insight-lab'); assert.equal(id, 'u1'); return verdict } },
    '@/types/insight-lab': { calcXP: () => 0 }, '@/lib/insight-lab/techniques': { getTechniquesForPrompt: () => '' },
  }).POST
  const post = (fn, body) => fn(new Request('https://x/api/insight-lab/evaluate', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': '198.51.100.1' } }))
  assert.equal((await post(evaluate(null, null), { answers: { observation: 'o' } })).status, 401)
  assert.equal((await post(evaluate({ id: 'u1' }, null), { answers: {} })).status, 400) // invalid input spends nothing
  assert.equal(budgetCalls, 0)
  const denied = await post(evaluate({ id: 'u1' }, { status: 429, body: { error: 'quota' } }), { challengeId: 'c', answers: { observation: 'o' } })
  assert.equal(denied.status, 429); assert.equal(aiCalls, 0)
  const limited = evaluate({ id: 'u2' }, null)
  const statuses = []
  for (let i = 0; i < 6; i++) statuses.push((await post(limited, { challengeId: 'c', answers: { observation: 'o' } }).catch(() => ({ status: 'err' }))).status)
  assert.equal(statuses.at(-1), 429) // the per-user per-minute limit the route never had
})
