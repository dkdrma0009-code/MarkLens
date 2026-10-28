import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Stage 2 failure scenarios end to end through the real analyze-pending route, analyzeArticle and the provider chain:
// only Gemini's HTTP answer, the dead fallback providers and the database are mocked. No AI call, no mail.
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
const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) }
const dead = {
  '@anthropic-ai/sdk': { __esModule: true, default: class { constructor() { this.messages = { create: async () => { throw Object.assign(new Error('Your credit balance is too low'), { status: 400 }) } } } } },
  openai: { __esModule: true, default: class { constructor() { this.chat = { completions: { create: async () => { throw Object.assign(new Error('You exceeded your current quota'), { status: 429 }) } } } } } },
}
const ANALYSIS = JSON.stringify({ category: 'ai-marketing', tags: ['AI'], keywords: ['광고'], hook: 'ChatGPT 광고가 답변을 사지 못하는 이유', summary: '요약', key_takeaways: ['a', 'b', 'c'], why_it_matters: '왜', practical_applications: '적용', framework_analysis: '틀', interview_points: ['한 마디'], marketing_terms: [] })
const geminiText = text => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) })
const geminiError = (code, status, message) => ({ ok: false, status: code, json: async () => ({ error: { code, status, message } }) })
const timeout = () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) }

function db(articles) {
  const updates = [], upserts = []
  const none = { eq: () => none, neq: () => none, limit: async () => ({ data: [], error: null }) }
  return {
    updates, upserts,
    from: table => {
      if (table === 'insights') return { upsert: async row => { upserts.push(row); return { error: null } }, select: () => none }
      const q = { select: () => q, eq: () => q, not: () => q, or: () => q, order: () => q, limit: async () => ({ data: articles, error: null }) }
      q.update = values => { updates.push(values); const c = { eq: () => c, then: (r, j) => Promise.resolve({ error: null }).then(r, j) }; return c }
      return q
    },
  }
}
const article = n => ({ id: `00000000-0000-4000-8000-00000000040${n}`, title: `Article ${n}`, raw_content: 'x'.repeat(400), url: `https://e.com/${n}`, created_at: '2026-10-28T00:56:00Z', updated_at: '2026-10-28T00:56:00Z' })

async function run(gemini, n = 2) {
  const realFetch = globalThis.fetch
  process.env.N8N_WEBHOOK_SECRET = 's3'; process.env.GEMINI_API_KEY = KEY
  const calls = []
  globalThis.fetch = async url => { calls.push(String(url)); if (String(url).includes('generativelanguage')) return gemini(); throw new Error('unexpected fetch ' + url) }
  const logs = []; const log = console.log, warn = console.warn
  console.log = (...a) => logs.push(a.join(' ')); console.warn = (...a) => logs.push(a.join(' '))
  try {
    const d = db(Array.from({ length: n }, (_, i) => article(i + 1)))
    const { POST } = load('src/app/api/webhooks/analyze-pending/route.ts', { ...dead, 'next/server': { NextResponse }, '@/lib/supabase/admin': { createAdminClient: () => d }, '@/lib/utils': { buildInsightSlug: (_t, _h, id) => `slug-${id.slice(-3)}`, slugify: s => String(s).toLowerCase() } })
    const res = await POST(new Request('https://x/api/webhooks/analyze-pending?secret=s3&order=desc', { method: 'POST' }))
    return { res, d, calls, logs }
  } finally { globalThis.fetch = realFetch; console.log = log; console.warn = warn; delete process.env.GEMINI_API_KEY }
}
const noKey = r => [JSON.stringify(r.res.body), ...r.logs].every(t => !t.includes(KEY))

test('normal Gemini answer: insight saved, article ready, 200', async () => {
  const r = await run(() => geminiText(ANALYSIS), 1)
  assert.equal(r.res.status, 200)
  assert.equal(r.res.body.analyzed, 1)
  assert.equal(r.d.upserts.length, 1)
  assert.equal(r.d.upserts[0].category, 'AI 마케팅')
  assert.equal(r.d.updates.at(-1).status, 'ready')
})

test('invalid API key: every article fails, 502, the cause (API key) is recorded without the key, articles back to pending', async () => {
  const r = await run(() => geminiError(400, 'INVALID_ARGUMENT', `API key not valid. Please pass a valid API key. (key=${KEY})`), 3)
  assert.equal(r.res.status, 502)
  assert.equal(r.res.body.failed, 3)
  assert.ok(r.res.body.errors.every(e => /API key not valid/.test(e)), r.res.body.errors.join(' | '))
  assert.equal(r.d.updates.filter(u => u.status === 'pending').length, 3)
  assert.ok(noKey(r))
  // articles go two at a time: both of the first pair call Gemini (flash-lite + flash); the key error then benches
  // Gemini, so the third article does not call it at all
  assert.equal(r.calls.filter(u => u.includes('generativelanguage')).length, 4)
})

test('Gemini 503 overload: recorded as the cause; not benched, so the next article tries Gemini again', async () => {
  const r = await run(() => geminiError(503, 'UNAVAILABLE', 'The model is overloaded. Please try again later.'), 3)
  assert.equal(r.res.status, 502)
  assert.ok(r.res.body.errors.every(e => /503 UNAVAILABLE/.test(e)), r.res.body.errors.join(' | '))
  assert.equal(r.calls.filter(u => u.includes('generativelanguage')).length, 6) // flash-lite + flash for each of the 3
})

test('timeout: recorded as the cause and benched, so one batch waits at most one timeout pair', async () => {
  const r = await run(timeout, 3)
  assert.equal(r.res.status, 502)
  assert.ok(r.res.body.errors.every(e => /timeout/.test(e)), r.res.body.errors.join(' | '))
  assert.equal(r.calls.filter(u => u.includes('generativelanguage')).length, 4) // the third article skips Gemini
})

test('malformed answer: a failed analysis with the format cause, nothing saved, article back to pending', async () => {
  const r = await run(() => geminiText('죄송합니다. 지금은 답할 수 없습니다.'), 1)
  assert.equal(r.res.status, 502)
  assert.match(r.res.body.errors[0], /AI 응답 형식 오류/)
  assert.equal(r.res.body.rejected, 0)
  assert.equal(r.d.upserts.length, 0)
  assert.equal(r.d.updates.at(-1).status, 'pending')
})
