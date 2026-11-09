import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as guard from '../src/lib/release/guard.mjs'

// P9B: while AI is stopped the quiz serves what can be graded without it, and the interview pages say what is available
// before anyone types. Real route and page modules with stubbed I/O; no AI, mail or database.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name === '@/lib/release/guard.mjs') return guard; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, loaded, loaded.exports)
  return loaded.exports
}
const server = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } }
const mc = i => ({ data: { type: 'multiple_choice', question: `객관식 문제 번호 ${i} 입니다 구분용 문장 ${i}`, options: ['a', 'b'], answer: 0, explanation: 'x' } })
const sa = i => ({ data: { type: 'short_answer', question: `단답형 문제 번호 ${i} 입니다 구분용 문장 ${i}`, answer: 'ROAS', explanation: 'x' } })
const PAUSED = { status: 503, body: { error: '중지', code: 'ai_paused' } }

function generator({ aiOff, rows = [], rpcError = null, budget = null, fresh = [] }) {
  const calls = { rpc: [], budget: 0, ai: 0 }
  const { POST } = load('src/app/api/learn/generate/route.ts', {
    'next/server': server, '@/lib/rate-limit': { checkRateLimit: () => null },
    '@/lib/ai/budget': { aiPaused: () => aiOff, checkAiBudget: async () => { calls.budget++; return budget } },
    '@/lib/ai/quiz': { generateQuestions: async () => { calls.ai++; return fresh }, buildTrendDigest: () => 'digest' },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async (name, args) => { assert.equal(name, 'random_quiz'); calls.rpc.push(args); return { data: rows, error: rpcError } }, from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) },
  })
  const generate = (type, count = 2) => POST(new Request('https://x/api/learn/generate', { method: 'POST', body: JSON.stringify({ count, level: 'intermediate', type }) }))
  return { generate, calls }
}

test('quiz, AI stopped: mixed and multiple-choice requests draw multiple choice only; an explicit short-answer choice is kept', async () => {
  for (const type of ['mixed', 'multiple_choice']) {
    const { generate, calls } = generator({ aiOff: true, rows: [sa(1), mc(1), mc(2)] })
    const res = await generate(type)
    assert.equal(calls.rpc[0].p_type, 'multiple_choice', type)
    assert.deepEqual(res.body.questions.map(q => q.type), ['multiple_choice', 'multiple_choice'], 'a short answer in the pool is never served')
    assert.deepEqual([calls.budget, calls.ai], [0, 0], 'enough stored questions: no budget check, no AI')
  }
  const { generate, calls } = generator({ aiOff: true, rows: [sa(1), sa(2)] })
  const res = await generate('short_answer')
  assert.equal(calls.rpc[0].p_type, 'short_answer'); assert.equal(res.body.questions.length, 2)
})

test('quiz, AI working: question types and the AI top-up are unchanged', async () => {
  for (const [type, expected] of [['mixed', null], ['multiple_choice', 'multiple_choice'], ['short_answer', 'short_answer']]) {
    const { generate, calls } = generator({ aiOff: false, rows: [mc(1), sa(2)] })
    const res = await generate(type)
    assert.equal(calls.rpc[0].p_type, expected, type)
    assert.equal(res.body.questions.length, 2, type)
  }
  const short = generator({ aiOff: false, rows: [mc(1)], fresh: [mc(2).data, mc(3).data] })
  assert.equal((await short.generate('mixed', 3)).body.questions.length, 3)
  assert.deepEqual([short.calls.budget, short.calls.ai], [1, 1])
})

test('quiz, AI stopped with too few or no stored questions: what exists is served; none is a stable ai_paused answer; no AI call', async () => {
  const few = generator({ aiOff: true, rows: [mc(1), mc(2)], budget: PAUSED })
  const res = await few.generate('mixed', 10)
  assert.equal(res.status, 200); assert.equal(res.body.questions.length, 2); assert.equal(few.calls.ai, 0)
  for (const options of [{ rows: [] }, { rows: [sa(1)] }, { rows: null, rpcError: { message: 'blocked' } }]) {
    const none = generator({ aiOff: true, budget: PAUSED, ...options })
    const origWarn = console.warn; console.warn = () => {}
    try { assert.equal(await none.generate('mixed', 5), PAUSED, JSON.stringify(options)) } finally { console.warn = origWarn }
    assert.equal(none.calls.ai, 0)
  }
})

test('aiPaused follows the real switches: kill switch, auto pause, public AI off, Preview', () => {
  const { aiPaused } = load('src/lib/ai/budget.ts', { 'next/server': server, '@/lib/supabase/admin': {}, '@/lib/rate-limit': { clientId: () => 'x' } })
  const KEYS = ['VERCEL', 'VERCEL_ENV', 'MARKLENS_DEPLOYMENT', 'AI_KILL_SWITCH', 'AI_AUTO_PAUSED', 'AI_PUBLIC_ENABLED', 'NEXT_PUBLIC_SUPABASE_URL', 'PREVIEW_ALLOW_AI']
  const withEnv = (env, run) => { const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]])); for (const k of KEYS) delete process.env[k]; Object.assign(process.env, env); try { return run() } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } } }
  const prod = { VERCEL: '1', VERCEL_ENV: 'production', AI_PUBLIC_ENABLED: 'on' }
  assert.equal(withEnv(prod, aiPaused), false)
  for (const env of [{ ...prod, AI_KILL_SWITCH: 'on' }, { ...prod, AI_AUTO_PAUSED: 'on' }, { VERCEL: '1', VERCEL_ENV: 'production' }, { VERCEL: '1', VERCEL_ENV: 'preview', AI_PUBLIC_ENABLED: 'on' }]) assert.equal(withEnv(env, aiPaused), true, JSON.stringify(env))
})

const quizHtml = aiOff => {
  const { default: LearnQuiz } = load('src/components/LearnQuiz.tsx', {})
  return renderToStaticMarkup(createElement(LearnQuiz, { aiOff }))
}
const pressed = (html, label) => new RegExp(`aria-pressed="true"[^>]*>${label}`).test(html)

test('quiz screen: with AI stopped it says so before starting and defaults to multiple choice; otherwise it is unchanged', () => {
  const off = quizHtml(true), on = quizHtml(false)
  assert.ok(pressed(off, '객관식만')); assert.ok(off.includes('저장된 객관식 문제로 출제해요'))
  assert.ok(pressed(on, '혼합')); assert.ok(!on.includes('저장된 객관식'))
  const source = readFileSync('src/components/LearnQuiz.tsx', 'utf8')
  assert.match(source, /정확히 일치한 답만 정답이 되고/, 'an explicit short-answer choice is warned')
  assert.match(source, /data\.code === "ai_paused" \? NO_STORED_QUESTIONS : GENERATE_FAILED/)
  assert.match(source, /data\.questions\.length < count/)
})

const page = (file, aiOff, extra = {}) => {
  const { default: Page, metadata } = load(`src/app/(public)/${file}`, {
    '@/components/career/CareerRoom': { default: ({ description, children }) => createElement('main', { 'data-description': description }, children) },
    '@/lib/ai/budget': { aiPaused: () => aiOff }, 'next/link': { default: ({ href, children, ...p }) => createElement('a', { href, ...p }, children) }, ...extra,
  })
  return { html: renderToStaticMarkup(createElement(Page)), metadata }
}

test('custom interview: with AI stopped the notice and the way to the general interview come before the form', () => {
  const form = { '@/components/PrepInterviewClient': { default: () => createElement('form', null, 'FORM') } }
  const off = page('interview/prep/page.tsx', true, form).html, on = page('interview/prep/page.tsx', false, form).html
  assert.ok(off.indexOf('맞춤 질문은 지금 만들 수 없어요') >= 0 && off.indexOf('맞춤 질문은 지금 만들 수 없어요') < off.indexOf('FORM'))
  assert.match(off.slice(0, off.indexOf('FORM')), /href="\/interview"[^>]*>일반 면접 연습하기/)
  assert.ok(!on.includes('맞춤 질문은 지금 만들 수 없어요')); assert.ok(on.includes('FORM'))
})

test('interview page and copy: what is unavailable is stated, and no copy promises AI feedback unconditionally', () => {
  const session = { '@/components/InterviewSession': { default: () => createElement('div', null, 'SESSION') } }
  const off = page('interview/page.tsx', true, session), on = page('interview/page.tsx', false, session)
  assert.ok(off.html.includes('지금은 AI 피드백과 종합 평가를 제공하지 않아요') && off.html.includes('지금은 이용할 수 없어요'))
  assert.ok(!on.html.includes('제공하지 않아요') && !on.html.includes('지금은 이용할 수 없어요'))
  // This notice must not stand in for the real stop notice the interview shows (browser QA P1 looks for that wording).
  assert.ok(!off.html.includes('AI 기능이 중지되어'))
  assert.match(off.metadata.description, /AI 기능이 켜져 있을 때/)
  const prep = page('interview/prep/page.tsx', true, { '@/components/PrepInterviewClient': { default: () => null } })
  assert.doesNotMatch(prep.metadata.description, /AI 피드백까지/); assert.match(prep.metadata.description, /AI 기능이 켜져 있을 때/)
  assert.doesNotMatch(readFileSync('src/app/(public)/practice/page.tsx', 'utf8'), /AI 피드백으로 다듬으세요/)
  assert.doesNotMatch(off.html, /피드백으로 다듬으세요/)
})
