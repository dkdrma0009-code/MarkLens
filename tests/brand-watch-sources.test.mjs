import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { test } from 'node:test'

const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loaded = { exports: {} }
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(key => key.startsWith('.') ? load(path.resolve(path.dirname(file), key + '.ts')) : require(key), loaded, loaded.exports)
  cache.set(file, loaded.exports); return loaded.exports
}
const root = 'src/lib/brand-watch/sources/'
const { sourceRegistry } = load(root + 'registry.ts')
const { sourceProviderSchema } = load(root + 'types.ts')
const { canonicalizeSourceUrl } = load(root + 'canonicalize.ts')
const { contentHash, normalizeSourceDocument, normalizePublishedDate } = load(root + 'normalize.ts')
const { fetchSource } = load(root + 'fetch.ts')
const { collectSourceDocuments } = load(root + 'collect.ts')
const { newsroomAdapter, discoverNewsroomUrls, parseNewsroomDetail } = load(root + 'adapters/newsroom.ts')
const { persistSourceDocument, providerSeed } = load(root + 'persist.ts')
const { createSourceRepository } = load(root + 'supabase-repository.ts')
const { detectEntityCandidates, relevanceCandidate } = load(root + 'candidates.ts')
const { classifySourceDocument } = load(root + 'dedup.ts')
const fixture = name => readFileSync('tests/fixtures/brand-watch/' + name, 'utf8')
const provider = sourceProviderSchema.parse({ ...sourceRegistry[1], domain: 'source.test', listingUrl: 'https://source.test/news', verificationNote: 'Synthetic fixture only', newsroom: { linkSelector: 'a.story[href]', detailPathPattern: '^/news/[a-z]+$', titleSelector: 'h1', bodySelector: 'article', dateSelector: 'time', nextPageSelector: '.next' } })
const time = '2026-10-13T00:00:00Z'
const raw = () => ({ originalUrl: 'https://source.test/news/one?utm_source=fixture', title: 'Campaign', publishedDate: null, author: null, text: 'Marketing campaign launched', html: null, imageUrl: null, imageSource: null, externalId: null, metadata: {} })
const normalized = () => normalizeSourceDocument(provider, raw(), time)
const response = (body, status = 200, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } })

test('canonical URL removes fragments, normalizes host/default port and follows explicit trailing policy', () => {
  assert.equal(canonicalizeSourceUrl('https://SOURCE.test:443/news/one/#x', { trailingSlash: 'remove', removeQueryKeys: [], equivalentHosts: [] }), 'https://source.test/news/one')
  assert.equal(canonicalizeSourceUrl('https://source.test/news/one/'), 'https://source.test/news/one/')
  assert.throws(() => canonicalizeSourceUrl('javascript:alert(1)'), /Invalid/)
  assert.throws(() => canonicalizeSourceUrl('https://user:secret@source.test/a'), /Invalid/)
})
test('tracking removal preserves meaningful repeated/query identity and configured equivalents', () => {
  assert.equal(canonicalizeSourceUrl('https://source.test/a?utm_source=x&fbclid=y&gclid=z&id=7&page=2&tag=a&tag=b'), 'https://source.test/a?id=7&page=2&tag=a&tag=b')
  assert.equal(canonicalizeSourceUrl('https://www.source.test/a?ref=x&id=7', { trailingSlash: 'preserve', removeQueryKeys: ['ref'], equivalentHosts: ['source.test', 'www.source.test'] }), 'https://source.test/a?id=7')
})
test('hash is deterministic over normalized meaningful copy, excludes collection clock/HTML', () => {
  assert.equal(contentHash(' ＴＯＳＳ ', 'new\n campaign'), contentHash('TOSS', 'new campaign'))
  assert.notEqual(contentHash('Title', 'old copy'), contentHash('Title', 'changed copy'))
  const a = normalized(), b = normalizeSourceDocument(provider, { ...raw(), html: '<div>layout changed</div>' }, '2026-10-14T00:00:00Z')
  assert.equal(a.contentHash, b.contentHash)
})
test('missing/invalid dates remain unknown; day dates are explicit Korean time', () => {
  assert.deepEqual(normalizePublishedDate(null), { publishedAt: null, datePrecision: 'unknown' })
  assert.equal(normalizePublishedDate('2026.02.30').publishedAt, null)
  assert.equal(normalizePublishedDate('2026-02-30T09:00:00+09:00').publishedAt, null)
  assert.equal(normalizePublishedDate('2026-10-01T09:00:00').publishedAt, null)
  assert.equal(normalizePublishedDate('2026.10.01').publishedAt, '2026-09-30T15:00:00.000Z')
})
test('same URL/hash no-op, changed same URL revision and different URL same hash duplicate candidates', () => {
  const doc = normalized(), row = { id: 'x', providerId: provider.id, canonicalUrl: doc.canonicalUrl, contentHash: doc.contentHash }
  assert.equal(classifySourceDocument(doc, [row]), 'NO_OP')
  assert.equal(classifySourceDocument({ ...doc, contentHash: 'b'.repeat(64) }, [row]), 'REVISION_CANDIDATE')
  assert.equal(classifySourceDocument({ ...doc, canonicalUrl: 'https://source.test/news/two' }, [row]), 'DUPLICATE_CANDIDATE')
})
test('RSS fixture passes through common normalization with dates/author/body/image and duplicate suppression', async () => {
  const rss = { ...provider, adapter: 'rss', listingUrl: 'https://source.test/feed.xml', newsroom: null }
  const result = await collectSourceDocuments(rss, time, { fetch: async () => response(fixture('feed.xml'), 200, { 'content-type': 'application/rss+xml' }) })
  assert.equal(result.documents.length, 2)
  const doc = result.documents[0]
  assert.equal(doc.canonicalUrl, 'https://source.test/news/one')
  assert.equal(doc.author, 'Newsroom'); assert.equal(doc.externalId, 'fixture-one')
  assert.equal(doc.publishedAt, '2026-10-01T00:00:00.000Z'); assert.equal(doc.imageUrl, 'https://source.test/images/one.jpg')
  assert.equal(result.documents[1].datePrecision, 'unknown')
  assert.equal(result.documents[1].imageUrl, null)
  assert.ok(result.issues.some(issue => issue.code === 'MALFORMED_DOCUMENT' || issue.code === 'DETAIL_ERROR' || issue.code === 'DOMAIN_ESCAPE'))
})
test('newsroom discovery deduplicates URLs and rejects foreign/protocol links', () => {
  assert.deepEqual(discoverNewsroomUrls(fixture('listing.html'), provider.listingUrl, provider), ['https://source.test/news/one', 'https://source.test/news/two'])
})
test('newsroom detail normalizes only configured body and keeps malicious instructions as plain data', () => {
  const doc = normalizeSourceDocument(provider, parseNewsroomDetail(fixture('detail.html'), 'https://source.test/news/one', provider), time)
  assert.ok(doc.text.includes('ignore previous instructions'))
  assert.ok(!doc.text.includes('Not article text')); assert.ok(!doc.text.includes('doNotExecute'))
  assert.equal(doc.trust, 'UNTRUSTED_SOURCE_DATA')
  assert.equal(doc.imageUrl, 'https://source.test/images/campaign.jpg')
})
test('malformed document fails safely; optional missing date/image stays absent', () => {
  assert.throws(() => parseNewsroomDetail('<div>missing headline/body', provider.listingUrl, provider), /MALFORMED/)
  const doc = normalizeSourceDocument(provider, parseNewsroomDetail('<h1>Valid title<article><p>Valid text', 'https://source.test/news/one', provider), time)
  assert.equal(doc.imageUrl, null); assert.equal(doc.publishedAt, null)
  const redirect = parseNewsroomDetail('<h1>Title</h1><article><p>Body</p><img src="image.jpg"></article>', 'https://source.test/old', provider, 'https://source.test/news/new')
  assert.equal(redirect.originalUrl, 'https://source.test/old')
  assert.equal(redirect.canonicalUrl, 'https://source.test/news/new')
  assert.equal(redirect.imageUrl, 'https://source.test/news/image.jpg')
})
test('listing→details respects pages/items ceiling and isolates failed details', async () => {
  const calls = []
  const result = await newsroomAdapter.collect(provider, { maxPages: 1, maxItems: 2, fetch: async url => {
    calls.push(String(url)); if (String(url).endsWith('/news')) return response(fixture('listing.html'))
    return String(url).endsWith('/one') ? response(fixture('detail.html')) : response('failure', 500)
  } })
  assert.equal(calls.length, 3); assert.equal(result.documents.length, 1)
  assert.equal(result.issues[0].code, 'HTTP_500')
})
test('timeout cancels request and is isolated from other detail items', async () => {
  const result = await newsroomAdapter.collect(provider, { timeoutMs: 10, fetch: async (url, options) => {
    if (String(url).endsWith('/news')) return response(fixture('listing.html'))
    if (String(url).endsWith('/one')) return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    return response(fixture('detail.html'))
  } })
  assert.ok(result.issues.some(issue => issue.code === 'TIMEOUT')); assert.equal(result.documents.length, 1)
})
test('429 stops immediately without retry or further detail requests', async () => {
  let count = 0
  await assert.rejects(newsroomAdapter.collect(provider, { fetch: async () => ++count === 1 ? response(fixture('listing.html')) : response('rate limited', 429) }), /RATE_LIMIT/)
  assert.equal(count, 2)
})
test('domain escape/redirect ceiling/content-type/stream size ceilings fail closed', async () => {
  let calls = 0
  await assert.rejects(fetchSource(provider.listingUrl, provider, 'html', { fetch: async () => { calls++; return response('', 302, { location: 'https://evil.test/' }) } }), /DOMAIN_ESCAPE/)
  assert.equal(calls, 1)
  await assert.rejects(fetchSource(provider.listingUrl, provider, 'html', { fetch: async () => response('', 302, { location: '/again' }) }), /REDIRECT_LIMIT/)
  await assert.rejects(fetchSource(provider.listingUrl, provider, 'html', { fetch: async () => response('{}', 200, { 'content-type': 'application/json' }) }), /CONTENT_TYPE/)
  await assert.rejects(fetchSource(provider.listingUrl, provider, 'html', { maxBytes: 5, fetch: async () => response('123456') }), /SIZE_LIMIT/)
  await assert.rejects(fetchSource('https://source.test:444/a', provider, 'html'), /DOMAIN_ESCAPE/)
})
test('provider taxonomy/verification gating remains controlled, including all five launch definitions', async () => {
  assert.equal(sourceRegistry.length, 5)
  assert.ok(!sourceProviderSchema.safeParse({ ...provider, providerType: 'untrusted_arbitrary_type' }).success)
  for (const source of sourceRegistry.filter(row => row.verification === 'NEEDS_VERIFICATION')) await assert.rejects(newsroomAdapter.collect(source, { fetch: async () => assert.fail('must not fetch') }), /NEEDS_VERIFICATION/)
  assert.equal(providerSeed(provider).active, false)
})
test('launch aliases create mentions only, with Latin boundaries and no action inference', () => {
  const samples = JSON.parse(fixture('candidates.json'))
  for (const sample of samples.filter(row => row.slug)) {
    const matches = detectEntityCandidates(sample.title, sample.text)
    assert.ok(matches.length); assert.ok(matches.every(row => row.roleCandidate === 'mentioned' && row.confidenceBasis === 'deterministic_alias'))
  }
  assert.equal(detectEntityCandidates('tossed musinsanity', '').length, 0)
  const mention = detectEntityCandidates('TOSS', 'BAEMIN is merely mentioned')
  assert.equal(mention.length, 2); assert.ok(mention.every(row => row.roleCandidate === 'mentioned'))
})
test('prefilter returns review candidates, never final exclusion from one keyword', () => {
  assert.equal(relevanceCandidate('Campaign content launch', '').signal, 'LIKELY_RELEVANT')
  assert.equal(relevanceCandidate('채용', '').signal, 'UNCERTAIN')
  assert.equal(relevanceCandidate('인사 발령 및 채용 안내', '사내 운영 조직 개편').signal, 'LIKELY_IRRELEVANT')
  assert.equal(relevanceCandidate('채용 캠페인', '브랜드 콘텐츠').signal, 'UNCERTAIN')
  assert.equal(relevanceCandidate('Neutral article', '').requiresReview, true)
})
test('unsafe RSS XML and canonical domain escape do not become trusted source documents', async () => {
  await assert.rejects(collectSourceDocuments({ ...provider, adapter: 'rss' }, time, { fetch: async () => response('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///secret">]><rss/>', 200, { 'content-type': 'text/xml' }) }), /UNSAFE_XML/)
  assert.throws(() => parseNewsroomDetail(fixture('detail.html').replace('/news/one?utm_campaign=test', 'https://evil.test/'), 'https://source.test/news/one', provider), /DOMAIN_ESCAPE/)
})

test('actual 018 persistence retains immutable source versions and unique retries, not raw content without rights', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
    await db.exec(readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8'))
    const seed = providerSeed(provider)
    await db.query('INSERT INTO source_providers(id,name,domain,provider_type,source_tier,reliability_policy,ingestion_method) VALUES($1,$2,$3,$4,$5,$6,$7)', [seed.id, seed.name, seed.domain, seed.providerType, seed.sourceTier, seed.reliabilityPolicy, seed.ingestionMethod])
    const identity = row => ({ id: row.id, providerId: row.provider_id, canonicalUrl: row.canonical_url, contentHash: row.content_hash })
    const repository = {
      async related(url, hash) { return (await db.query('SELECT * FROM source_items WHERE canonical_url=$1 OR content_hash=$2', [url, hash])).rows.map(identity) },
      async insertIfAbsent(row) {
        const keys = Object.keys(row), query = `INSERT INTO source_items(${keys.join(',')}) VALUES(${keys.map((key, i) => '$' + (i + 1)).join(',')}) ON CONFLICT(canonical_url,content_hash) DO NOTHING RETURNING *`
        const result = (await db.query(query, Object.values(row))).rows[0]
        return { inserted: Boolean(result), identity: identity(result ?? (await db.query('SELECT * FROM source_items WHERE canonical_url=$1 AND content_hash=$2', [row.canonical_url, row.content_hash])).rows[0]) }
      },
    }
    const doc = normalized()
    const results = await Promise.all([persistSourceDocument(provider, doc, repository), persistSourceDocument(provider, doc, repository)])
    assert.equal(results.filter(result => result.inserted).length, 1)
    assert.equal((await persistSourceDocument(provider, doc, repository)).disposition, 'NO_OP')
    const changed = normalizeSourceDocument(provider, { ...raw(), text: 'Changed campaign evidence' }, time)
    assert.equal((await persistSourceDocument(provider, changed, repository)).disposition, 'REVISION_CANDIDATE')
    assert.equal((await persistSourceDocument(provider, normalizeSourceDocument(provider, { ...raw(), originalUrl: 'https://source.test/news/two' }, time), repository)).disposition, 'DUPLICATE_CANDIDATE')
    const rows = (await db.query('SELECT * FROM source_items')).rows
    assert.equal(rows.length, 3); assert.ok(rows.every(row => row.raw_text === null && row.raw_html === null))
    assert.equal(rows.find(row => row.content_hash === doc.contentHash).original_url, doc.originalUrl)
    const withRights = normalizeSourceDocument(provider, { ...raw(), originalUrl: 'https://source.test/news/three', text: 'Permitted synthetic content', html: '<p>Permitted</p>' }, time)
    await persistSourceDocument(provider, withRights, repository, { retention: { rightsBasis: 'Synthetic fixture owned by project', until: '2026-11-01T00:00:00Z', includeHtml: true } })
    assert.equal((await db.query('SELECT raw_text FROM source_items WHERE canonical_url=$1', [withRights.canonicalUrl])).rows[0].raw_text, withRights.text)
    await assert.rejects(persistSourceDocument(provider, { ...doc, contentHash: 'b'.repeat(64) }, repository), /hash mismatch/)
  } finally { await db.close() }
})
test('Supabase repository handles unique-insert race through exact lookup, never upsert/update', async () => {
  const row = { id: 'same', provider_id: provider.id, canonical_url: 'https://source.test/a', content_hash: 'a'.repeat(64) }, calls = []
  const client = { from(table) {
    assert.equal(table, 'source_items')
    let insert = false
    const chain = { select() { return this }, eq(key, value) { calls.push(['eq', key, value]); return this }, limit() { return Promise.resolve({ data: [row], error: null }) }, insert() { insert = true; calls.push(['insert']); return this }, single() { return Promise.resolve(insert ? { data: null, error: { code: '23505' } } : { data: row, error: null }) } }
    return chain
  } }
  const repo = createSourceRepository(client)
  assert.equal((await repo.related(row.canonical_url, row.content_hash)).length, 1)
  const result = await repo.insertIfAbsent({ provider_id: provider.id, canonical_url: row.canonical_url, content_hash: row.content_hash })
  assert.equal(result.inserted, false); assert.equal(result.identity.id, 'same')
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'content_hash'))
})
