import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// Regressions found by the Site-Wide Audit V1: a subscribe form that claimed success on failure, and the Career Lab
// menu that lost its active state on its own sub-pages. No network, no email: the API runs with stand-ins.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), loaded, loaded.exports)
  return loaded.exports
}
const { subscriptionOutcome } = load('src/lib/newsletter/subscription-result.ts')

// The real POST /api/subscribe with its database, rate limit and mail sender replaced.
function subscribeApi({ rpc = { data: [{ result: 'issued', subscription_created: true }], error: null }, mailFails = false, limited = false } = {}) {
  const sent = []
  const route = load('src/app/api/subscribe/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } },
    '@/lib/rate-limit': { checkRateLimit: () => limited ? { status: 429, body: { error: '요청이 너무 많습니다' } } : null },
    '@/lib/supabase/admin': { createAdminClient: () => ({ rpc: async () => rpc }) },
    '@/lib/newsletter/confirmation-mail.mjs': { confirmationUrl: () => 'https://example.test/confirm', sendConfirmEmail: async to => { if (mailFails) throw new Error('send failed'); sent.push(to) } },
  })
  return { sent, post: email => route.POST({ json: async () => ({ email, source: 'insight_feedback' }) }) }
}
const SENT = /보냈어요/

test('subscribe: the reader is told an email was sent only when the API sent it', async () => {
  const cases = [
    ['new subscriber', subscribeApi(), 'new', true],
    ['pending again (mail re-sent)', subscribeApi({ rpc: { data: [{ result: 'issued', subscription_created: false }], error: null } }), 'existing', true],
    ['already subscribed', subscribeApi({ rpc: { data: [{ result: 'already_active' }], error: null } }), 'already', true],
    ['mail sender failed', subscribeApi({ mailFails: true }), 'emailFailed', false],
    ['database failed (500)', subscribeApi({ rpc: { data: null, error: { message: 'down' } } }), 'failure', false],
    ['rate limited (429)', subscribeApi({ limited: true }), 'rateLimited', false],
  ]
  for (const [name, api, result, done] of cases) {
    const res = await api.post('reader@example.test'), outcome = subscriptionOutcome(res.status, res.body)
    assert.equal(outcome.result, result, name); assert.equal(outcome.done, done, name)
    // "sent" wording appears exactly when a confirmation mail actually went out.
    assert.equal(SENT.test(outcome.message), api.sent.length > 0 && result !== 'already', `${name}: ${outcome.message}`)
  }
  const invalid = subscribeApi(), res = await invalid.post('not-an-email')
  assert.equal(res.status, 400); assert.equal(subscriptionOutcome(res.status, res.body).result, 'invalid'); assert.equal(invalid.sent.length, 0)
  // No response, or a body that is not the API's: a failure, never a success.
  for (const [status, body] of [[0, null], [200, null], [200, { success: false }], [502, { success: true }]]) {
    const outcome = subscriptionOutcome(status, body); assert.equal(outcome.result, 'failure'); assert.equal(outcome.done, false); assert.doesNotMatch(outcome.message, SENT)
  }
})

test('subscribe: every form that posts to /api/subscribe reads the shared result and sends its source', () => {
  const files = [], walk = dir => { for (const name of readdirSync(dir)) { const file = path.join(dir, name); if (statSync(file).isDirectory()) walk(file); else if (/\.tsx?$/.test(name)) files.push(file) } }
  walk('src')
  const forms = files.filter(file => /fetch\(\s*["'`]\/api\/subscribe["'`]/.test(readFileSync(file, 'utf8')))
  assert.ok(forms.length >= 3, `found ${forms.length} subscribe forms`)
  for (const file of forms) {
    const code = readFileSync(file, 'utf8')
    assert.match(code, /subscription(Result|Outcome)\(/, `${file} must judge the response with lib/newsletter/subscription-result`)
    assert.match(code, /JSON\.stringify\(\{\s*email,\s*source:/, `${file} must send its source`)
  }
})

test('navigation: Career Lab stays active on its sub-pages and no other item lights up', () => {
  const { PUBLIC_NAV_ITEMS, navCurrent } = load('src/components/layout/navigation.ts')
  const active = (pathname, hash = '') => PUBLIC_NAV_ITEMS.filter(item => navCurrent(item, pathname, hash)).map(item => item.label)
  for (const pathname of ['/practice', '/learn', '/interview', '/interview/prep', '/insight-lab']) assert.deepEqual(active(pathname), ['Career Lab'], pathname)
  assert.equal(navCurrent(PUBLIC_NAV_ITEMS.find(item => item.label === 'Career Lab'), '/practice', ''), 'page')
  assert.equal(navCurrent(PUBLIC_NAV_ITEMS.find(item => item.label === 'Career Lab'), '/learn', ''), 'true')
  const expected = [['/insights', 'Insights'], ['/insights/some-story', 'Insights'], ['/brands', 'Brand Watch'], ['/brands/musinsa', 'Brand Watch'],
    ['/glossary', 'Dictionary'], ['/newsletter', 'Weekly']]
  for (const [pathname, label] of expected) assert.deepEqual(active(pathname), [label], pathname)
  // Home anchors light up only on the home page with their hash; look-alike paths stay inactive.
  assert.deepEqual(active('/', '#collections'), ['Collections']); assert.deepEqual(active('/', '#signals'), ['Trends']); assert.deepEqual(active('/'), [])
  for (const pathname of ['/about', '/feedback', '/login', '/interviews', '/learning', '/practiced', '/insight-labs']) assert.deepEqual(active(pathname), [], pathname)
})
