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
function questionsRoute({ budget = null, paused = false, ai = null, rows = [{ hook: '공개된 기사 제목', summary: 's', why_it_matters: 'w' }] } = {}) {
  const calls = { ai: 0, filters: [] }
  const q = { select: s => { calls.filters.push(['select', s]); return q }, eq: (k, v) => { calls.filters.push(['eq', k, v]); return q }, order: () => q, limit: async () => ({ data: rows }) }
  const POST = load('src/app/api/interview/questions/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => q }) },
    '@/lib/ai/gemini': { geminiJson: async () => { calls.ai++; return ai } },
    '@/lib/ai/quiz': { buildTrendDigest: () => 'digest' },
    '@/lib/rate-limit': { checkRateLimit: () => null },
    '@/lib/ai/budget': { checkAiBudget: async () => budget, aiPaused: () => paused },
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

  // An operator stop is reported as such, so the client can skip per-answer feedback and the report.
  const stopped = questionsRoute({ budget: { status: 503, body: { error: 'stop', code: 'ai_paused' } }, paused: true })
  res = await stopped.call()
  assert.equal(res.status, 200); assert.equal(res.body.fallback, 'paused'); assert.equal(res.body.questions.length, 3); assert.equal(stopped.calls.ai, 0)
})

// 2026-11-02 Career Lab resilience: AI stop vs temporary failure, and a result screen that never depends on the AI.
test('AI failures: an operator stop and a spent quota are told apart from temporary errors by code, not by status', () => {
  const kind = (status, code, online = true) => support.aiFailureKind(status, code, online)
  assert.equal(kind(503, 'ai_paused'), 'paused')
  assert.equal(kind(429, 'ai_quota'), 'quota')
  assert.equal(kind(429, undefined), 'rate', 'per-minute limiter has no code')
  assert.equal(kind(503, 'ai_unavailable'), 'unavailable')
  assert.equal(kind(503, undefined), 'unavailable', 'a bare 503 is never taken as a stop')
  assert.equal(kind(500, undefined), 'failed', 'provider error')
  assert.equal(kind(null, undefined), 'failed', 'network error while online')
  assert.equal(kind(503, 'ai_paused', false), 'offline')
  assert.deepEqual(['paused', 'quota', 'rate', 'unavailable', 'failed', 'offline'].map(k => support.aiOffForSession(k)), [true, true, false, false, false, false])

  assert.match(support.apiFailureMessage('feedback', 503, true, 'ai_paused'), /AI 기능이 중지되어 있어 AI 피드백을 받을 수 없어요/)
  assert.doesNotMatch(support.apiFailureMessage('feedback', 503, true, 'ai_paused'), /다시 시도/, 'no retry advice for a stop')
  assert.match(support.apiFailureMessage('report', 429, true, 'ai_quota'), /오늘 AI 사용 한도에 도달해 AI 리포트를/)
  assert.match(support.apiFailureMessage('report', 503, true, 'ai_unavailable'), /리포트를 만들지 못했어요. 잠시 뒤 다시 시도/)
  assert.doesNotMatch(support.apiFailureMessage('report', 500, true), /리포트을/)
})

test('interview client: results come from the local record; AI stop skips later AI calls; one report request at a time', () => {
  const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
  const results = src.slice(src.indexOf('if (stage === "report") return ('))
  // The answer record and the speech summary are direct children of the result screen, not inside {report && (…)}.
  assert.match(results, /\n {6}\{metrics\.some\(Boolean\) && \(\(\) => \{/)
  assert.match(results, /\n {6}\{qa\.length > 0 \? \(\r?\n {8}<section className="mb-6" aria-labelledby="interview-record">/)
  assert.match(results, /\{qa\.map\(\(entry, i\) => \(/)
  assert.match(results, /entry\.feedback \?/)
  assert.match(results, /reportFailure\?\.retry &&/, 'retry only when it can help')
  assert.match(results, /\{report && \(\s+<button onClick=\{shareReport\}/, 'no score card to share without an AI score')
  // Session-wide AI stop: feedback and report requests are skipped once a stop or spent quota is known.
  assert.match(src, /if \(aiOffRef\.current\) \{\s+await advanceWith\(/)
  assert.match(src, /if \(aiOffRef\.current\) \{\s+setReportFailure\(/)
  assert.match(src, /fallback = data\.fallback/)
  assert.match(src, /if \(fallback === "paused"\) markAiOff\("paused"\)/)
  assert.match(src, /if \(reportBusyRef\.current\) return/)
  // The report request carries question and answer only, not the feedback kept for the result screen.
  assert.match(src, /qa: entries\.map\(\(\{ question, answer \}\) => \(\{ question, answer \}\)\)/)
})

test('progress: finish early with at least one answer, warn before leaving, show retry errors on the result screen', () => {
  const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
  const early = src.slice(src.indexOf('async function finishEarly()'), src.indexOf('async function submitAnswer()'))
  assert.match(early, /if \(!entries\.length \|\| grading\) return/, 'no empty result shown as a finished interview')
  assert.match(early, /const draft = feedback \? "" : answer\.trim\(\)/, 'an answer being written is kept, a recorded one not doubled')
  assert.match(early, /speech\(\)\.stop\(\)/) // late results ignored, no restart (tests/interview-lifecycle.test.mjs)
  assert.match(early, /if \(draft\) \{ stopClip\(current\); recordMetrics\(draft\) \}/)
  assert.match(early, /await generateReport\(entries\)/) // which stops camera, recording and speech synthesis
  assert.match(src, /function stopCamera\(\) \{[\s\S]*?reader\(\)\.cancel\(\)[\s\S]*?getTracks\(\)\.forEach\(t => t\.stop\(\)\)/)
  // The button exists only when there is something to show.
  assert.match(src, /\{\(qa\.length > 0 \|\| \(!feedback && !!answer\.trim\(\)\)\) && !\(feedback && current \+ 1 >= questions\.length\) && \(\s+<button onClick=\{finishEarly\}/)
  // beforeunload (and the in-site link check) only while something would be lost, and removed afterwards.
  assert.match(src, /const leaveMessage = leaveWarning\(\{[\s\S]*?answers: inInterview \? qa\.length \+ \(stage === "interview" && !feedback && answer\.trim\(\) \? 1 : 0\) : 0,/)
  assert.match(src, /if \(!leaveMessage\) return[\s\S]*?window\.addEventListener\("beforeunload", warn\)[\s\S]*?window\.removeEventListener\("beforeunload", warn\)/)
  // "새 질문으로 다시" (prep) returns to the result screen on failure: the error must render there.
  const results = src.slice(src.indexOf('if (stage === "report") return ('))
  assert.match(results.slice(0, 400), /\{error && <p role="alert"/)
  const prep = readFileSync('src/components/PrepInterviewClient.tsx', 'utf8')
  assert.match(prep, /throw Object\.assign\(new Error\(data\.error \?\? "질문 생성 실패"\), \{ status: res\.status, code: data\.code \}\)/)
  assert.match(prep, /apiFailureMessage\("questions", status, navigator\.onLine, code\)/)
  assert.match(support.apiFailureMessage('questions', 503, true, 'ai_paused'), /일반 모의면접은 기본 질문으로 진행할 수 있어요/)
})

test('measurements: answer time starts after the question is read; recordings keep their real format; metrics say they are heuristics', () => {
  // Extension from what the browser recorded; nothing is converted, an unknown type gets no extension.
  assert.equal(support.recordingExtension('video/webm;codecs=vp9'), 'webm')
  assert.equal(support.recordingExtension('video/webm'), 'webm')
  assert.equal(support.recordingExtension('video/mp4'), 'mp4') // Safari
  assert.equal(support.recordingExtension('video/mp4;codecs=avc1.42E01E,mp4a.40.2'), 'mp4')
  assert.equal(support.recordingExtension('video/x-matroska;codecs=avc1,opus'), 'mkv')
  assert.equal(support.recordingExtension(''), null)
  assert.equal(support.recordingExtension('video/ogg'), null)

  const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
  // Video mode: the timer restarts when the reading ends, fails, times out or is skipped (behaviour: interview-lifecycle).
  assert.match(src, /const startListening = \(\) => \{\s+qStartRef\.current = Date\.now\(\)/)
  const voiceSrc = readFileSync('src/lib/interview/voice.ts', 'utf8')
  assert.match(voiceSrc, /u\.onend = \(\) => finish\("end"\)/)
  assert.match(voiceSrc, /u\.onerror = \(\) => finish\("end"\)/)
  assert.match(voiceSrc, /\} catch \{ finish\("end"\) \}/)
  // Recording type: the recorder's own, else the one it was started with — never a hard-coded webm guess.
  assert.match(src, /const type = mr\.mimeType \|\| clipMimeRef\.current/)
  assert.doesNotMatch(src, /\|\| "video\/webm"/)
  assert.doesNotMatch(src, /면접답변-\$\{i \+ 1\}\.webm/)
  assert.match(src, /download=\{`marklens-면접답변-\$\{i \+ 1\}\$\{ext \? `\.\$\{ext\}` : ""\}`\}/)
  // Labels: reference values from text and time, not voice analysis; no alarm colours for a word count.
  assert.doesNotMatch(src, /스피치 분석/)
  assert.match(src, /목소리·발음은 분석하지 않아요/)
  assert.doesNotMatch(src, /totalFillers >= 10 \? "text-red-500"/)
  assert.doesNotMatch(src, /fillers >= 5 \? "bg-red-50/)
})

test('interview client: no restart loop after a fatal speech error, typing fallback and question caption in video mode, skip on feedback failure', () => {
  const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
  // The restart loop guard now lives in voice.ts (behaviour: interview-lifecycle "fatal speech error stops for good").
  const voiceSrc = readFileSync('src/lib/interview/voice.ts', 'utf8')
  assert.match(voiceSrc, /if \(isFatal\) \{ fatal = true; o\.onFatal\(message\) \}/)
  assert.match(voiceSrc, /if \(!fatal && o\.autoRestart\(\)\)/)
  assert.match(src, /autoRestart: \(\) => videoModeRef\.current/)
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
