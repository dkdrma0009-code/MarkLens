import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-1: card news publishing claims each channel atomically, never re-posts what may already be on the platform,
// keeps Instagram and Threads state apart, and gives the admin a way out of "needs review". The real publish module
// runs against an in-memory cardnews table whose conditional UPDATE applies in one step, like a single SQL UPDATE.
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => { if (name in mocks) return mocks[name]; throw new Error('unmocked ' + name) }, loaded, loaded.exports)
  return loaded.exports
}

// PostgREST filter subset used by the publisher, with SQL null semantics (null <> x is not true).
const value = v => v === 'null' ? null : v
const match = (row, [col, op, v]) => op === 'is' ? (v === null ? row[col] == null : row[col] === v)
  : op === 'not.is' ? row[col] != null : op === 'eq' ? row[col] != null && String(row[col]) === String(v)
  : op === 'neq' ? row[col] != null && String(row[col]) !== String(v) : op === 'or' ? v.some(f => match(row, f)) : false
const parseOr = text => text.split(',').map(part => { const [col, op, ...rest] = part.split('.'); return [col, op, value(rest.join('.'))] })
function fakeDb({ failRecord = () => false } = {}) {
  const rows = new Map(), log = []
  function query(table) {
    const filters = []; let update = null, select = null, single = false
    const q = {
      select(cols) { select = cols; return q }, update(v) { update = v; return q },
      eq(c, v) { filters.push([c, 'eq', v]); return q }, is(c, v) { filters.push([c, 'is', v]); return q },
      not(c, op, v) { filters.push([c, 'not.' + op, v]); return q }, or(text) { filters.push([null, 'or', parseOr(text)]); return q },
      maybeSingle() { single = true; return q }, single() { single = true; return q },
      then(resolve, reject) { try { resolve(run()) } catch (e) { reject(e) } },
    }
    function run() {
      if (table !== 'cardnews') return { data: single ? { hook: 'Hook', category: '브랜딩' } : [], error: null }
      const hit = [...rows.values()].filter(row => filters.every(f => match(row, f)))
      if (update) {
        if (failRecord(update)) return { data: null, error: { message: 'connection reset' } }
        for (const row of hit) Object.assign(row, update)
        log.push({ update, rows: hit.length })
        return { data: select ? hit.map(r => ({ article_id: r.article_id })) : null, error: null }
      }
      return { data: single ? (hit[0] ? { ...hit[0] } : null) : hit.map(r => ({ ...r })), error: null }
    }
    return q
  }
  const db = { from: query, storage: { createBucket: async () => ({}), from: () => ({ upload: async () => ({ error: null }), getPublicUrl: path => ({ data: { publicUrl: 'https://storage.test/' + path } }) }) } }
  return { db, rows, log }
}
const tick = () => new Promise(r => setTimeout(r, 5))

function setup({ ig = async (_, __, onPublish) => { await tick(); onPublish(); await tick(); return 'ig-1' }, threads = async (_, __, onPublish) => { onPublish(); await tick(); return 'th-1' }, failRecord, card = {} } = {}) {
  const fake = fakeDb({ failRecord }), calls = { ig: 0, threads: 0 }
  fake.rows.set('a1', { article_id: 'a1', posted_at: null, publish_status: null, ig_post_id: null, ...card })
  const mod = load('src/lib/cardnews/publish.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => fake.db },
    './render-buffers': { renderCardnewsBuffers: async () => ({ buffers: [Buffer.from('a'), Buffer.from('b')], caption: 'caption' }) },
    '@/lib/instagram': { publishCarousel: (...a) => { calls.ig++; return ig(...a) } },
    '@/lib/threads': { publishThreadsCarousel: (...a) => { calls.threads++; return threads(...a) } },
    './publish-state': load('src/lib/cardnews/publish-state.ts'),
  })
  return { ...mod, row: () => fake.rows.get('a1'), calls, fake }
}

test('publish: two simultaneous requests post once; Instagram then Threads are recorded separately', async () => {
  const s = setup()
  const results = await Promise.allSettled([s.publishCardnews('a1'), s.publishCardnews('a1'), s.publishCardnews('a1')])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.match(results.find(r => r.status === 'rejected').reason.message, /이미 진행 중/)
  assert.deepEqual(s.calls, { ig: 1, threads: 1 })
  const row = s.row()
  assert.equal(row.ig_publish_state, 'published'); assert.equal(row.ig_post_id, 'ig-1'); assert.ok(row.posted_at)
  assert.equal(row.threads_publish_state, 'published'); assert.equal(row.threads_post_id, 'th-1'); assert.ok(row.threads_posted_at)
  await assert.rejects(s.publishCardnews('a1'), /이미 Instagram 에 발행된/)
  assert.equal(s.calls.ig, 1)
})

test('publish: a failure before the platform publish call is retryable; after it, the card waits for review and is never re-posted', async () => {
  let fail = true
  const before = setup({ ig: async () => { if (fail) throw new Error('컨테이너 생성 실패'); return 'ig-2' } })
  await assert.rejects(before.publishCardnews('a1'), /컨테이너 생성 실패/)
  assert.equal(before.row().ig_publish_state, 'failed')
  fail = false
  assert.equal(await before.publishCardnews('a1'), 'ig-2') // the scheduled cron's daily retry takes this path
  assert.equal(before.row().ig_publish_state, 'published')

  const after = setup({ ig: async (_, __, onPublish) => { onPublish(); throw new Error('timeout') } })
  await assert.rejects(after.publishCardnews('a1'), /확인 필요/)
  assert.equal(after.row().ig_publish_state, 'needs_review')
  assert.match(after.row().ig_publish_error, /게시 여부 확인 필요: timeout/)
  await assert.rejects(after.publishCardnews('a1'), /확인 필요 상태/)
  assert.equal(after.calls.ig, 1)
  assert.equal(after.calls.threads, 0) // Threads only after Instagram succeeded
})

test('publish: posted but not recorded → needs review, no automatic re-post', async () => {
  const s = setup({ failRecord: update => update.ig_publish_state === 'published' })
  await assert.rejects(s.publishCardnews('a1'), /게시됐지만\(ig-1\) 기록하지 못했습니다/)
  assert.equal(s.row().ig_publish_state, 'needs_review')
  assert.match(s.row().ig_publish_error, /게시됨\(ig-1\) — DB 기록 실패/)
  await assert.rejects(s.publishCardnews('a1'), /확인 필요/)
  assert.equal(s.calls.ig, 1)
})

test('recovery: a publish stuck for 15 minutes needs review; the admin records the post or releases it for retry', async () => {
  const stuck = { ig_publish_state: 'publishing', ig_publish_claimed_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() }
  const s = setup({ card: stuck })
  await assert.rejects(s.publishCardnews('a1'), /확인 필요/)
  await assert.rejects(s.resolveCardnewsPublish('a1', 'instagram', 'published', ' '), /게시물 id/)
  await s.resolveCardnewsPublish('a1', 'instagram', 'published', 'ig-found')
  assert.equal(s.row().ig_publish_state, 'published'); assert.equal(s.row().ig_post_id, 'ig-found'); assert.ok(s.row().posted_at)
  await assert.rejects(s.resolveCardnewsPublish('a1', 'instagram', 'release'), /확인 필요 상태가 아닙니다/)

  const r = setup({ card: stuck })
  await r.resolveCardnewsPublish('a1', 'instagram', 'release')
  assert.equal(r.row().ig_publish_state, 'failed')
  assert.equal(await r.publishCardnews('a1'), 'ig-1')

  const fresh = setup({ card: { ig_publish_state: 'publishing', ig_publish_claimed_at: new Date().toISOString() } })
  await assert.rejects(fresh.publishCardnews('a1'), /이미 진행 중/)
  await assert.rejects(fresh.resolveCardnewsPublish('a1', 'instagram', 'release'), /확인 필요 상태가 아닙니다/)
  assert.equal(load('src/lib/cardnews/publish-state.ts').needsReview('publishing', new Date(Date.now() - 15 * 60 * 1000).toISOString()), true)
})

test('threads: its failure leaves Instagram published; only a failed Threads post can be retried, manually, once at a time', async () => {
  let threadsUp = false
  const s = setup({ threads: async (_, __, onPublish) => { if (!threadsUp) throw new Error('Threads 처리 실패: ERROR'); onPublish(); await tick(); return 'th-9' } })
  assert.equal(await s.publishCardnews('a1'), 'ig-1')
  assert.equal(s.row().ig_publish_state, 'published')
  assert.equal(s.row().threads_publish_state, 'failed')
  threadsUp = true
  const retries = await Promise.allSettled([s.retryThreadsPublish('a1'), s.retryThreadsPublish('a1')])
  assert.equal(retries.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(s.row().threads_publish_state, 'published'); assert.equal(s.row().threads_post_id, 'th-9')
  await assert.rejects(s.retryThreadsPublish('a1'), /이미 Threads 에 발행된/)

  // Not configured: nothing attempted, nothing recorded as failed; an older post with no Threads record is not retryable.
  const off = setup({ threads: async () => null })
  await off.publishCardnews('a1')
  assert.equal(off.row().threads_publish_state, null)
  await assert.rejects(off.retryThreadsPublish('a1'), /발행을 시작할 수 없는 상태/)
  const early = setup()
  await assert.rejects(early.retryThreadsPublish('a1'), /Instagram 발행 후에만/)
})

test('publish: skipped card news and the manual Posted mark keep their meaning', async () => {
  const skipped = setup({ card: { publish_status: 'skipped_stale' } })
  await assert.rejects(skipped.publishCardnews('a1'), /스킵 처리됨\(skipped_stale\)/)
  assert.equal(skipped.calls.ig, 0)
  const route = readFileSync('src/app/api/admin/cardnews/posted/route.ts', 'utf8')
  assert.match(route, /ig_publish_state: posted \? "published" : null/)
  assert.match(route, /\.or\("ig_publish_state\.is\.null,ig_publish_state\.eq\.published,ig_publish_state\.eq\.failed"\)/)
  assert.match(readFileSync('src/app/api/cron/ig-daily/route.ts', 'utf8'), /\.or\("ig_publish_state\.is\.null,ig_publish_state\.eq\.failed"\)/)
})
