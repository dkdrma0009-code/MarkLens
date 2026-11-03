import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-11-03 Career Lab lifecycle fixes (independent review B-1…B-11). The voice lifecycle (src/lib/interview/voice.ts)
// is driven here through real state transitions with a fake recognizer, a fake speech synthesizer and manual timers:
// events arrive late and out of order the way browsers deliver them. No browser, microphone or AI provider is used.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const mod = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; if (name.startsWith('@/') || name.startsWith('.')) throw new Error('unmocked ' + name); return require(name) }, mod, mod.exports)
  return mod.exports
}
const voice = load('src/lib/interview/voice.ts')
const support = load('src/lib/interview/support.ts')

// ── fake Web Speech recognition: start/abort only change flags; results and end arrive when the test says so ──
function fakeRecognizer() {
  return {
    onresult: null, onend: null, onerror: null, running: false, aborted: false,
    start() { this.running = true }, stop() { this.aborted = true }, abort() { this.aborted = true },
    say(text, isFinal = true) { this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript: text } } } }) },
    end() { this.running = false; this.onend?.() },
    fail(code) { this.onerror?.({ error: code }) },
  }
}
function speechHarness({ videoMode = false } = {}) {
  const recs = [], timers = []
  const state = { answer: '', listening: false, fatal: '' }
  const input = voice.createSpeechInput({
    create: () => { const r = fakeRecognizer(); recs.push(r); return r },
    baseText: () => state.answer,
    onText: t => { state.answer = t },
    onListening: on => { state.listening = on },
    onFatal: m => { state.fatal = m },
    autoRestart: () => videoMode,
    classifyError: support.classifySpeechError,
    schedule: fn => { timers.push(fn) },
  })
  return { input, recs, state, runTimers: () => { while (timers.length) timers.shift()() }, timers }
}

// ── fake speech synthesis: cancel() fires error on every pending utterance, like browsers do ──
function readerHarness({ synthesis = true } = {}) {
  const timers = new Map(); let id = 0
  const synth = {
    pending: [], cancels: 0,
    speak(u) { this.pending.push(u) },
    cancel() { this.cancels++; for (const u of this.pending.splice(0)) u.onerror?.() },
    finish() { const u = this.pending.shift(); u?.onend?.() }, // the reading ends normally
  }
  const events = []
  const reader = voice.createQuestionReader({
    synth: () => (synthesis ? synth : null),
    utterance: text => ({ text, onend: null, onerror: null }),
    onReading: on => events.push(on ? 'reading' : 'idle'),
    onTimeout: () => events.push('timeout'),
    setTimer: (fn, ms) => { timers.set(++id, { fn, ms }); return id },
    clearTimer: i => { timers.delete(i) },
  })
  const fireTimers = () => { for (const [k, t] of [...timers]) { timers.delete(k); t.fn() } }
  return { reader, synth, events, timers, fireTimers }
}

test('B-1 replay: after the question is read again the microphone restarts and keeps the answer so far', () => {
  const s = speechHarness({ videoMode: true }), r = readerHarness()
  s.input.start(); s.recs[0].say('저는 데이터로')
  assert.equal(s.state.listening, true)
  // 🔊 다시 듣기: stop listening, read, then listen again
  s.input.stop()
  r.reader.read('질문입니다', () => s.input.start())
  s.recs[0].end() // the stopped recognizer shuts down (late)
  assert.equal(s.recs.length, 1, 'no recognizer while the question is read')
  r.synth.finish()
  assert.equal(s.recs.length, 2, 'listening again after the reading')
  assert.equal(s.state.listening, true)
  s.recs[1].say('성과를 냈습니다')
  assert.equal(s.state.answer, '저는 데이터로 성과를 냈습니다')
  s.runTimers()
  assert.equal(s.recs.length, 2, 'the old recognizer does not restart itself')
})

test('B-1 replay when the reading ends before the stopped recognizer: the new one starts once the old has ended', () => {
  const s = speechHarness({ videoMode: true }), r = readerHarness()
  s.input.start()
  s.input.stop()
  r.reader.read('짧은 질문', () => s.input.start())
  r.synth.finish()
  assert.equal(s.recs.length, 1, 'waits for the old recognition to end (one at a time), no guessed delay')
  s.recs[0].end()
  assert.equal(s.recs.length, 2); assert.equal(s.state.listening, true)
})

test('B-1 retry speaking: the answer is cleared, late results of the old attempt are ignored, listening restarts', () => {
  const s = speechHarness({ videoMode: true })
  s.input.start(); s.recs[0].say('첫 시도')
  // 🔁 다시 말하기 (retrySpeak): stop, clear, start
  s.input.stop(); s.state.answer = ''; s.input.start()
  s.recs[0].say('첫 시도 마지막 단어') // final result delivered after stop
  assert.equal(s.state.answer, '')
  s.recs[0].end()
  assert.equal(s.recs.length, 2)
  s.recs[1].say('두 번째 시도')
  assert.equal(s.state.answer, '두 번째 시도')
})

test('B-1 submit or finish while the question is being re-read: the microphone stays off', () => {
  for (const how of ['submit', 'finish']) {
    const s = speechHarness({ videoMode: true }), r = readerHarness()
    let onEnd = 0
    s.input.start(); s.input.stop()
    r.reader.read('질문', () => { onEnd++; s.input.start() })
    // submitAnswer: speech.stop() + reader.cancel(); finishEarly → generateReport: speech.stop() + stopCamera → reader.cancel()
    s.input.stop(); r.reader.cancel()
    s.recs[0].end()
    r.synth.finish() // nothing pending any more; a late end would also be ignored
    s.runTimers()
    assert.equal(onEnd, 0, how)
    assert.equal(s.recs.length, 1, `${how}: no recognizer after the answer is done`)
    assert.equal(s.state.listening, false, how)
    assert.equal(r.events.at(-1), 'idle', how)
  }
})

test('B-2 quick question change: late result, end and error of the previous recognizer never touch the next answer', () => {
  const s = speechHarness({ videoMode: true })
  s.input.start(); s.recs[0].say('첫 번째 질문 답변', false)
  // submit (AI stopped: no waiting for a request) and the next question is on screen at once
  s.input.stop(); s.state.answer = ''
  s.recs[0].say('첫 번째 질문 답변 끝') // the final result arrives after stop()
  s.recs[0].fail('aborted')
  s.recs[0].end()
  s.runTimers()
  assert.equal(s.state.answer, '', 'nothing from question 1 in question 2')
  assert.equal(s.recs.length, 1, 'the previous recognizer did not restart itself')
  assert.equal(s.state.listening, false)
  // question 2: the reading ends, listening starts fresh
  s.input.start()
  assert.equal(s.recs.length, 2)
  s.recs[1].say('두 번째 답변')
  assert.equal(s.state.answer, '두 번째 답변')
})

test('B-2 events arriving after the interview ended change nothing (no text, no restart, no fatal state)', () => {
  const s = speechHarness({ videoMode: true })
  s.input.start(); s.recs[0].say('마지막 답변')
  s.input.stop() // generateReport
  const after = s.state.answer
  s.recs[0].say('늦은 결과'); s.recs[0].fail('not-allowed'); s.recs[0].end(); s.runTimers()
  assert.equal(s.state.answer, after); assert.equal(s.state.fatal, ''); assert.equal(s.recs.length, 1); assert.equal(s.state.listening, false)
})

test('video mode keeps listening through silence; a stop during the restart window cancels the restart', () => {
  const s = speechHarness({ videoMode: true })
  s.input.start(); s.recs[0].end() // silence ended the recognition
  assert.equal(s.state.listening, false); assert.equal(s.timers.length, 1)
  s.runTimers()
  assert.equal(s.recs.length, 2, 'restarted'); assert.equal(s.state.listening, true)
  s.recs[1].end()
  s.input.stop() // answer submitted inside the 250 ms window
  s.runTimers()
  assert.equal(s.recs.length, 2, 'no restart after stop')
  const basic = speechHarness({ videoMode: false })
  basic.input.start(); basic.recs[0].end(); basic.runTimers()
  assert.equal(basic.recs.length, 1, 'basic mode: the mic button decides')
})

test('fatal speech error stops for good; a second start while listening creates no second recognizer', () => {
  const s = speechHarness({ videoMode: true })
  s.input.start(); s.input.start()
  assert.equal(s.recs.length, 1)
  s.recs[0].fail('not-allowed'); s.recs[0].end(); s.runTimers()
  assert.match(s.state.fatal, /입력창/)
  s.input.start()
  assert.equal(s.recs.length, 1, 'no restart loop after a refused microphone')
})

test('B-5 reading: ends normally once; timer cleared', () => {
  const r = readerHarness()
  let ends = 0
  r.reader.read('질문입니다', () => ends++)
  assert.deepEqual(r.events, ['reading']); assert.equal(r.timers.size, 1)
  r.synth.finish()
  assert.equal(ends, 1); assert.deepEqual(r.events, ['reading', 'idle']); assert.equal(r.timers.size, 0)
})

test('B-5 reading: neither end nor error arrives → timeout says so, stops the voice and lets the answer start', () => {
  const r = readerHarness()
  let ends = 0
  r.reader.read('끝 이벤트가 오지 않는 질문', () => ends++)
  r.synth.pending.length = 0 // the browser lost the utterance: no event will ever come
  r.fireTimers()
  assert.equal(ends, 1); assert.deepEqual(r.events, ['reading', 'idle', 'timeout']); assert.ok(r.synth.cancels >= 2)
  r.reader.skip(); r.fireTimers()
  assert.equal(ends, 1, 'never twice')
})

test('B-5 reading: the user can skip; a late end of the skipped reading is ignored', () => {
  const r = readerHarness()
  let ends = 0
  r.reader.read('질문', () => ends++)
  const u = r.synth.pending[0]
  r.reader.skip()
  assert.equal(ends, 1); assert.equal(r.timers.size, 0)
  u.onend?.()
  assert.equal(ends, 1)
})

test('B-5 reading: a new question cancels the previous reading without running its callback', () => {
  const r = readerHarness()
  const calls = []
  r.reader.read('질문 1', () => calls.push(1))
  r.reader.read('질문 2', () => calls.push(2)) // cancel() inside fires error on question 1's utterance
  r.synth.finish()
  r.fireTimers()
  assert.deepEqual(calls, [2])
  const none = readerHarness({ synthesis: false })
  let ended = 0
  none.reader.read('질문', () => ended++)
  assert.equal(ended, 1, 'no speech synthesis: answering starts at once')
})

test('B-5 timeout length follows the question: 32–107 character questions get ~10–25 s, capped at 45 s', () => {
  assert.equal(voice.readingTimeoutMs('가'.repeat(32)), 10_400)
  assert.equal(voice.readingTimeoutMs('가'.repeat(107)), 25_400)
  assert.equal(voice.readingTimeoutMs('가'.repeat(1000)), 45_000)
  const r = readerHarness()
  r.reader.read('가'.repeat(107))
  assert.equal([...r.timers.values()][0].ms, 25_400)
})

test('B-4 leaving: what would be lost, and which clicks leave the page', () => {
  assert.equal(support.leaveWarning({ answers: 0, recordings: 0, finished: false }), '')
  assert.match(support.leaveWarning({ answers: 2, recordings: 1, finished: false }), /답변 2개, 영상 1개/)
  assert.match(support.leaveWarning({ answers: 1, recordings: 0, finished: false }), /^진행 중인 면접 기록\(답변 1개\)/)
  assert.equal(support.leaveWarning({ answers: 3, recordings: 0, finished: true }), '', 'result screen: answers are on screen')
  assert.match(support.leaveWarning({ answers: 0, recordings: 2, finished: true }), /영상 2개는 이 브라우저에만/)
  const here = 'https://marklens.site/interview'
  const leave = (href, link = {}, click = {}) => support.isInSiteLeave({ href, ...link }, { button: 0, modified: false, ...click }, here)
  assert.equal(leave('/practice'), true, 'Career Lab back link')
  assert.equal(leave('https://marklens.site/interview/prep'), true)
  assert.equal(leave('/interview?x=1'), true)
  assert.equal(leave('/practice', { target: '_self' }), true)
  assert.equal(leave('/interview'), false, 'same page')
  assert.equal(leave('/interview#top'), false, 'same page anchor')
  assert.equal(leave('https://example.com/'), false, 'other site: beforeunload asks')
  assert.equal(leave('blob:https://marklens.site/abc', { download: true }), false, 'recording download')
  assert.equal(leave('/practice', { target: '_blank' }), false, 'new tab keeps this one')
  assert.equal(leave('/practice', {}, { modified: true }), false)
  assert.equal(leave('/practice', {}, { button: 1 }), false)
})

// ── API routes with the AI and the quota mocked ──
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }
function feedbackRoute({ budget = null, ai = { good: 'g', improve: 'i', model_answer: 'm', star: null } } = {}) {
  const calls = { budget: 0, ai: 0, prompts: [] }
  const POST = load('src/app/api/interview/feedback/route.ts', {
    'next/server': { NextResponse },
    '@/lib/ai/gemini': { geminiJson: async (_s, prompt) => { calls.ai++; calls.prompts.push(prompt); return ai } },
    '@/lib/rate-limit': { checkRateLimit: () => null },
    '@/lib/ai/budget': { checkAiBudget: async () => { calls.budget++; return budget } },
  }).POST
  const post = body => POST(new Request('https://x/api/interview/feedback', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }))
  return { post, calls }
}

test('B-7 feedback API: question must be a string of at most 500 characters; refused input spends no quota and no AI call', async () => {
  const f = feedbackRoute()
  for (const body of [{ question: '가'.repeat(501), answer: '답변' }, { question: 42, answer: '답변' }, { question: ['q'], answer: '답변' }, { question: '   ', answer: '답변' }, { answer: '답변' }, { question: '질문' }, '{not json', 'null']) {
    const res = await f.post(body)
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40))
  }
  assert.match((await f.post({ question: '가'.repeat(501), answer: '답변' })).body.error, /500자 이하/)
  assert.deepEqual([f.calls.budget, f.calls.ai], [0, 0])

  const ok = await f.post({ question: '가'.repeat(500), answer: '답변', role: '브랜드 마케팅' })
  assert.equal(ok.status, 200); assert.equal(f.calls.ai, 1)
  assert.ok(f.calls.prompts[0].includes('가'.repeat(500)), 'a 500-character question reaches the model unchanged')
})

test('feedback API: a normal answer gets the AI feedback; a budget refusal returns before any AI call', async () => {
  const f = feedbackRoute()
  const res = await f.post({ question: '최근 캠페인에서 성과를 어떻게 측정했나요?', answer: 'ROAS와 전환율로 측정했습니다.', role: '퍼포먼스 마케팅', context: '자소서 요약' })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { good: 'g', improve: 'i', model_answer: 'm', star: null })
  assert.match(f.calls.prompts[0], /지원자 답변: ROAS와 전환율로 측정했습니다\./)

  const stopped = feedbackRoute({ budget: { status: 503, body: { error: 'stop', code: 'ai_paused' } } })
  const r = await stopped.post({ question: '질문', answer: '답변' })
  assert.deepEqual([r.status, r.body.code, stopped.calls.ai], [503, 'ai_paused', 0])

  const failed = feedbackRoute({ ai: null })
  assert.equal((await failed.post({ question: '질문', answer: '답변' })).status, 500)
})

// ── InterviewSession wiring. No DOM test runtime is installed (no new dependency), so the component itself is checked
//    by structure; the behaviour it relies on is exercised above. ──
const src = readFileSync('src/components/InterviewSession.tsx', 'utf8')
const fn = (name, next) => src.slice(src.indexOf(name), src.indexOf(next, src.indexOf(name) + name.length))

test('B-1/B-2/B-5 wiring: every stop goes through the voice controllers, no stale-state guard or timed restart is left', () => {
  assert.doesNotMatch(src, /stopRequestedRef|speechFatalRef|recRef|function startSpeech|function speak\(/)
  assert.doesNotMatch(src, /setTimeout\(\(\) => \{[^}]*start/, 'no restart hidden behind a timer')
  assert.match(fn('function replayQuestion()', '\n  }'), /speech\(\)\.stop\(\)\s+reader\(\)\.read\(/)
  assert.match(fn('function retrySpeak()', '\n  }'), /speech\(\)\.stop\(\)[\s\S]*setAnswer\(""\)\s+speech\(\)\.start\(\)/)
  const submit = fn('async function submitAnswer()', 'async function advanceWith')
  assert.match(submit, /speech\(\)\.stop\(\)[^\n]*\n\s+reader\(\)\.cancel\(\)/, 'submit stops listening and any re-reading before the next question')
  assert.match(fn('async function finishEarly()', 'async function submitAnswer()'), /speech\(\)\.stop\(\)/)
  const report = fn('async function generateReport(', 'async function next()')
  assert.match(report, /speech\(\)\.stop\(\)[^\n]*\n\s+stopCamera\(\)/)
  assert.match(fn('function stopCamera()', '\n  }'), /reader\(\)\.cancel\(\)/)
  // answer time starts only when the reading ended, was skipped or timed out
  assert.match(src, /const startListening = \(\) => \{\s+qStartRef\.current = Date\.now\(\)\s+if \(speechSupported\) speech\(\)\.start\(\)/)
  assert.match(src, /if \(text\) reader\(\)\.read\(text, startListening\)/)
  assert.match(src, /onClick=\{\(\) => reader\(\)\.skip\(\)\}/)
  assert.match(src, /onTimeout: \(\) => setReadingNotice\(READING_TIMEOUT_MESSAGE\)/)
  assert.match(src, /\{readingNotice && <p role="status"/)
})

test('B-3 restart: the previous result is released only after the new questions arrived; a camera opened for it is closed on failure', () => {
  const start = fn('async function start(', '// 스피치 지표 측정')
  const got = start.indexOf('newQuestions = data.questions'), revoke = start.indexOf('URL.revokeObjectURL'), set = start.indexOf('setQuestions(newQuestions)')
  assert.ok(got > 0 && revoke > got && set > revoke, 'revoke after the questions arrived, before the new interview starts')
  for (const reset of ['setClips([])', 'setMetrics([])', 'setReportFailure(null)', 'setAiOff(null)']) {
    assert.ok(start.indexOf(reset) > got, `${reset} only on success`)
  }
  assert.match(start, /const openedCamera = videoMode && !camStreamRef\.current \? await openCamera\(\) : false/)
  assert.match(start.slice(start.indexOf('} catch (err)')), /if \(openedCamera\) stopCamera\(\)\s+setStage\(prevStage\)/)
})

test('B-4 wiring: in-site links, restart, change role and prep "정보 수정" ask first when a record would be lost', () => {
  assert.match(src, /document\.addEventListener\("click", onClick, true\)/)
  assert.match(src, /e\.preventDefault\(\)\s+e\.stopPropagation\(\)/)
  assert.match(src, /window\.addEventListener\("beforeunload", warn\)/)
  assert.match(src, /onClick=\{\(\) => \{ if \(confirmLeave\(\)\) void start\("report"\) \}\}/)
  assert.match(src, /if \(!confirmLeave\(\)\) return\s+stopCamera\(\)/)
  const prep = readFileSync('src/components/PrepInterviewClient.tsx', 'utf8')
  assert.match(prep, /if \(leaveWarningRef\.current && !window\.confirm\(leaveWarningRef\.current\)\) return/)
  assert.match(prep, /onClick=\{editInfo\}/)
  assert.match(prep, /onLeaveWarningChange=\{setLeaveWarning\}/)
})

test('B-8…B-11: answer time fixed at first submission, typed answers are not voice, late camera answers released, recordings freed on unmount', () => {
  assert.match(fn('function recordMetrics(', '\n  }'), /const end = answerEndRef\.current \?\?= Date\.now\(\)[\s\S]*sec: Math\.round\(\(end - qStartRef\.current\) \/ 1000\)/)
  assert.match(src, /answerEndRef\.current = null/)
  assert.match(src, /onText: text => \{ voiceUsedRef\.current = true;/)
  assert.equal(src.match(/voiceUsedRef\.current = true/g).length, 1, 'only recognized speech marks an answer as voice')
  const cam = fn('async function openCamera()', 'function markAiOff')
  assert.match(cam, /const request = \+\+camRequestRef\.current/)
  assert.match(cam, /if \(stale\(\)\) \{ stream\.getTracks\(\)\.forEach\(t => t\.stop\(\)\); return false \}/)
  assert.match(fn('function stopCamera()', '\n  }'), /camRequestRef\.current\+\+/)
  assert.match(src, /clipsRef\.current\.forEach\(c => \{ if \(c\) URL\.revokeObjectURL\(c\.url\) \}\)/)
})
