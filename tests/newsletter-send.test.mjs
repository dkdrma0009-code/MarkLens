import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as releaseGuard from '../src/lib/release/guard.mjs'

// R-1: a weekly issue reaches each subscriber once. The real POST /api/newsletter/send runs with an in-memory
// newsletter_issues/subscribers table and a stubbed Brevo; the claim is one conditional UPDATE, like SQL.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw new Error('unmocked ' + name) }, loaded, loaded.exports)
  return loaded.exports
}
function setup({ status = 'pending_approval', brevoOk = true } = {}) {
  const issue = { id: 'i1', title: '#12 — 할인 대신 적립', status, sent_at: null, approved_at: null }
  const subscribers = [{ email: 'a@example.test' }, { email: 'b@example.test' }, { email: 'c@example.test' }]
  const sentTo = []
  const db = { from: table => {
    const filters = []; let update = null, select = false
    const q = { select() { select = true; return q }, update(v) { update = v; return q }, eq(c, v) { filters.push(r => r[c] === v); return q },
      or(text) { filters.push(r => text.split(',').some(p => { const [c, op, v] = p.split('.'); return op === 'is' ? r[c] == null : r[c] != null && r[c] !== v })); return q },
      single() { return q },
      then(resolve) {
        if (table === 'subscribers') return resolve({ data: subscribers, error: null })
        const hit = [issue].filter(r => filters.every(f => f(r)))
        if (update) { hit.forEach(r => Object.assign(r, update)); return resolve({ data: select ? hit.map(r => ({ id: r.id })) : null, error: null }) }
        resolve({ data: hit[0] ? { ...hit[0] } : null, error: null })
      } }
    return q
  } }
  globalThis.fetch = async (url, init) => { await new Promise(r => setTimeout(r, 3)); if (!brevoOk) return new Response('down', { status: 500 }); sentTo.push(JSON.parse(init.body).to[0].email); return new Response('{}', { status: 201 }) }
  const route = load('src/app/api/newsletter/send/route.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/app/api/unsubscribe/route': { generateUnsubscribeUrl: async email => 'https://x.test/u?e=' + email },
    '@/lib/newsletter/html': { buildNewsletterHtml: () => '<p>issue</p>' },
    '@/lib/api-auth': { isAdmin: async () => true },
    '@/lib/release/guard.mjs': releaseGuard,
    '@/lib/legal/privacy': load('src/lib/legal/privacy.ts', {}),
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
  })
  const post = body => route.POST(new Request('https://x.test/api/newsletter/send', { method: 'POST', body: JSON.stringify(body) }))
  return { post, issue, sentTo }
}

test('newsletter: two simultaneous sends of one issue mail each subscriber once; a sent issue is never re-sent', async () => {
  const s = setup()
  const [a, b] = await Promise.all([s.post({ issueId: 'i1' }), s.post({ issueId: 'i1' })])
  assert.deepEqual([a.status, b.status].sort(), [200, 409])
  assert.deepEqual([...s.sentTo].sort(), ['a@example.test', 'b@example.test', 'c@example.test'])
  assert.equal(s.issue.status, 'sent'); assert.ok(s.issue.sent_at)
  const again = await s.post({ issueId: 'i1' })
  assert.equal(again.status, 409); assert.match(again.body.error, /이미 발송된 호/)
  assert.equal(s.sentTo.length, 3)
})

test('newsletter: when nothing could be sent the issue goes back to its previous state; test sends never change it', async () => {
  const down = setup({ brevoOk: false })
  const res = await down.post({ issueId: 'i1' })
  assert.equal(res.body.success, false)
  assert.equal(down.issue.status, 'pending_approval'); assert.equal(down.issue.sent_at, null)

  const sent = setup({ status: 'sent' })
  const preview = await sent.post({ issueId: 'i1', testEmail: 'qa@example.test' })
  assert.equal(preview.status, 200); assert.deepEqual(sent.sentTo, ['qa@example.test'])
  assert.equal(sent.issue.status, 'sent')
})
