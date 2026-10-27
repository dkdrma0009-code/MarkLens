import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-10-27 quality audit: "화상 면접이 작동하지 않는다". Causes found in code: every step needed Gemini (down since
// 10/25), a refused microphone made speech recognition restart forever in video mode, video mode had no way to answer
// without speech recognition, and camera errors all showed one message. Also the theme toggle gave no feedback on the
// home page, whose first screen is dark in both themes.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, mod, mod.exports)
  return mod.exports
}
const support = load('src/lib/interview/support.ts')
const { fallbackQuestions } = load('src/lib/interview/fallback-questions.ts')

test('camera support and errors: each cause gets its own message and next step', () => {
  assert.equal(support.mediaSupportIssue({ isSecureContext: false, hasGetUserMedia: true }), 'insecure')
  assert.equal(support.mediaSupportIssue({ isSecureContext: true, hasGetUserMedia: false }), 'unsupported')
  assert.equal(support.mediaSupportIssue({ isSecureContext: true, hasGetUserMedia: true }), null)
  const cases = { NotAllowedError: 'denied', PermissionDeniedError: 'denied', SecurityError: 'insecure', NotFoundError: 'no-device', OverconstrainedError: 'no-device', NotReadableError: 'in-use', AbortError: 'in-use', TypeError: 'unsupported', Weird: 'unknown' }
  for (const [name, issue] of Object.entries(cases)) assert.equal(support.classifyMediaError({ name }), issue, name)
  for (const [issue, m] of Object.entries(support.MEDIA_MESSAGES)) assert.ok(m.title && m.action, issue)
  assert.match(support.MEDIA_MESSAGES.denied.action, /허용/)
})

test('speech errors: permission, missing mic, network and language are fatal (no restart loop); pauses are not', () => {
  for (const code of ['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']) {
    const r = support.classifySpeechError(code)
    assert.equal(r.fatal, true, code); assert.match(r.message, /입력창/)
  }
  for (const code of ['no-speech', 'aborted', '']) assert.equal(support.classifySpeechError(code).fatal, false, code)
})

test('recording format: webm first, mp4 for Safari, nothing when unsupported; API failures say what to do', () => {
  assert.equal(support.pickRecorderMime(t => t === 'video/mp4'), 'video/mp4')
  assert.equal(support.pickRecorderMime(() => true), 'video/webm;codecs=vp9')
  assert.equal(support.pickRecorderMime(() => false), null)
  assert.match(support.apiFailureMessage('questions', null, false), /인터넷 연결/)
  assert.match(support.apiFailureMessage('feedback', 429, true), /1분 뒤/)
  assert.match(support.apiFailureMessage('report', 503, true), /AI 사용량/)
  assert.match(support.apiFailureMessage('feedback', 500, true), /AI 피드백 생성에 실패/)
})

test('fallback questions: n questions, trend ones quote real headlines only, no duplicates', () => {
  const q = fallbackQuestions('퍼포먼스 마케팅', 5, ['ChatGPT 광고 89개국, 브랜드가 돈을 내도 AI의 답변은 바꿀 수 없다', '검색은 죽지 않았다'])
  assert.equal(q.length, 5)
  assert.deepEqual(q.slice(0, 2).map(x => x.kind), ['trend', 'trend'])
  assert.match(q[0].question, /"ChatGPT 광고 89개국/)
  assert.equal(new Set(q.map(x => x.question)).size, 5)
  assert.ok(q.slice(2).every(x => x.kind !== 'trend'))
  const none = fallbackQuestions('없는 직무', 3, [])
  assert.equal(none.length, 3); assert.ok(none.every(x => x.kind !== 'trend'))
  assert.equal(fallbackQuestions('CRM 마케팅', 7, ['a', 'b', 'c', 'd']).length, 7)
})

// ── /api/interview/questions with the AI and database mocked ──
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }
function questionsRoute({ budget = null, ai = null, rows = [{ hook: '공개된 기사 제목', summary: 's', why_it_matters: 'w' }] } = {}) {
  const calls = { ai: 0, filters: [] }
  const q = { select: s => { calls.filters.push(['select', s]); return q }, eq: (k, v) => { calls.filters.push(['eq', k, v]); return q }, order: () => q, limit: async () => ({ data: rows }) }
  const POST = load('src/app/api/interview/questions/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => q }) },
    '@/lib/ai/gemini': { geminiJson: async () => { calls.ai++; return ai } },
    '@/lib/ai/quiz': { buildTrendDigest: () => 'digest' },
    '@/lib/rate-limit': { checkRateLimit: () => null },
    '@/lib/ai/budget': { checkAiBudget: async () => budget },
    '@/lib/interview/fallback-questions': { fallbackQuestions },
  }).POST
  const call = () => POST(new Request('https://x/api/interview/questions', { method: 'POST', body: JSON.stringify({ role: '브랜드 마케팅', count: 3 }) }))
  return { call, calls }
}

test('questions API: AI down or budget used up still starts the interview with no AI call; published insights only', async () => {
  const down = questionsRoute({ ai: null })
  let res = await down.call()
  assert.equal(res.status, 200); assert.equal(res.body.fallback, 'ai'); assert.equal(res.body.questions.length, 3)
  assert.match(res.body.questions[0].question, /공개된 기사 제목/)
  assert.ok(down.calls.filters.some(f => f[0] === 'eq' && f[1] === 'article.status' && f[2] === 'published'))

  const budget = questionsRoute({ budget: { status: 503, body: { error: 'quota' } } })
  res = await budget.call()
  assert.equal(res.status, 200); assert.equal(res.body.fallback, 'budget'); assert.equal(budget.calls.ai, 0)

  const ok = questionsRoute({ ai: { questions: [{ question: 'AI 질문', kind: 'role' }] } })
  res = await ok.call()
  assert.deepEqual(res.body, { questions: [{ question: 'AI 질문', kind: 'role' }] })
})

test('interview client: no restart loop after a fatal speech error, typing fallback and question caption in video mode, skip on feedback failure', () => {
  const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
  assert.match(src, /if \(videoModeRef\.current && !stopRequestedRef\.current && !speechFatalRef\.current\)/)
  assert.match(src, /if \(fatal\) \{ speechFatalRef\.current = true; stopRequestedRef\.current = true; setSpeechIssue\(message\) \}/)
  assert.match(src, /\{!speechSupported \|\| speechIssue \? \(/)
  assert.match(src, /<span className="sr-only">면접 질문: <\/span>\{q\.question\}/)
  assert.match(src, /MEDIA_MESSAGES\[camIssue\]\.title/)
  assert.match(src, /카메라 없이 계속/)
  assert.match(src, /await generateReport\(entries\)/)
  assert.doesNotMatch(src, /onClick=\{generateReport\}/) // a click event must never become the report entries
  assert.doesNotMatch(src, /camError/)
})

test('theme toggle: states its current mode and confirms the change', () => {
  const src = readFileSync('src/components/layout/Header.tsx', 'utf8')
  assert.match(src, /aria-pressed=\{dark\}/)
  assert.match(src, /aria-label=\{dark \? "밝은 화면으로 전환" : "어두운 화면으로 전환"\}/)
  assert.match(src, /toast\(next === "dark" \? "어두운 화면으로 바꿨어요" : "밝은 화면으로 바꿨어요"/)
  assert.match(src, /useSyncExternalStore\(noop, \(\) => true, \(\) => false\)/) // no hydration mismatch
})
