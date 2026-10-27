import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-10-27 P0 follow-up: a transient Gemini error must not bench Gemini for the rest of the daily run, an answer
// that is not JSON is a failure (retried, alerted) rather than a permanent rejection, and the admin alert reports
// every way it can end without a sent mail. Mocked responses only — no AI call, no mail, no database.
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
const deadProviders = {
  '@anthropic-ai/sdk': { __esModule: true, default: class { constructor() { this.messages = { create: async () => { throw Object.assign(new Error('Your credit balance is too low'), { status: 400 }) } } } } },
  openai: { __esModule: true, default: class { constructor() { this.chat = { completions: { create: async () => { throw Object.assign(new Error('You exceeded your current quota'), { status: 429 }) } } } } } },
}
const geminiOk = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) })
const geminiErr = (code, status, message) => ({ ok: false, status: code, json: async () => ({ error: { code, status, message } }) })

test('bench vs retry: key, permission, quota, billing, credit and timeouts bench a provider; fast transient errors do not', () => {
  const { benchesProvider } = load('src/lib/ai/llm.ts', deadProviders)
  for (const msg of [
    'flash-lite: Gemini error 429 RESOURCE_EXHAUSTED Quota exceeded / flash: Gemini error 429 RESOURCE_EXHAUSTED',
    'Gemini error 400 INVALID_ARGUMENT API key not valid. Please pass a valid API key.',
    'Gemini error 403 PERMISSION_DENIED',
    'Gemini error 400 FAILED_PRECONDITION User location is not supported / billing',
    '400 Your credit balance is too low',
    // each retry would wait up to 2×60s and can push the collect cron past 300s before it alerts
    'flash-lite: The operation was aborted due to timeout / flash: The operation was aborted due to timeout',
  ]) assert.equal(benchesProvider(new Error(msg)), true, msg)
  for (const msg of [
    'Gemini error 503 UNAVAILABLE The model is overloaded',
    'Gemini empty response (gemini-2.5-flash, finishReason=MAX_TOKENS)',
    'fetch failed',
  ]) assert.equal(benchesProvider(new Error(msg)), false, msg)
})

test('a transient Gemini failure is retried on the next call instead of being skipped for 30 minutes', async () => {
  const realFetch = globalThis.fetch
  process.env.GEMINI_API_KEY = KEY
  let calls = 0
  globalThis.fetch = async () => (++calls <= 2 ? geminiErr(503, 'UNAVAILABLE', 'The model is overloaded') : geminiOk('{"hook":"ok"}'))
  try {
    const { generateText } = load('src/lib/ai/llm.ts', deadProviders)
    await assert.rejects(generateText({ system: 's', prompt: 'p' }), /gemini: flash-lite: Gemini error 503 UNAVAILABLE/)
    assert.equal(await generateText({ system: 's', prompt: 'p' }), '{"hook":"ok"}')
  } finally { globalThis.fetch = realFetch; delete process.env.GEMINI_API_KEY }
})

test('a quota failure still benches Gemini, and the skip message keeps the original error', async () => {
  const realFetch = globalThis.fetch
  process.env.GEMINI_API_KEY = KEY
  let calls = 0
  globalThis.fetch = async () => { calls++; return geminiErr(429, 'RESOURCE_EXHAUSTED', `Quota exceeded (key=${KEY})`) }
  try {
    const { generateText } = load('src/lib/ai/llm.ts', deadProviders)
    await assert.rejects(generateText({ system: 's', prompt: 'p' }), /RESOURCE_EXHAUSTED/)
    await assert.rejects(generateText({ system: 's', prompt: 'p' }), err => {
      assert.match(err.message, /gemini: 건너뜀\(최근 실패 — flash-lite: Gemini error 429/)
      assert.ok(!err.message.includes(KEY))
      return true
    })
    assert.equal(calls, 2) // lite + flash once; the second call did not reach Gemini
  } finally { globalThis.fetch = realFetch; delete process.env.GEMINI_API_KEY }
})

test('analysis: an answer that is not JSON throws (system failure); JSON without a hook is still a content rejection', async () => {
  let answer = ''
  const { analyzeArticle } = load('src/lib/ai/analyze.ts', { '@/lib/ai/llm': { generateText: async () => answer } })
  const article = { title: 'Title', content: 'x'.repeat(200), url: 'https://example.com/a' }
  answer = '죄송합니다. 요청을 처리할 수 없습니다.'
  await assert.rejects(analyzeArticle(article), /^Error: AI 응답 형식 오류: JSON 없음/)
  answer = '{"hook": "잘린 응답, "summary": '
  await assert.rejects(analyzeArticle(article), /AI 응답 형식 오류: (JSON 없음|JSON 해석 실패)/)
  answer = '{"category":"branding","summary":"요약만 있음"}'
  const insight = await analyzeArticle(article)
  assert.equal(insight.hook, '')
})

test('admin alert: trims the recipient, reports a refused send without the address or key, and logs a skipped one', async () => {
  const realFetch = globalThis.fetch, realError = console.error
  const logs = []
  console.error = (...a) => logs.push(a.join(' '))
  let sent
  try {
    const { sendAdminAlert } = load('src/lib/alert.ts')
    process.env.ADMIN_EMAIL = '﻿owner@example.com\n'
    process.env.BREVO_API_KEY = ' xkeysib-FAKEFAKE\n'
    globalThis.fetch = async (_url, init) => { sent = JSON.parse(init.body); return { ok: true, status: 201, text: async () => '' } }
    assert.equal(await sendAdminAlert('기사 분석 실패', 'm'), true)
    assert.deepEqual(sent.to, [{ email: 'owner@example.com' }])

    globalThis.fetch = async () => ({ ok: false, status: 400, text: async () => '{"code":"invalid_parameter","message":"email is not valid in to: owner@example.com"}' })
    assert.equal(await sendAdminAlert('기사 분석 실패', 'm'), false)
    assert.match(logs.at(-1), /이메일 발송 거부 "기사 분석 실패": Brevo 400 .*invalid_parameter/)
    assert.ok(!logs.at(-1).includes('owner@example.com') && !logs.at(-1).includes('xkeysib'))

    delete process.env.ADMIN_EMAIL
    assert.equal(await sendAdminAlert('기사 분석 실패', 'm'), false)
    assert.match(logs.at(-1), /미발송 "기사 분석 실패": ADMIN_EMAIL 없음/)
  } finally {
    globalThis.fetch = realFetch; console.error = realError
    delete process.env.ADMIN_EMAIL; delete process.env.BREVO_API_KEY
  }
})
