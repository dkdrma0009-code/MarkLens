import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-4 privacy retention (owner-confirmed 2026-10-25): one set of periods in src/lib/privacy/retention.ts, kept by the
// daily purge, by unsubscribe (immediate deletion), by the operator's fallback SQL and stated in the policy text.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw new Error('unmocked ' + name) }, loaded, loaded.exports)
  return loaded.exports
}
const retention = load('src/lib/privacy/retention.ts')
const privacy = load('src/lib/legal/privacy.ts')
const NOW = new Date('2026-11-01T00:00:00Z')
const ago = d => new Date(NOW.getTime() - d * 86_400_000).toISOString()

// A recording stand-in for the Supabase client: every delete/select is logged with its filters.
function fakeDb({ subscribers = [], events = [], fail = {} } = {}) {
  const calls = []
  const from = table => ({
    delete: () => {
      const call = { table, op: 'delete', filters: [] }
      calls.push(call)
      const q = {
        eq: (c, v) => { call.filters.push(['eq', c, v]); return q }, is: (c, v) => { call.filters.push(['is', c, v]); return q },
        lt: (c, v) => { call.filters.push(['lt', c, v]); return q }, in: (c, v) => { call.filters.push(['in', c, v]); return q },
        then: (res, rej) => Promise.resolve(fail[table] ? { error: fail[table], count: null } : { error: null, count: 1 }).then(res, rej),
      }
      return q
    },
    select: () => { calls.push({ table, op: 'select' }); return Promise.resolve({ data: (table === 'subscribers' ? subscribers : events).map(email => ({ email })), error: null }) },
  })
  return { db: { from }, calls }
}

test('periods: one source, and the policy text, the fallback SQL and the cron schedule agree with it', () => {
  assert.deepEqual({ ...retention.RETENTION_DAYS }, { unconfirmedSubscriber: 7, newsletterEvents: 90, aiUsage: 90, feedback: 183 })
  const r = privacy.PRIVACY_FACTS.retention
  assert.match(r.subscribers, /해지하면 즉시 삭제/); assert.match(r.subscribers, /7일/)
  assert.equal(r.newsletterEvents, '90일'); assert.equal(r.aiUsage, '90일'); assert.equal(r.feedback, '접수 후 6개월')
  assert.match(r.members, /탈퇴/)
  const c = readFileSync('scripts/release/privacy-deletion.sql', 'utf8').split('-- [C]')[1]
  assert.match(c, /status = 'unsubscribed';/)
  assert.match(c, /interval '7 days'/); assert.equal(c.match(/interval '90 days'/g).length, 2); assert.match(c, /interval '183 days'/)
  const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons
  assert.ok(crons.some(j => j.path === '/api/cron/privacy-purge' && /^\d+ \d+ \* \* \*$/.test(j.schedule)), 'runs every day')
})

test('daily purge: each rule deletes with the right filter and cut-off; non-subscriber events go too', async () => {
  const { db, calls } = fakeDb({ subscribers: ['a@x.test', 'B@x.test'], events: ['a@x.test', 'b@x.test', 'gone@x.test', 'gone@x.test'] })
  const counts = await retention.purgeExpiredPersonalData(db, NOW)
  const deletes = calls.filter(c => c.op === 'delete').map(c => [c.table, c.filters])
  assert.deepEqual(deletes, [
    ['subscribers', [['eq', 'status', 'unsubscribed']]],
    ['subscribers', [['eq', 'status', 'pending'], ['is', 'confirmed_at', null], ['lt', 'subscribed_at', ago(7)]]],
    ['newsletter_events', [['lt', 'created_at', ago(90)]]],
    ['newsletter_events', [['in', 'email', ['gone@x.test']]]], // case-insensitive: b@x.test is still a subscriber
    ['ai_usage', [['lt', 'window_start', ago(90)]]],
    ['feedback', [['lt', 'created_at', ago(183)]]],
  ])
  assert.equal(Object.keys(counts).length, 6)
})

test('daily purge: a missing ai_usage table (before migration 024) is skipped; any other error stops with its rule', async () => {
  const missing = fakeDb({ fail: { ai_usage: { code: '42P01', message: 'relation "public.ai_usage" does not exist' } } })
  assert.equal((await retention.purgeExpiredPersonalData(missing.db, NOW))['old AI usage'], 0)
  const broken = fakeDb({ fail: { feedback: { code: '42501', message: 'permission denied' } } })
  await assert.rejects(retention.purgeExpiredPersonalData(broken.db, NOW), /old feedback: permission denied/)
})

const server = { NextResponse: { json: (body, init) => ({ status: init?.status ?? 200, body }) } }
function cron({ deleted, error, blocked = null } = {}) {
  const alerts = []
  const route = load('src/app/api/cron/privacy-purge/route.ts', {
    'next/server': server,
    '@/lib/supabase/admin': { createAdminClient: () => ({}) },
    '@/lib/privacy/retention': { purgeExpiredPersonalData: async () => { if (error) throw new Error(error); return deleted } },
    '@/lib/alert': { sendAdminAlert: async (s, m) => { alerts.push([s, m]) } },
    '@/lib/release/guard.mjs': { blockedReason: () => blocked },
  })
  return { GET: auth => route.GET(new Request('https://x.test/api/cron/privacy-purge', { headers: auth ? { authorization: auth } : {} })), alerts }
}

test('cron route: secret required, never runs in Preview, reports counts, alerts the operator on failure', async () => {
  const before = process.env.CRON_SECRET
  process.env.CRON_SECRET = 'cron-test'
  try {
    assert.equal((await cron().GET()).status, 401)
    assert.equal((await cron({ blocked: 'Preview' }).GET('Bearer cron-test')).status, 403)
    const ok = await cron({ deleted: { 'old feedback': 2 } }).GET('Bearer cron-test')
    assert.equal(ok.status, 200); assert.deepEqual(ok.body.deleted, { 'old feedback': 2 })
    const failing = cron({ error: 'old feedback: permission denied' })
    const res = await failing.GET('Bearer cron-test')
    assert.equal(res.status, 500); assert.equal(failing.alerts.length, 1); assert.match(failing.alerts[0][1], /permission denied/)
  } finally { if (before === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = before }
})

test('unsubscribe: deletes the address\'s events and subscription at once; a failed delete says so instead of "done"', async () => {
  const secret = process.env.N8N_WEBHOOK_SECRET
  process.env.N8N_WEBHOOK_SECRET = 'unsub-test'
  try {
    const run = async fail => {
      const ops = []
      const route = load('src/app/api/unsubscribe/route.ts', {
        '@/lib/rate-limit': { checkRateLimit: () => null },
        '@/lib/supabase/admin': { createAdminClient: () => ({ from: t => ({ delete: () => ({ eq: async (c, v) => { ops.push([t, c, v]); return { error: fail === t ? { message: 'down' } : null } } }) }) }) },
      })
      const url = await route.generateUnsubscribeUrl('reader@x.test')
      return { res: await route.GET(new Request(url)), ops }
    }
    const ok = await run()
    assert.equal(ok.res.status, 200); assert.match(await ok.res.text(), /구독 정보는 바로 삭제했습니다/)
    assert.deepEqual(ok.ops, [['newsletter_events', 'email', 'reader@x.test'], ['subscribers', 'email', 'reader@x.test']])
    const failed = await run('subscribers')
    assert.equal(failed.res.status, 500); assert.doesNotMatch(await failed.res.text(), /구독이 취소됐습니다/)
  } finally { if (secret === undefined) delete process.env.N8N_WEBHOOK_SECRET; else process.env.N8N_WEBHOOK_SECRET = secret }
})
