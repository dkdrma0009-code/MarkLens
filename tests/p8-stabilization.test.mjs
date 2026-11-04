import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as guard from '../src/lib/release/guard.mjs'

// P8 stabilization: learn/grade (L-1 partial answers, L-2 missing input, L-3 AI stop ≠ wrong answer) and the
// newsletter signup in a Preview without a database. Real route modules with stubbed I/O; no AI, mail or database.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name === '@/lib/release/guard.mjs') return guard; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, loaded, loaded.exports)
  return loaded.exports
}
const server = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } }
const noLimit = { checkRateLimit: () => null }

function grader({ budget = null, ai = async () => 'correct' } = {}) {
  const calls = { budget: 0, ai: 0 }
  const { POST } = load('src/app/api/learn/grade/route.ts', {
    'next/server': server, '@/lib/rate-limit': noLimit,
    '@/lib/ai/budget': { checkAiBudget: async () => { calls.budget++; return typeof budget === 'function' ? budget() : budget } },
    '@/lib/ai/llm': { generateText: async () => { calls.ai++; return ai() } },
  })
  const grade = body => POST(new Request('https://x/api/learn/grade', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))
  return { grade, calls }
}
const Q = '광고비 대비 매출을 뜻하는 지표는?'

test('L-2: missing or empty question, answer key or learner answer is refused (400), never graded correct', async () => {
  const { grade, calls } = grader()
  for (const body of [{}, { question: Q, correctAnswer: 'ROAS' }, { question: Q, userAnswer: 'ROAS' }, { correctAnswer: 'ROAS', userAnswer: 'ROAS' },
    { question: Q, correctAnswer: '', userAnswer: '' }, { question: Q, correctAnswer: 'ROAS', userAnswer: '   ' }, { question: Q, correctAnswer: null, userAnswer: 'undefined' },
    { question: Q, correctAnswer: { x: 1 }, userAnswer: '[object Object]' }, 'not json']) {
    const res = await grade(body)
    assert.equal(res.status, 400, JSON.stringify(body)); assert.equal(res.body.code, 'invalid_input'); assert.equal(res.body.result, undefined)
  }
  // before P8, String(undefined) === String(undefined) made both-missing a correct answer
  const tooLong = await grade({ question: Q, correctAnswer: 'ROAS', userAnswer: 'x'.repeat(501) })
  assert.equal(tooLong.status, 400)
  assert.deepEqual(calls, { budget: 0, ai: 0 }, 'invalid input spends no quota and calls no AI')
})

test('L-1: a fragment or a single character is not auto-correct; full answers and aliases still are', async () => {
  const { grade, calls } = grader()
  const verdict = async (correctAnswer, userAnswer) => (await grade({ question: Q, correctAnswer, userAnswer })).body.result
  // previously "correct" because the answer key contains the input
  for (const [key, user] of [['광고비 대비 매출', '광'], ['ROAS', 'R'], ['ROAS', 'a'], ['광고비 대비 매출', '?!'], ['SEO', '.']]) {
    assert.equal(await verdict(key, user), 'incorrect', `${key} / ${user}`)
  }
  assert.deepEqual(calls, { budget: 0, ai: 0 }, 'decided without AI')
  // normal answers are not judged more strictly
  for (const [key, user] of [['ROAS', 'roas'], ['ROAS', ' ROAS '], ['광고비 대비 매출', '광고비대비매출'], ['검색엔진 최적화(SEO)', 'seo'], ['검색엔진 최적화(SEO)', '검색엔진 최적화'],
    ['ROAS', 'ROAS입니다'], ['4P', '4p'], ['CTR', '답은 CTR']]) {
    assert.equal(await verdict(key, user), 'correct', `${key} / ${user}`)
  }
  assert.deepEqual(calls, { budget: 0, ai: 0 })
  // a partial answer of two or more characters goes to the grader instead of being accepted outright
  assert.equal(await verdict('광고비 대비 매출', '광고비'), 'correct') // the stub grader says correct
  assert.deepEqual(calls, { budget: 1, ai: 1 })
  const strict = grader({ ai: async () => 'incorrect' })
  assert.equal((await strict.grade({ question: Q, correctAnswer: '광고비 대비 매출', userAnswer: '광고비' })).body.result, 'incorrect')
})

test('L-3: AI stopped, quota spent or grading failed is reported as ungraded (code), never as a wrong answer', async () => {
  const paused = { status: 503, body: { error: 'AI 기능이 일시 중지되어 있습니다.', code: 'ai_paused' } }
  const quota = { status: 429, body: { error: '한도', code: 'ai_quota' } }
  for (const budget of [paused, quota]) {
    const { grade, calls } = grader({ budget })
    const res = await grade({ question: Q, correctAnswer: '광고비 대비 매출', userAnswer: '매출 대비' })
    assert.equal(res, budget); assert.equal(res.body.result, undefined); assert.equal(calls.ai, 0)
  }
  for (const ai of [async () => { throw new Error('provider down') }, async () => '', async () => '정답입니다', async () => 'maybe']) {
    const { grade } = grader({ ai })
    const res = await grade({ question: Q, correctAnswer: '광고비 대비 매출', userAnswer: '매출 대비' })
    assert.equal(res.status, 503); assert.equal(res.body.code, 'ai_unavailable'); assert.equal(res.body.result, undefined)
  }
  // the quota check still precedes the first AI call (ai-budget.test.mjs contract)
  const source = readFileSync('src/app/api/learn/grade/route.ts', 'utf8')
  assert.ok(source.indexOf('checkAiBudget(req, "learn"') < source.indexOf('generateText(', source.indexOf('export async function POST')))
})

test('L-3 client: only a correct/incorrect verdict is scored; ungraded answers are shown and counted apart from wrong ones', () => {
  const quiz = readFileSync('src/components/LearnQuiz.tsx', 'utf8')
  assert.match(quiz, /if \(data\.result === "correct" \|\| data\.result === "incorrect"\)/)
  assert.match(quiz, /const wrong = results\.filter\(r => r === false\)\.length/)
  assert.match(quiz, /오답 \{wrong\}개/)
  assert.doesNotMatch(quiz, /questions\.length - score/, 'wrong count no longer includes ungraded questions')
  assert.match(quiz, /채점 불가 \{ungraded\}개/)
})

function subscribeRoute(env) {
  const created = [], mail = [], errors = []
  const real = load('src/lib/supabase/guard.ts', {})
  const admin = load('src/lib/supabase/admin.ts', { '@supabase/supabase-js': { createClient: (url) => { created.push(url); return { rpc: async () => ({ data: null, error: { code: '23505', message: 'boom' } }) } } }, './guard': real })
  const { POST } = load('src/app/api/subscribe/route.ts', {
    'next/server': server, '@/lib/rate-limit': noLimit, '@/lib/supabase/admin': admin,
    '@/lib/newsletter/confirmation-mail.mjs': { confirmationUrl: () => 'https://x/c', sendConfirmEmail: async () => { mail.push(1) } },
  })
  const KEYS = ['VERCEL', 'VERCEL_ENV', 'MARKLENS_DEPLOYMENT', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const run = async body => {
    const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]])), origError = console.error
    for (const k of KEYS) delete process.env[k]
    Object.assign(process.env, env); console.error = (...a) => errors.push(a.join(' '))
    try { return await POST(new Request('https://x/api/subscribe', { method: 'POST', body })) }
    finally { console.error = origError; for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } }
  }
  return { run, created, mail, errors }
}

test('newsletter: a Preview without a database answers 503 db_blocked (no retry advice, no mail); real failures stay 500', async () => {
  const preview = subscribeRoute({ VERCEL: '1', VERCEL_ENV: 'preview', MARKLENS_DEPLOYMENT: 'preview' })
  const blocked = await preview.run(JSON.stringify({ email: 'reader@example.test', source: 'qa' }))
  assert.equal(blocked.status, 503); assert.equal(blocked.body.code, 'db_blocked'); assert.doesNotMatch(blocked.body.error, /다시 시도/)
  assert.deepEqual([preview.created, preview.mail, preview.errors], [[], [], []], 'no client, no mail, no error log')
  // a genuine database failure in production is still a server error with the retry message
  const prod = subscribeRoute({ VERCEL: '1', VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://prodref000000000000.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'x' })
  const failed = await prod.run(JSON.stringify({ email: 'reader@example.test' }))
  assert.equal(failed.status, 500); assert.equal(failed.body.code, undefined); assert.equal(prod.created.length, 1); assert.equal(prod.mail.length, 0)
  // malformed bodies are a 400, not an unhandled 500
  for (const body of ['not json', JSON.stringify({ email: 42 }), JSON.stringify({})]) assert.equal((await prod.run(body)).status, 400, body)
  // both signup forms show the server's explanation for db_blocked instead of "다시 시도해주세요"
  for (const file of ['src/app/(public)/newsletter/NewsletterClient.tsx', 'src/components/NewsletterInlineCta.tsx']) {
    const src = readFileSync(file, 'utf8')
    assert.ok(src.indexOf('data.code === "db_blocked"') > 0 && src.indexOf('data.code === "db_blocked"') < src.indexOf('throw new Error()'), file)
  }
})
