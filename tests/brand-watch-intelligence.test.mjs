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
const root = 'src/lib/brand-watch/'
const { sourceRegistry } = load(root + 'sources/registry.ts')
const { normalizeSourceDocument } = load(root + 'sources/normalize.ts')
const { launchRegistry } = load(root + 'registry.ts')
const { brandEvidenceExtractionSchema } = load(root + 'evidence/schemas.ts')
const { normalizeSupport } = load(root + 'evidence/support.ts')
const { extractEvidenceCandidates } = load(root + 'evidence/extract.ts')
const { BrandWatchAIError } = load(root + 'evidence/transport.ts')
const { createGeminiEvidenceTransport } = load(root + 'evidence/gemini-transport.ts')
const { preparePendingEvidence } = load(root + 'evidence/storage.ts')
const { prepareDraftMovement } = load(root + 'movements/storage.ts')
const { movementCandidateSchema } = load(root + 'movements/schemas.ts')
const { buildMovementCandidates } = load(root + 'movements/assemble.ts')
const { assessMovementCluster, assembleMovementCandidate } = load(root + 'movements/cluster.ts')
const { independentSourceCandidate } = load(root + 'movements/independence.ts')
const { analyzeBrandWatchSource } = load(root + 'pipeline.ts')
const { BRAND_WATCH_EVIDENCE_PROMPT_VERSION, BRAND_WATCH_PIPELINE_VERSION } = load(root + 'evidence/prompts.ts')
const fixtures = JSON.parse(readFileSync('tests/fixtures/brand-watch/intelligence.json', 'utf8'))
const id = n => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z'
const confidence = { score: 0.9, basis: 'Direct attributed action in a quoted source span; unreviewed.' }
function source(name = 'official', n = 1, overrides = {}) {
  const content = fixtures[name]
  const provider = { ...sourceRegistry[2], id: id(n + 100), key: 'synthetic-' + n, domain: 'source-' + n + '.test', listingUrl: `https://source-${n}.test/newsroom` }
  const document = normalizeSourceDocument(provider, { originalUrl: `https://source-${n}.test/story`, title: content.title, text: content.text, publishedDate: null, author: 'Synthetic author', html: null, imageUrl: null, imageSource: null, externalId: null, metadata: {}, ...overrides }, '2026-10-13T00:00:00Z')
  return { sourceItemId: id(n), document, providerType: name === 'media' || name === 'duplicate' ? 'industry_media' : 'official_newsroom', declaredOriginUrl: null }
}
function item(quote = fixtures.official.quote1, changes = {}) {
  return { key: 'e1', entitySlug: 'toss', fact: 'TOSS launched the Signal Week campaign.', factType: 'launch', movementType: 'campaign', eventName: 'Signal Week', eventDate: '2026-10-01', datePrecision: 'day', support: quote, sourceLocator: { field: 'text' }, marketingRelevance: 'relevant', entityRole: 'primary', confidence, exclusionReason: null, ...changes }
}
function output(items = [item()], changes = {}) {
  return { entityRoles: [{ entitySlug: items[0]?.entitySlug ?? 'toss', role: items[0]?.entityRole ?? 'primary', support: items[0]?.support ?? fixtures.official.quote1, sourceLocator: { field: 'text' }, confidence }], relevance: { decision: 'relevant', rationale: 'Direct marketing campaign announcement.', relevantDimensions: ['campaign'], exclusionReason: null, confidence }, evidence: items, unknownExternalEntities: [], ...changes }
}
function transport(value = output(), changes = {}) {
  return { provider: 'mock-gemini', model: 'fixture-model-v1', async generate() { return { kind: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) } }, ...changes }
}
const extract = (src = source(), value = output(), policy = {}) => extractEvidenceCandidates(src, [transport(value)], generatedAt, policy)

test('strict evidence schema accepts bounded candidates and controlled types', () => {
  assert.ok(brandEvidenceExtractionSchema.safeParse(output()).success)
  assert.ok(!brandEvidenceExtractionSchema.safeParse(output([item(undefined, { movementType: 'offline' })])).success)
  assert.ok(!brandEvidenceExtractionSchema.safeParse(output([item(undefined, { support: 'x'.repeat(301) })])).success)
})
test('unknown AI fields and approval attempts are schema failures', async () => {
  for (const response of [output([item(undefined, { approved: true })]), { ...output(), publish: true }]) {
    const result = await extract(source(), response)
    assert.equal(result.status, 'AI_FAILURE'); assert.equal(result.error, 'SCHEMA_FAILURE')
  }
})
test('support locator points into normalized source with hash, not invented raw offsets', async () => {
  const src = source(), result = await extract(src), candidate = result.evidence[0], locator = candidate.validation.locator
  assert.equal(candidate.validation.valid, true)
  assert.equal(normalizeSupport(src.document.text).slice(locator.start, locator.end), normalizeSupport(candidate.item.support))
  assert.equal(locator.sourceHash, src.document.contentHash)
})
test('punctuation/HTML entity/whitespace variation is narrow normalization, not fuzzy acceptance', async () => {
  const text = 'On 2026-10-01, TOSS launched “Signal Week” — an R&D campaign.'
  const src = source('official', 1, { text })
  const result = await extract(src, output([item('On 2026-10-01, TOSS launched "Signal Week" - an R&amp;D campaign.')]))
  assert.equal(result.evidence[0].validation.valid, true)
})
test('fabricated support remains invalid and cannot assemble or prepare DB rows', async () => {
  const src = source(), result = await extract(src, output([item(fixtures.unsupportedAI.support, { fact: fixtures.unsupportedAI.fact })]))
  assert.ok(result.evidence[0].validation.issues.includes('INVALID_SUPPORT'))
  assert.equal(buildMovementCandidates(result.evidence, [src]).length, 0)
  assert.throws(() => preparePendingEvidence(result.evidence[0], src), /INVALID_EVIDENCE/)
})
test('unsupported numbers, event dates and unrelated named-event claims are rejected', async () => {
  for (const [changes, code] of [[{ fact: 'TOSS gained 9000 conversions.' }, 'UNSUPPORTED_NUMBER'], [{ eventDate: '2027-10-01' }, 'UNSUPPORTED_EVENT_DATE'], [{ eventName: 'Invented Festival' }, 'UNSUPPORTED_EVENT_NAME']]) {
    const result = await extract(source(), output([item(undefined, changes)]))
    assert.ok(result.evidence[0].validation.issues.includes(code)); assert.equal(result.evidence[0].validation.valid, false)
  }
})
test('mentioned brands never become movement actions, including an AI primary misclassification', async () => {
  const src = source('mentioned'), quote = fixtures.mentioned.quote1
  const mentioned = item(quote, { entitySlug: 'musinsa', entityRole: 'mentioned', fact: 'MUSINSA introduced another brand campaign.', eventName: null, eventDate: null, datePrecision: 'unknown' })
  const result = await extract(src, output([mentioned]))
  assert.equal(buildMovementCandidates(result.evidence, [src]).length, 0)
  const wrong = await extract(src, output([{ ...mentioned, entityRole: 'primary' }]))
  assert.ok(wrong.evidence[0].validation.issues.includes('MENTION_ONLY_OR_AMBIGUOUS_ACTOR'))
  assert.equal(buildMovementCandidates(wrong.evidence, [src]).length, 0)
})
test('unknown registry entities are rejected; source-backed external names remain names only', async () => {
  const result = await extract(source(), output([item(undefined, { entitySlug: 'invented-brand' })]))
  assert.equal(result.error, 'SCHEMA_FAILURE')
  const src = source('mentioned'), response = output([], { unknownExternalEntities: ['Nike', 'Invented Entity'] })
  const external = await extract(src, response)
  assert.deepEqual(external.unknownExternalEntities, ['Nike'])
  assert.equal(launchRegistry.length, 5)
})
test('related entities do not become core-brand actions through alias substrings', async () => {
  for (const quote of ['On 2026-10-01, Toss Bank launched the Signal Week campaign.', '2026-10-01 토스뱅크가 Signal Week 캠페인을 공개했다.']) {
    const src = source('official', 1, { text: quote })
    const result = await extract(src, output([item(quote)]))
    assert.ok(result.evidence[0].validation.issues.includes('RELATED_ENTITY_BOUNDARY_REVIEW_REQUIRED'))
    assert.equal(buildMovementCandidates(result.evidence, [src]).length, 0)
  }
})
test('finance-only and hiring-only AI relevance suppress evidence without deleting source data', async () => {
  for (const name of ['finance', 'hiring']) {
    const src = source(name), before = src.document.contentHash
    const result = await extract(src, output([], { relevance: { decision: 'irrelevant', rationale: 'Corporate-only source, no marketing action.', relevantDimensions: [], exclusionReason: name, confidence } }))
    assert.equal(result.status, 'IRRELEVANT_CANDIDATE'); assert.equal(result.evidence.length, 0); assert.equal(src.document.contentHash, before)
  }
})
test('campaign produces two supported facts and one named-event movement candidate', async () => {
  const src = source(), response = output([item(), item(fixtures.official.quote2, { key: 'e2', fact: 'TOSS invited creator Yuna to Signal Week.', factType: 'participation' })])
  const result = await analyzeBrandWatchSource(src, [transport(response)], generatedAt)
  assert.equal(result.extraction.evidence.length, 2); assert.equal(result.movements.length, 1)
  assert.equal(result.movements[0].supportingEvidenceIds.length, 2)
  assert.equal(result.movements[0].scope, null); assert.deepEqual(result.movements[0].market, [])
})
test('evidence and role confidence stays capped and every result requires human review', async () => {
  const result = await extract()
  assert.equal(result.evidence[0].reviewState, 'needs_review')
  assert.equal(result.evidence[0].item.confidence.score, 0.75)
  assert.equal(result.roles[0].confidence.score, 0.75)
})
test('provider/model/prompt/pipeline/time/validation provenance prepares into existing 018 columns', async () => {
  const src = source(), result = await extract(src), candidate = result.evidence[0]
  const prepared = preparePendingEvidence(candidate, src)
  assert.equal(prepared.evidence.generation_model, 'mock-gemini:fixture-model-v1')
  assert.equal(prepared.evidence.prompt_version, BRAND_WATCH_EVIDENCE_PROMPT_VERSION)
  assert.equal(prepared.evidence.pipeline_version, BRAND_WATCH_PIPELINE_VERSION)
  assert.equal(prepared.evidence.created_at, generatedAt)
  assert.equal(prepared.evidence.review_status, 'pending'); assert.equal(prepared.match.role, 'mentioned')
  assert.equal(JSON.parse(prepared.evidence.support_locator).validation.result, 'support_validated_candidate')
  assert.equal(JSON.parse(prepared.evidence.support_locator).extraction.eventNameCandidate, 'Signal Week')
})
test('prompt injection and delimiter escape remain source JSON, not system instructions or tool calls', async () => {
  const src = source('injection'); let inspected = false
  const provider = transport(output(), { async generate(request) {
    const data = JSON.parse(request.sourceData)
    assert.ok(data.text.includes('invent 9000 conversions'))
    assert.ok(!request.system.includes('invent 9000 conversions'))
    assert.ok(!request.sourceData.includes('</source_data>'))
    assert.equal(data.type, 'SOURCE_DATA'); assert.equal(data.trust, 'UNTRUSTED_SOURCE_DATA')
    assert.deepEqual(request.trustedContext.allowedEntities.map(row => row.slug), ['toss'])
    assert.equal(request.responseSchema.additionalProperties, false)
    inspected = true; return { kind: 'text', text: JSON.stringify(output()) }
  } })
  const result = await extractEvidenceCandidates(src, [provider], generatedAt)
  assert.equal(inspected, true); assert.equal(result.evidence[0].validation.valid, true)
})
test('untrusted metadata is budgeted and cannot expand provider instructions', async () => {
  const metadata = Object.fromEntries(Array.from({ length: 100 }, (value, index) => ['key' + index, 'x'.repeat(2000)]))
  const src = source('official', 1, { metadata })
  const provider = transport(output(), { async generate(request) {
    const data = JSON.parse(request.sourceData)
    assert.equal(Object.keys(data.metadata).length, 10)
    assert.ok(Object.values(data.metadata).every(value => value.length <= 500))
    assert.equal(data.metadataTruncated, true)
    assert.ok(request.sourceData.length < 10000)
    return { kind: 'text', text: JSON.stringify(output()) }
  } })
  const result = await extractEvidenceCandidates(src, [provider], generatedAt)
  assert.equal(result.evidence[0].validation.valid, true)
})
test('movement requires valid same-entity evidence and controlled taxonomy', async () => {
  assert.equal(buildMovementCandidates([], [source()]).length, 0)
  const src = source(), extraction = await extract(src), movement = buildMovementCandidates(extraction.evidence, [src])[0]
  assert.ok(!movementCandidateSchema.safeParse({ ...movement, supportingEvidenceIds: [] }).success)
  assert.ok(!movementCandidateSchema.safeParse({ ...movement, movementType: 'global' }).success)
  assert.ok(!movementCandidateSchema.safeParse({ ...movement, reviewState: 'published' }).success)
  assert.equal(buildMovementCandidates([{ ...extraction.evidence[0], entityId: id(88) }], [src]).length, 0)
})
async function movements() {
  const official = source(), media = source('media', 2)
  const a = await analyzeBrandWatchSource(official, [transport(output())], generatedAt)
  const b = await analyzeBrandWatchSource(media, [transport(output([item(fixtures.media.quote1)]))], generatedAt)
  return { official, media, a, b }
}
test('same named event/date across second source attaches evidence to one unreviewed candidate', async () => {
  const { official, media, a, b } = await movements()
  const assessment = assessMovementCluster(b.movements[0], a.movements[0])
  assert.equal(assessment.decision, 'SAME_EVENT_HIGH')
  const result = assembleMovementCandidate(b.movements[0], a.movements, [official, media])
  assert.equal(result.disposition, 'ATTACHED_TO_CANDIDATE'); assert.equal(result.movement.id, a.movements[0].id)
  assert.equal(result.movement.supportingEvidenceIds.length, 2); assert.equal(result.movement.reviewState, 'needs_review')
  assert.equal(a.movements[0].supportingEvidenceIds.length, 1)
})
test('complete fixture trace: two official facts plus media evidence produce one candidate and three source-traceable facts', async () => {
  const official = source(), media = source('media', 2)
  const a = await analyzeBrandWatchSource(official, [transport(output([item(), item(fixtures.official.quote2, { key: 'e2', fact: 'TOSS invited creator Yuna to Signal Week.', factType: 'participation' })]))], generatedAt)
  const b = await analyzeBrandWatchSource(media, [transport(output([item(fixtures.media.quote1)]))], generatedAt)
  const assembled = assembleMovementCandidate(b.movements[0], a.movements, [official, media])
  const evidence = [...a.extraction.evidence, ...b.extraction.evidence]
  assert.equal(assembled.movement.supportingEvidenceIds.length, 3)
  assert.equal(assembled.movement.sourceItemIds.length, 2)
  for (const evidenceId of assembled.movement.supportingEvidenceIds) {
    const fact = evidence.find(row => row.id === evidenceId)
    const sourceDocument = [official, media].find(row => row.sourceItemId === fact.sourceItemId).document
    const pointer = fact.validation.locator
    assert.equal(normalizeSupport(sourceDocument[pointer.field]).slice(pointer.start, pointer.end), normalizeSupport(fact.item.support))
  }
})
test('missing date/uncertain duplicate requires review and does not mutate existing movement', async () => {
  const { official, media, a, b } = await movements()
  const candidate = { ...b.movements[0], eventDate: null }
  const result = assembleMovementCandidate(candidate, a.movements, [official, media])
  assert.equal(result.disposition, 'MERGE_REVIEW_REQUIRED')
  assert.equal(result.assessments[0].mergeReviewRequired, true)
  assert.equal(result.movement.id, candidate.id)
})
test('different event names/distant dates/entities remain separate, never title-only auto-merges', async () => {
  const { a, b } = await movements()
  for (const changes of [{ eventName: 'Different Festival' }, { eventDate: '2026-12-01' }, { entityId: launchRegistry[0].entity.id, entitySlug: 'musinsa' }]) assert.equal(assessMovementCluster({ ...b.movements[0], ...changes }, a.movements[0]).decision, 'DIFFERENT_EVENT')
  const unnamed = { ...b.movements[0], eventName: null }
  assert.equal(assessMovementCluster(unnamed, a.movements[0]).decision, 'POSSIBLY_SAME')
  assert.equal(assessMovementCluster({ ...b.movements[0], movementType: 'partnership' }, a.movements[0]).decision, 'POSSIBLY_SAME')
  assert.equal(assessMovementCluster({ ...b.movements[0], title: a.movements[0].title, eventName: null, eventDate: null }, { ...a.movements[0], eventName: null, eventDate: null }).decision, 'POSSIBLY_SAME')
})
test('republication, shared origin and changed same-URL versions are not independent sources', () => {
  const a = source(), duplicate = source('duplicate', 2)
  assert.equal(independentSourceCandidate(a, duplicate).signal, 'NOT_INDEPENDENT')
  const media = source('media', 3)
  assert.equal(independentSourceCandidate(a, media).signal, 'POSSIBLY_INDEPENDENT')
  assert.equal(independentSourceCandidate(a, { ...media, declaredOriginUrl: a.document.canonicalUrl }).signal, 'NOT_INDEPENDENT')
  const changed = { ...source('changed', 1), sourceItemId: id(9) }
  assert.ok(independentSourceCandidate(a, changed).basis.includes('same_canonical_source_or_revision'))
})
test('malformed JSON has no evidence and no paid fallback attempt', async () => {
  let fallback = 0
  const result = await extractEvidenceCandidates(source(), [transport(fixtures.malformedAI), transport(output(), { async generate() { fallback++; return { kind: 'text', text: JSON.stringify(output()) } } })], generatedAt)
  assert.equal(result.error, 'MALFORMED_OUTPUT'); assert.equal(fallback, 0); assert.equal(result.evidence.length, 0)
})
test('Zod failure and invalid support do not trigger fallback regeneration', async () => {
  for (const value of [{ unexpected: true }, output([item('A wholly fabricated source quotation.')])]) {
    let second = 0
    const result = await extractEvidenceCandidates(source(), [transport(value), transport(output(), { async generate() { second++; throw new Error('not expected') } })], generatedAt)
    assert.equal(second, 0)
    assert.equal(result.evidence.filter(row => row.validation.valid).length, 0)
  }
})
test('timeout aborts transport and returns bounded failure without requiring credentials', async () => {
  let aborted = false
  const provider = transport(output(), { generate(request, signal) { return new Promise((resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new BrandWatchAIError('TIMEOUT')) }, { once: true })) } })
  const result = await extractEvidenceCandidates(source(), [provider], generatedAt, { timeoutMs: 10 })
  assert.equal(result.error, 'TIMEOUT'); assert.equal(aborted, true); assert.equal(result.attempts.length, 1)
})
test('429 SDK-style errors stop the pipeline immediately without retry/fallback', async () => {
  let fallback = 0
  const result = await extractEvidenceCandidates(source(), [transport(output(), { async generate() { throw Object.assign(new Error('redacted rate error'), { status: 429 }) } }), transport(output(), { async generate() { fallback++; throw new Error('must not call') } })], generatedAt)
  assert.equal(result.error, 'RATE_LIMIT'); assert.equal(fallback, 0)
})
test('network fallback is bounded at two attempts and records actual successful provider/model', async () => {
  const providers = [transport(output(), { provider: 'mock-first', async generate() { throw new BrandWatchAIError('NETWORK') } }), transport(output(), { provider: 'mock-second', model: 'second-model' })]
  const result = await extractEvidenceCandidates(source(), providers, generatedAt)
  assert.equal(result.provenance.provider, 'mock-second'); assert.equal(result.provenance.model, 'second-model'); assert.equal(result.attempts.length, 2)
  let count = 0
  const failing = transport(output(), { async generate() { count++; throw new BrandWatchAIError('NETWORK') } })
  const fail = await extractEvidenceCandidates(source(), [failing, failing, failing], generatedAt)
  assert.equal(count, 2); assert.equal(fail.attempts.length, 2)
  await assert.rejects(extractEvidenceCandidates(source(), [failing], generatedAt, { maxAttempts: 3 }), /Invalid AI policy/)
})
test('safety refusal and non-retryable provider errors never fall back', async () => {
  for (const provider of [transport(output(), { async generate() { return { kind: 'refusal' } } }), transport(output(), { async generate() { throw Object.assign(new Error('config error'), { status: 401 }) } })]) {
    let fallback = 0
    const result = await extractEvidenceCandidates(source(), [provider, transport(output(), { async generate() { fallback++; throw new Error('must not call') } })], generatedAt)
    assert.ok(['SAFETY_REFUSAL', 'PROVIDER_ERROR'].includes(result.error)); assert.equal(fallback, 0)
  }
})
test('likely irrelevant prefilter is configurable: assess by default, explicit skip avoids API attempt', async () => {
  const src = source('hiring', 1, { text: 'TOSS announced generic hiring and internal operations changes.' }); let calls = 0
  const provider = transport(output([]), { async generate() { calls++; return { kind: 'text', text: JSON.stringify(output([])) } } })
  await extractEvidenceCandidates(src, [provider], generatedAt)
  assert.equal(calls, 1)
  const skipped = await extractEvidenceCandidates(src, [provider], generatedAt, { skipLikelyIrrelevant: true })
  assert.equal(skipped.status, 'SKIPPED_POLICY'); assert.equal(calls, 1)
})
test('secondary is a direct-participant candidate, never a reviewed role or automatic primary', async () => {
  const quote = 'On 2026-10-01, TOSS and OLIVE YOUNG launched the Signal Week campaign.'
  const src = source('official', 1, { text: quote })
  const response = output([item(quote, { entitySlug: 'olive-young', entityRole: 'secondary', fact: 'OLIVE YOUNG participated in Signal Week.' })])
  const result = await analyzeBrandWatchSource(src, [transport(response)], generatedAt)
  assert.equal(result.extraction.evidence[0].item.entityRole, 'secondary')
  assert.equal(result.extraction.evidence[0].reviewState, 'needs_review')
  assert.equal(result.movements.length, 1)
  assert.equal(preparePendingEvidence(result.extraction.evidence[0], src).match.role, 'mentioned')
})
test('sources without registry mentions and truncated inputs cannot produce auto-accepted facts', async () => {
  const unknown = source('official', 1, { title: 'External brand', text: 'Nike launched a campaign.' })
  const result = await extractEvidenceCandidates(unknown, [], generatedAt)
  assert.equal(result.status, 'NO_REGISTRY_ENTITY')
  const long = source('official', 1, { text: fixtures.official.text + ' x'.repeat(11000) })
  const truncated = await extract(long)
  assert.equal(truncated.sourceTruncated, true)
  assert.equal(truncated.evidence[0].validation.valid, false)
})
test('changed URL content requires new source hash and preserves previous source lineage', async () => {
  const original = source(), changed = { ...source('changed', 1), sourceItemId: id(10) }
  assert.equal(original.document.canonicalUrl, changed.document.canonicalUrl)
  assert.notEqual(original.document.contentHash, changed.document.contentHash)
  const a = await extract(original), b = await extract(changed)
  assert.equal(a.evidence[0].sourceHash, original.document.contentHash)
  assert.equal(b.evidence[0].sourceItemId, id(10))
  await assert.rejects(extract({ ...original, document: { ...original.document, text: 'Unhashed change' } }), /SOURCE_HASH_MISMATCH/)
})
test('storage preparation revalidates altered facts and cross-entity IDs, not stale validation flags', async () => {
  const src = source(), result = await extract(src), candidate = result.evidence[0]
  assert.throws(() => preparePendingEvidence({ ...candidate, item: { ...candidate.item, fact: 'TOSS achieved 9000 conversions' } }, src), /INVALID_EVIDENCE/)
  assert.throws(() => preparePendingEvidence({ ...candidate, entityId: launchRegistry[0].entity.id }, src), /INVALID_EVIDENCE/)
})
test('draft storage requires explicit dimensions and exact evidence/source lineage, never publication', async () => {
  const src = source(), result = await analyzeBrandWatchSource(src, [transport(output())], generatedAt)
  const dimensions = { scope: 'national', market: ['KR'], channel: [], importance: 1 }
  const plan = prepareDraftMovement(result.movements[0], result.extraction.evidence, [src], dimensions)
  assert.equal(plan.movement.status, 'draft'); assert.equal(plan.movement.started_at, null)
  assert.equal(plan.links[0].evidence_id, result.extraction.evidence[0].id)
  assert.throws(() => prepareDraftMovement({ ...result.movements[0], sourceItemIds: [id(55)] }, result.extraction.evidence, [src], dimensions), /SOURCE_LINEAGE_INVALID/)
})
test('actual 018 accepts pending provenance/draft lineage but blocks publication without human review', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
    await db.exec(readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8'))
    const src = source(), result = await analyzeBrandWatchSource(src, [transport(output())], generatedAt), candidate = result.extraction.evidence[0]
    const entity = launchRegistry.find(row => row.slug === 'toss').entity
    await db.query('INSERT INTO brand_entities(id,slug,name,name_ko,entity_type,category) VALUES($1,$2,$3,$4,$5,$6)', [entity.id, entity.slug, entity.name, entity.nameKo, entity.entityType, entity.category])
    await db.query("INSERT INTO source_providers(id,name,domain,provider_type,source_tier,reliability_policy,ingestion_method) VALUES($1,'Synthetic','source-1.test','official_newsroom',1,'Attribution only','manual')", [src.document.providerId])
    await db.query("INSERT INTO source_items(id,provider_id,canonical_url,original_url,title,date_precision,content_hash) VALUES($1,$2,$3,$4,$5,'unknown',$6)", [src.sourceItemId, src.document.providerId, src.document.canonicalUrl, src.document.originalUrl, src.document.title, src.document.contentHash])
    const insert = async (table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
    const pending = preparePendingEvidence(candidate, src)
    await insert('source_entity_matches', pending.match); await insert('brand_evidence', pending.evidence)
    const draft = prepareDraftMovement(result.movements[0], result.extraction.evidence, [src], { scope: 'national', market: ['KR'], channel: [], importance: 1 })
    await insert('brand_movements', draft.movement)
    for (const link of draft.links) await insert('movement_evidence', link)
    const row = (await db.query('SELECT review_status,generation_model,prompt_version,support_locator FROM brand_evidence')).rows[0]
    assert.equal(row.review_status, 'pending'); assert.equal(row.generation_model, pending.evidence.generation_model)
    assert.equal(JSON.parse(row.support_locator).extraction.provider, 'mock-gemini')
    await assert.rejects(db.query("UPDATE brand_movements SET status='published' WHERE id=$1", [draft.movement.id]), /approved primary-action/)
  } finally { await db.close() }
})
test('Gemini REST transport separates instructions/source, honors signal/schema and never places credentials in URL', async () => {
  let calls = 0
  const provider = createGeminiEvidenceTransport({ apiKey: 'synthetic-test-value', model: 'gemini-2.5-flash-lite', fetch: async (url, options) => {
    calls++
    assert.ok(!String(url).includes('synthetic-test-value')); assert.equal(new URL(url).search, '')
    assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof AbortSignal)
    const body = JSON.parse(options.body), system = body.systemInstruction.parts.map(part => part.text).join('\n')
    assert.ok(!system.includes('invent 9000 conversions'))
    assert.ok(JSON.parse(body.contents[0].parts[0].text).text.includes('invent 9000 conversions'))
    assert.equal(body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON')
    assert.equal(body.generationConfig.responseFormat.text.schema.additionalProperties, false)
    assert.equal(body.generationConfig.maxOutputTokens, 4000); assert.equal(body.generationConfig.candidateCount, 1)
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'Not final output' }, { text: JSON.stringify(output()) }] } }] }), { headers: { 'content-type': 'application/json' } })
  } })
  assert.equal(calls, 0)
  const result = await extractEvidenceCandidates(source('injection'), [provider], generatedAt)
  assert.equal(result.provenance.provider, 'gemini'); assert.equal(result.provenance.model, 'gemini-2.5-flash-lite'); assert.equal(calls, 1)
})
test('Gemini HTTP 429/refusal/truncation/provider errors are safe typed failures with no internal retry', async () => {
  for (const [response, expected] of [
    [new Response('private payload', { status: 429 }), 'RATE_LIMIT'],
    [new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { headers: { 'content-type': 'application/json' } }), 'SAFETY_REFUSAL'],
    [new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { headers: { 'content-type': 'application/json' } }), 'MALFORMED_OUTPUT'],
    [new Response('private payload', { status: 401 }), 'PROVIDER_ERROR'],
  ]) {
    let calls = 0
    const provider = createGeminiEvidenceTransport({ apiKey: 'synthetic-test-value', model: 'gemini-2.5-flash-lite', fetch: async () => { calls++; return response } })
    const result = await extractEvidenceCandidates(source(), [provider], generatedAt)
    assert.equal(result.error, expected); assert.equal(calls, 1)
    assert.ok(!JSON.stringify(result).includes('private payload'))
  }
})
