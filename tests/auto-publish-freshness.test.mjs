import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// 2026-10-25 operator rules for the 08:00 SNS drip and the 09:00 site auto-publish: source date within 7 days (an old
// article analysed today is not new), required analysis present, no repeat of a published title or an already-posted
// card, and nothing goes out when nothing qualifies. Both crons use the same selection.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { throw new Error('unmocked ' + name) }, loaded, loaded.exports)
  return loaded.exports
}
const { selectFresh, freshReadyCandidates, FRESH_DAYS } = load('src/lib/content/auto-publish.ts')
const NOW = new Date('2026-10-26T23:00:00Z')
const ago = d => new Date(NOW.getTime() - d * 86_400_000).toISOString()
const row = (id, over = {}, article = {}) => ({
  article_id: id, slug: `s-${id}`, hook: `제목 ${id}`, summary: '요약', key_takeaways: ['사실'], why_it_matters: '이유', category: '전략',
  created_at: ago(0), ...over, article: { status: 'ready', published_at: ago(1), created_at: ago(1), ...article },
})

test('window is 7 days', () => assert.equal(FRESH_DAYS, 7))

test('an old source analysed today is not fresh; a missing source date falls back to the collected date', () => {
  const { eligible, skipped } = selectFresh([
    row('old', { created_at: ago(0) }, { published_at: ago(70) }),
    row('nodate-fresh', {}, { published_at: null, created_at: ago(2) }),
    row('nodate-old', {}, { published_at: null, created_at: ago(40) }),
    row('edge', {}, { published_at: ago(6.9) }),
  ], new Set(), NOW)
  assert.deepEqual(eligible.map(r => r.article_id).sort(), ['edge', 'nodate-fresh'])
  assert.match(skipped.find(s => s.article_id === 'old').reason, /older than 7 days/)
  assert.ok(skipped.some(s => s.article_id === 'nodate-old'))
})

test('required analysis: hook, summary, key takeaways, why it matters, category', () => {
  const { eligible, skipped } = selectFresh([
    row('ok'),
    row('nohook', { hook: '  ' }), row('nosummary', { summary: null }), row('notakeaways', { key_takeaways: ['', ' '] }),
    row('nowhy', { why_it_matters: '' }), row('nocategory', { category: null }),
  ], new Set(), NOW)
  assert.deepEqual(eligible.map(r => r.article_id), ['ok'])
  assert.deepEqual(Object.fromEntries(skipped.map(s => [s.article_id, s.reason])), {
    nohook: 'missing hook', nosummary: 'missing summary', notakeaways: 'missing key_takeaways', nowhy: 'missing why_it_matters', nocategory: 'missing category',
  })
})

test('duplicates: a published title, a repeat within the batch (whitespace-insensitive), an already-posted card', () => {
  const { eligible, skipped } = selectFresh([
    row('a', { hook: '같은 제목' }, { published_at: ago(1) }),
    row('b', { hook: ' 같은   제목 ' }, { published_at: ago(2) }),
    row('c', { hook: '이미 공개된 제목' }),
    row('d'),
  ], new Set(['이미 공개된  제목']), NOW, new Set(['d']))
  assert.deepEqual(eligible.map(r => r.article_id), ['a'])
  assert.deepEqual(Object.fromEntries(skipped.map(s => [s.article_id, s.reason])), { b: 'duplicate title', c: 'duplicate title', d: 'card news already posted' })
})

test('newest source first, not newest analysis; nothing eligible means nothing goes out', () => {
  const { eligible } = selectFresh([row('older', { created_at: ago(0) }, { published_at: ago(5) }), row('newer', { created_at: ago(3) }, { published_at: ago(1) })], new Set(), NOW)
  assert.deepEqual(eligible.map(r => r.article_id), ['newer', 'older'])
  assert.deepEqual(selectFresh([row('x', {}, { published_at: ago(30) })], new Set(), NOW).eligible, [])
  assert.deepEqual(selectFresh([], new Set(), NOW).eligible, [])
})

// Recording stand-in for the Supabase query builder.
function fakeDb(tables) {
  const calls = []
  return {
    calls,
    db: {
      from: table => {
        const call = { table, filters: [] }
        calls.push(call)
        const q = {}
        for (const op of ['select', 'eq', 'gte', 'order', 'limit', 'in', 'or']) q[op] = (...a) => { call.filters.push([op, ...a]); return q }
        q.then = (res, rej) => Promise.resolve(tables[table] instanceof Error ? { data: null, error: tables[table] } : { data: tables[table] ?? [], error: null }).then(res, rej)
        return q
      },
    },
  }
}

test('query: ready rows analysed within the window, published titles and posted cards looked up for those rows only', async () => {
  const { db, calls } = fakeDb({ insights: [row('a'), row('b', { hook: '중복' })], cardnews: [{ article_id: 'a' }] })
  // The second insights call (published titles) returns the same fake table; make it see only '중복'.
  let n = 0
  const from = db.from
  db.from = t => { const q = from(t); if (t === 'insights' && n++ === 1) q.then = (res, rej) => Promise.resolve({ data: [{ hook: '중복' }], error: null }).then(res, rej); return q }
  const { eligible, skipped } = await freshReadyCandidates(db, NOW)
  assert.deepEqual(eligible, [])
  assert.deepEqual(skipped.map(s => s.reason).sort(), ['card news already posted', 'duplicate title'])
  const [ready, titles, cards] = calls
  assert.deepEqual(ready.filters.find(f => f[0] === 'eq'), ['eq', 'article.status', 'ready'])
  assert.deepEqual(ready.filters.find(f => f[0] === 'gte'), ['gte', 'created_at', ago(7)])
  assert.match(ready.filters[0][1], /published_at/)
  assert.deepEqual(titles.filters.find(f => f[0] === 'eq'), ['eq', 'article.status', 'published'])
  assert.deepEqual(titles.filters.find(f => f[0] === 'in'), ['in', 'hook', ['제목 a', '중복']])
  assert.deepEqual(cards.filters.find(f => f[0] === 'in'), ['in', 'article_id', ['a', 'b']])
  assert.deepEqual(cards.filters.find(f => f[0] === 'or'), ['or', 'posted_at.not.is.null,threads_posted_at.not.is.null'])
})

test('query errors stop the selection instead of publishing unchecked rows', async () => {
  await assert.rejects(freshReadyCandidates(fakeDb({ insights: new Error('boom') }).db, NOW), /ready candidates: boom/)
  await assert.rejects(freshReadyCandidates(fakeDb({ insights: [row('a')], cardnews: new Error('down') }).db, NOW), /posted card news: down/)
})

test('both crons pick through the shared selection; scheduled card news (approved editorials) stays separate', () => {
  const drip = readFileSync('src/app/api/cron/ig-daily/route.ts', 'utf8')
  const collect = readFileSync('src/app/api/cron/collect/route.ts', 'utf8')
  assert.match(drip, /from "@\/lib\/content\/auto-publish"/)
  assert.match(drip, /const pick = selection\.eligible\[0\]/)
  assert.doesNotMatch(drip, /readyRows/)
  assert.match(collect, /await import\("@\/lib\/content\/auto-publish"\)/)
  assert.match(collect, /\(await freshReadyCandidates\(sb\)\)\.eligible/)
  assert.doesNotMatch(collect, /36 \* 3600/)
  // ⑤ scheduled posting runs before the drip flag and is not filtered by freshness.
  assert.ok(drip.indexOf('scheduled_at') < drip.indexOf('ig_auto_publish'))
})
