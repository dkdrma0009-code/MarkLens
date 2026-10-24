import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

// R-4 PostgREST egress: an insight detail renders from ONE lookup (slug or legacy_slug together, shared by
// generateMetadata and the page) and takes its related candidates from a pool every detail shares, instead of
// 60 rows per detail. Results must be exactly what the old queries produced. Real modules, recorded fake client.
const require = createRequire(import.meta.url)
const ts = require('typescript')
const stub = () => null
function load(file, mocks = {}) {
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name.startsWith('@/components') || name === 'lucide-react' ? new Proxy({}, { get: (_, k) => k === '__esModule' ? true : stub }) : require(name), loaded, loaded.exports)
  return loaded.exports
}
const related = load('src/lib/insights/related.ts')
const publicSelect = load('src/lib/insights/public-select.ts')

// A PostgREST-shaped fake: records each request; `answer(request)` returns { data, error }.
function fakeClient(answer) {
  const requests = []
  const client = {
    from(table) {
      const req = { table, filters: [] }; requests.push(req)
      const q = {
        select(s) { req.select = s; return q }, or(f) { req.or = f; return q }, eq(c, v) { req.filters.push(['eq', c, v]); return q },
        order(c, o) { req.order = [c, o]; return q }, limit(n) { req.limit = n; return q }, returns() { return q }, maybeSingle() { req.maybeSingle = true; return q },
        then(resolve, reject) { return Promise.resolve(answer(req)).then(resolve, reject) },
      }
      return q
    },
  }
  return { client, requests }
}
function detailPage(answer) {
  const fake = fakeClient(answer)
  const page = load('src/app/(public)/insights/[slug]/page.tsx', {
    react: { cache: fn => fn }, // per-render dedupe is React's; its effect is measured on a real build (r4)
    '@/lib/supabase/server': { createPublicClient: () => fake.client },
    '@/lib/insights/public-select': publicSelect, '@/lib/insights/related': related,
    '@/lib/insights/related-pool': { relatedCandidates: async () => [] },
    'next/navigation': { notFound: () => { throw new Error('NEXT_NOT_FOUND') } },
  })
  return { page, requests: fake.requests }
}
const row = (slug, legacy = null) => ({ id: `id-${slug}`, slug, legacy_slug: legacy, hook: `Hook ${slug}`, summary: 'S', category: 'CRM', tags: [], keywords: [], created_at: '2026-01-01', article: { title: 'T', image_url: null } })

test('detail lookup: one request for slug OR legacy_slug, slug wins, value quoted for PostgREST', async () => {
  const { page, requests } = detailPage(() => ({ data: [row('old-slug-owner', 'shared'), row('shared')], error: null }))
  const meta = await page.generateMetadata({ params: Promise.resolve({ slug: 'shared' }) })
  assert.equal(meta.title, 'Hook shared | MarkLens') // the slug match, even though the legacy match came first
  assert.equal(requests.length, 1)
  assert.equal(requests[0].or, 'slug.eq."shared",legacy_slug.eq."shared"')
  assert.equal(requests[0].limit, 2)
  assert.equal(requests[0].select, `${publicSelect.PUBLIC_INSIGHT_DETAIL_SELECT},legacy_slug`) // metadata and page share one lookup

  const legacy = detailPage(() => ({ data: [row('new-ascii', '옛-한글-슬러그')], error: null }))
  assert.equal((await legacy.page.generateMetadata({ params: Promise.resolve({ slug: encodeURIComponent('옛-한글-슬러그') }) })).title, 'Hook new-ascii | MarkLens')
  assert.equal(legacy.requests[0].or, 'slug.eq."옛-한글-슬러그",legacy_slug.eq."옛-한글-슬러그"')

  // Reserved characters cannot break out of the quoted value.
  const odd = detailPage(() => ({ data: [], error: null }))
  await odd.page.generateMetadata({ params: Promise.resolve({ slug: encodeURIComponent('a,b.c"d\\e)') }) })
  assert.equal(odd.requests[0].or, 'slug.eq."a,b.c\\"d\\\\e)",legacy_slug.eq."a,b.c\\"d\\\\e)"')
  // Malformed percent-encoding is looked up as is instead of throwing (500).
  const bad = detailPage(() => ({ data: [], error: null }))
  assert.deepEqual(await bad.page.generateMetadata({ params: Promise.resolve({ slug: '%E0%A4%A' }) }), {})

  // Rows that match neither slug nor legacy_slug (a filter the server ignored) are never rendered: 404, not another article.
  const ignored = detailPage(() => ({ data: [row('someone-else'), row('another-one', 'old')], error: null }))
  await assert.rejects(ignored.page.default({ params: Promise.resolve({ slug: 'wanted' }) }), /NEXT_NOT_FOUND/)
  // legacy_slug is only used to match; the page receives the same fields as before.
  const viaLegacy = detailPage(() => ({ data: [row('kept', 'old-kept')], error: null }))
  const tree = await viaLegacy.page.default({ params: Promise.resolve({ slug: 'old-kept' }) })
  const findInsight = el => { if (!el || typeof el !== 'object') return null; if (el.props?.insight) return el.props.insight; for (const c of [el.props?.children].flat()) { const f = findInsight(c); if (f) return f } return null }
  const given = findInsight(tree)
  assert.equal(given.hook, 'Hook kept'); assert.ok(!('legacy_slug' in given))
})

test('detail lookup: unknown slug is one request and a 404; OR failure (no legacy_slug column) falls back to slug', async () => {
  const missing = detailPage(() => ({ data: [], error: null }))
  await assert.rejects(missing.page.default({ params: Promise.resolve({ slug: 'nope' }) }), /NEXT_NOT_FOUND/)
  assert.equal(missing.requests.length, 1)

  const old = detailPage(req => req.or ? { data: null, error: { code: '42703', message: 'column insights.legacy_slug does not exist' } } : { data: row('kept'), error: null })
  assert.equal((await old.page.generateMetadata({ params: Promise.resolve({ slug: 'kept' }) })).title, 'Hook kept | MarkLens')
  assert.deepEqual(old.requests.map(r => r.or ? 'or' : r.filters.map(f => f.join(':')).join()), ['or', 'eq:slug:kept'])
})

test('related pool: same candidates and order as `.neq(id).limit(60)`, shared within 10 minutes, failures not kept', async () => {
  let calls = 0
  const pool = Array.from({ length: 80 }, (_, i) => ({ id: `p${i}`, slug: `p${i}` }))
  const fake = fakeClient(req => { calls++; return { data: pool.slice(0, req.limit), error: null } })
  const deps = client => ({ '@/lib/supabase/server': { createPublicClient: () => client }, '@/lib/insights/public-select': publicSelect })
  const realNow = Date.now
  let now = 1_000_000
  Date.now = () => now
  try {
    const mod = load('src/lib/insights/related-pool.ts', deps(fake.client))
    for (const self of ['p0', 'p30', 'p60', 'p61', 'p79', 'not-in-pool']) {
      const old = pool.filter(c => c.id !== self).slice(0, 60) // the previous per-detail query
      assert.deepEqual((await mod.relatedCandidates(self)).map(c => c.id), old.map(c => c.id), self)
    }
    assert.equal(calls, 1)
    const req = fake.requests[0]
    assert.equal(req.select, publicSelect.PUBLIC_INSIGHT_CARD_SELECT); assert.equal(req.limit, 61)
    assert.deepEqual(req.filters, [['eq', 'articles.status', 'published']]); assert.deepEqual(req.order, ['created_at', { ascending: false }])

    // Concurrent renders share one in-flight read; after the TTL the next render reads again.
    await Promise.all([mod.relatedCandidates('p1'), mod.relatedCandidates('p2')]); assert.equal(calls, 1)
    now += mod.RELATED_POOL_TTL_MS - 1; await mod.relatedCandidates('p1'); assert.equal(calls, 1)
    now += 2; await mod.relatedCandidates('p1'); assert.equal(calls, 2)
    assert.equal(mod.RELATED_POOL_TTL_MS, 600000)

    // A different database (Preview vs Production) never reuses the other's candidates.
    const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://previewtestproject01.supabase.co'
    try { await mod.relatedCandidates('p1'); assert.equal(calls, 3) } finally { if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = saved }

    // During `next build` the pool is read once per worker process, whatever the time.
    const built = fakeClient(() => ({ data: pool, error: null }))
    process.env.NEXT_PHASE = 'phase-production-build'
    try {
      const b = load('src/lib/insights/related-pool.ts', deps(built.client))
      await b.relatedCandidates('p1'); now += 10 * mod.RELATED_POOL_TTL_MS; await b.relatedCandidates('p2')
      assert.equal(built.requests.length, 1)
    } finally { delete process.env.NEXT_PHASE }

    // A failed read renders without related (as before) and is not kept: the next render reads again.
    let fail = true
    const flaky = fakeClient(() => fail ? { data: null, error: { message: 'timeout' } } : { data: pool, error: null })
    const mod2 = load('src/lib/insights/related-pool.ts', deps(flaky.client))
    assert.deepEqual(await mod2.relatedCandidates('p1'), [])
    fail = false
    assert.equal((await mod2.relatedCandidates('p1')).length, 60)
    assert.equal(flaky.requests.length, 2)
  } finally { Date.now = realNow }

  // No Next data cache: its revalidate/tags would move onto every detail page (shorter ISR period, mass expiry).
  assert.doesNotMatch(readFileSync('src/lib/insights/related-pool.ts', 'utf8'), /^import .*next\/cache/m)
})

test('related results: identical to the previous per-detail query for every insight of a 300-insight corpus', () => {
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const vocab = ['CRM', '리텐션', 'SEO', 'AI', '숏폼', '커머스', '팝업', 'LTV', 'ROAS', '구독', '앱', '광고', '검색', '커뮤니티', 'UGC']
  const cats = ['브랜딩', 'SEO', 'CRM', 'AI 마케팅', '콘텐츠 마케팅']
  const pickTags = () => [...new Set(Array.from({ length: 3 }, () => vocab[Math.floor(vocab.length * rnd() ** 2)]))]
  const corpus = Array.from({ length: 300 }, (_, i) => ({ id: `i${i}`, slug: `s${i}`, category: cats[Math.floor(rnd() * cats.length)], tags: pickTags(), keywords: pickTags(), created_at: String(1e6 - i) }))
  const pool61 = corpus.slice(0, 61)
  let withRelated = 0
  for (const me of corpus) {
    const before = related.rankRelated(me, corpus.filter(c => c.id !== me.id).slice(0, 60)).map(c => c.slug)
    const after = related.rankRelated(me, pool61.filter(c => c.id !== me.id).slice(0, 60)).map(c => c.slug)
    assert.deepEqual(after, before, me.slug)
    if (after.length) withRelated++
  }
  assert.ok(withRelated > 250)
})

test('page source: no per-detail candidate query; the lookup is shared and single', () => {
  const page = readFileSync('src/app/(public)/insights/[slug]/page.tsx', 'utf8')
  assert.doesNotMatch(page, /\.limit\(60\)/)
  assert.match(page, /relatedCandidates\(insight\.id\)/)
  assert.equal(page.match(/getInsight\(slug\)/g).length, 2) // generateMetadata + page, one cached function
  assert.match(page, /const getInsight = cache\(/)
})
