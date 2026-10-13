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
const { launchRegistry } = load(root + 'registry.ts')
const { patternAIOutputSchema, patternPolicySchema, patternEngineInputSchema } = load(root + 'patterns/schemas.ts')
const { assessPatternEligibility, countIndependence } = load(root + 'patterns/eligibility.ts')
const { generatePatternCandidates } = load(root + 'patterns/generate.ts')
const { classifyPatternCandidate } = load(root + 'patterns/duplicates.ts')
const { preparePatternDraft } = load(root + 'patterns/storage.ts')
const patternModules = ['schemas', 'eligibility', 'prompts', 'duplicates', 'generate', 'storage'].map(name => load(root + `patterns/${name}.ts`))

const MUSINSA = launchRegistry.find(row => row.slug === 'musinsa').entity.id, TOSS = launchRegistry.find(row => row.slug === 'toss').entity.id
const id = n => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const generatedAt = '2026-10-13T12:00:00Z', policy = patternPolicySchema.parse({})
const confidence = { score: 0.9, basis: 'Three approved movements in six weeks share a beauty focus.' }
function evidence(n, changes = {}, source = {}) {
  return { id: id(n), entityId: MUSINSA, sourceItemId: id(100 + n), fact: `Approved fact ${n}`, eventDate: '2026-09-01', reviewStatus: 'approved', status: 'active', marketingRelevance: 1, matchRole: 'primary', matchReviewStatus: 'approved',
    source: { providerId: id(200 + n), providerType: 'industry_media', canonicalUrl: `https://p${n}.example.test/story`, contentHash: String(n % 10).repeat(64), publishedAt: null, ...source }, ...changes }
}
function movement(n, title, type, day, evidenceRows, changes = {}) {
  return { id: id(n), entityId: MUSINSA, eventKey: `event-${n}`, title, summary: title, movementType: type, status: 'published', mergedIntoId: null, startedAt: null, lastObservedAt: `${day}T09:00:00Z`, evidence: evidenceRows.map(row => ({ ...row, eventDate: row.eventDate === '2026-09-01' ? day : row.eventDate })), ...changes }
}
// Scenario A: three distinct approved beauty movements of one brand.
const festa = () => movement(1, 'MUSINSA Beauty Festa', 'campaign', '2026-09-01', [evidence(11)])
const store = () => movement(2, 'Beauty specialty store expansion', 'platform', '2026-09-15', [evidence(12)])
const creator = () => movement(3, 'Beauty creator campaign', 'creator', '2026-10-01', [evidence(13)])
const pattern = (changes = {}) => ({ title: 'Recurring beauty-related marketing activity', description: 'Approved movements show beauty-related marketing activity recurring across a festival, a store expansion and a creator campaign.', movementIds: [id(1), id(2), id(3)], evidenceIds: [id(11), id(12), id(13)], uncertainties: ['Six-week window only.'], confidence, ...changes })
const output = (patterns = [pattern()]) => ({ patterns, noPatternReason: patterns.length ? null : 'No recurrence.' })
function transport(value = output()) {
  const provider = { provider: 'mock-gemini', model: 'fixture-model-v1', calls: [], async generate(request) { provider.calls.push(request); return { kind: 'text', text: JSON.stringify(value) } } }
  return provider
}
const run = (movements, value, existingPatterns = [], policyInput = {}) => { const provider = transport(value); return generatePatternCandidates({ entityId: MUSINSA, movements, existingPatterns }, [provider], generatedAt, policyInput).then(result => ({ result, provider })) }

test('A: three distinct approved movements produce one needs_review observed pattern with computed lineage', async () => {
  const { result, provider } = await run([festa(), store(), creator()])
  assert.equal(result.status, 'PATTERN_CANDIDATES'); assert.equal(provider.calls.length, 1)
  const [candidate] = result.candidates
  assert.equal(candidate.reviewStatus, 'needs_review')
  assert.deepEqual([candidate.independentMovementCount, candidate.independentSourceCount, candidate.sourceItemCount], [3, 3, 3])
  assert.deepEqual([candidate.windowStart, candidate.windowEnd, candidate.lastSupportingMovementAt], ['2026-09-01', '2026-10-01', '2026-10-01T09:00:00Z'])
  assert.deepEqual(candidate.movementIds, [id(1), id(2), id(3)]); assert.deepEqual(candidate.evidenceIds, [id(11), id(12), id(13)])
  assert.deepEqual(candidate.provenance, { provider: 'mock-gemini', model: 'fixture-model-v1', promptVersion: 'pattern-v1', pipelineVersion: 'pattern-engine-v1', generatedAt })
  assert.equal(candidate.confidence.score, 0.75); assert.equal(candidate.duplicate.decision, 'NEW')
  assert.ok(candidate.uncertainties.includes('Six-week window only.'))
})

test('pattern-v1 request carries reviewed facts and metadata only, with eligible IDs as trusted context', async () => {
  const draft = movement(4, 'Draft-only secret title', 'campaign', '2026-09-20', [evidence(14)], { status: 'draft' })
  const { provider } = await run([festa(), store(), creator(), draft])
  const request = provider.calls[0]
  assert.match(request.system, /OBSERVED PATTERNS/); assert.match(request.system, /strategy, intent/)
  assert.deepEqual(request.trustedContext.allowedMovementIds, [id(1), id(2), id(3)]); assert.equal(request.trustedContext.promptVersion, 'pattern-v1')
  const data = JSON.parse(request.sourceData)
  assert.equal(data.type, 'PATTERN_DATA'); assert.ok(!request.sourceData.includes('Draft-only secret title'))
  assert.deepEqual(Object.keys(data.movements[0].evidence[0]).sort(), ['eventDate', 'fact', 'id', 'providerType', 'publishedAt'])
  assert.equal(request.responseSchema.additionalProperties, false)
})

test('1-5 C/D: only approved, unmerged, same-entity movements with intact relevant lineage are eligible', () => {
  const cases = [
    [movement(4, 'Draft', 'campaign', '2026-09-20', [evidence(14)], { status: 'draft' }), 'NOT_APPROVED'],
    [movement(5, 'Rejected', 'campaign', '2026-09-20', [evidence(15)], { status: 'withdrawn' }), 'REJECTED'],
    [movement(6, 'Superseded', 'campaign', '2026-09-20', [evidence(16)], { status: 'superseded', mergedIntoId: id(1) }), 'SUPERSEDED'],
    [movement(7, 'Other brand', 'campaign', '2026-09-20', [evidence(17, { entityId: TOSS })], { entityId: TOSS }), 'OTHER_ENTITY'],
    [movement(8, 'Pending evidence', 'campaign', '2026-09-20', [evidence(18, { reviewStatus: 'pending' })]), 'BROKEN_EVIDENCE_LINEAGE'],
    [movement(9, 'Withdrawn evidence', 'campaign', '2026-09-20', [evidence(19, { status: 'withdrawn' })]), 'BROKEN_EVIDENCE_LINEAGE'],
    [movement(10, 'Mention only', 'campaign', '2026-09-20', [evidence(20, { matchRole: 'mentioned' })]), 'UNAPPROVED_ACTOR_ROLE'],
    [movement(21, 'Irrelevant', 'campaign', '2026-09-20', [evidence(22, { marketingRelevance: 0 })]), 'NOT_MARKETING_RELEVANT'],
    [movement(23, 'Uncertain only', 'campaign', '2026-09-20', [evidence(24, { marketingRelevance: 0.5 })]), 'NOT_MARKETING_RELEVANT'],
    [movement(25, 'No evidence', 'campaign', '2026-09-20', []), 'NO_EVIDENCE_LINEAGE'],
    [movement(26, 'Old', 'campaign', '2026-03-01', [evidence(27)]), 'OUTSIDE_RECENCY_WINDOW'],
  ]
  const gate = assessPatternEligibility(MUSINSA, [festa(), ...cases.map(([row]) => row)], generatedAt, policy)
  assert.deepEqual(gate.eligible.map(row => row.movement.id), [id(1)])
  for (const [row, reason] of cases) assert.ok(gate.excluded.find(entry => entry.movementId === row.id).reasons.includes(reason), reason)
  // Recency is policy, not a constant.
  assert.equal(assessPatternEligibility(MUSINSA, [cases.at(-1)[0]], generatedAt, patternPolicySchema.parse({ recencyDays: 365 })).eligible.length, 1)
})

test('C: one approved plus one needs_review movement yields no pattern and no AI call', async () => {
  const { result, provider } = await run([festa(), movement(4, 'Draft beauty pop-up', 'campaign', '2026-09-20', [evidence(14)], { status: 'draft' })])
  assert.equal(result.status, 'INSUFFICIENT_INDEPENDENT_MOVEMENTS'); assert.equal(provider.calls.length, 0); assert.deepEqual(result.candidates, [])
})

test('D: movements of different brand entities are never grouped', async () => {
  const toss = movement(4, 'Toss beauty sponsorship', 'campaign', '2026-09-20', [evidence(14, { entityId: TOSS })], { entityId: TOSS })
  const alone = await run([festa(), toss])
  assert.equal(alone.result.status, 'INSUFFICIENT_INDEPENDENT_MOVEMENTS')
  const mixed = await run([festa(), store(), toss], output([pattern({ movementIds: [id(1), id(4)], evidenceIds: [id(11)] })]))
  assert.deepEqual(mixed.result.rejected, [{ index: 0, issues: ['INELIGIBLE_MOVEMENT_ID', 'INSUFFICIENT_INDEPENDENT_MOVEMENTS'] }])
  assert.equal(mixed.result.candidates.length, 0)
})

test('6-7 B: many reports of one event count as one movement; duplicate event descriptions collapse', async () => {
  const reports = [11, 12, 13, 14, 15].map(n => evidence(n))
  const { result, provider } = await run([movement(1, 'MUSINSA Beauty Festa', 'campaign', '2026-09-01', reports)])
  assert.equal(result.status, 'INSUFFICIENT_INDEPENDENT_MOVEMENTS'); assert.equal(provider.calls.length, 0)
  assert.deepEqual([result.independence.independentMovementCount, result.independence.sourceItemCount], [1, 5])
  // Same event recorded twice (shared evidence, or near-identical title within days) is one event.
  for (const twin of [movement(2, 'Different label', 'campaign', '2026-09-01', [evidence(11)]), movement(2, 'MUSINSA Beauty Festa', 'campaign', '2026-09-03', [evidence(16)])]) {
    const counted = countIndependence(assessPatternEligibility(MUSINSA, [festa(), twin], generatedAt, policy).eligible, policy)
    assert.equal(counted.independentMovementCount, 1); assert.equal(counted.sameEventPairs.length, 1)
  }
  assert.throws(() => patternPolicySchema.parse({ minIndependentMovements: 1 }))
})

test('8-9: movement and source independence are counted separately and conservatively', () => {
  const sameProvider = { providerId: id(200) }
  const rows = [
    movement(1, 'Beauty Festa', 'campaign', '2026-09-01', [evidence(11, {}, sameProvider), evidence(12)]),
    movement(2, 'Store expansion', 'platform', '2026-09-15', [evidence(13, {}, sameProvider)]),
    // Syndicated copy: different provider/URL, identical content hash.
    movement(3, 'Creator campaign', 'creator', '2026-10-01', [evidence(22, {}, { contentHash: '2'.repeat(64) })]),
  ]
  const counted = countIndependence(assessPatternEligibility(MUSINSA, rows, generatedAt, policy).eligible, policy)
  assert.deepEqual([counted.independentMovementCount, counted.sourceItemCount, counted.independentSourceCount], [3, 4, 2])
})

test('E/11: hallucinated or unreachable IDs reject the candidate; valid siblings survive', async () => {
  const { result } = await run([festa(), store(), creator()], output([pattern({ movementIds: [id(1), id(999)] }), pattern({ evidenceIds: [id(11), id(998)] }), pattern()]))
  assert.deepEqual(result.rejected.map(row => [row.index, row.issues[0]]), [[0, 'HALLUCINATED_MOVEMENT_ID'], [1, 'HALLUCINATED_OR_UNREACHABLE_EVIDENCE_ID']])
  assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].movementIds.length, 3)
  // Real evidence of a movement outside the cited set is unreachable lineage.
  const { result: unreachable } = await run([festa(), store(), creator()], output([pattern({ movementIds: [id(1), id(2)], evidenceIds: [id(13)] })]))
  assert.deepEqual([unreachable.status, unreachable.rejected[0].issues], ['NO_PATTERN', ['HALLUCINATED_OR_UNREACHABLE_EVIDENCE_ID']])
})

test('12: strict schemas reject unknown AI fields, approval attempts and unknown input fields', async () => {
  assert.ok(patternAIOutputSchema.safeParse(output()).success)
  for (const value of [output([{ ...pattern(), approved: true }]), { ...output(), publish: true }, output([pattern({ movementIds: [id(1), id(1)] })])]) {
    const { result } = await run([festa(), store(), creator()], value)
    assert.deepEqual([result.status, result.error, result.candidates.length], ['AI_FAILURE', 'SCHEMA_FAILURE', 0])
  }
  assert.ok(!patternEngineInputSchema.safeParse({ entityId: MUSINSA, movements: [{ ...festa(), approved: true }], existingPatterns: [] }).success)
})

test('observed pattern rejects strategic intent or forecasts (interpretation is a future Take)', async () => {
  const { result } = await run([festa(), store(), creator()], output([
    pattern({ description: '무신사는 패션을 버리고 뷰티 기업으로 전환하려 한다.' }),
    pattern({ title: 'MUSINSA pivots to beauty' }),
    pattern({ description: 'MUSINSA will expand beauty further.' }),
  ]))
  assert.equal(result.candidates.length, 0)
  assert.ok(result.rejected.every(row => row.issues.includes('INTERPRETATION_NOT_ALLOWED')))
})

test('13: window uses reviewed event days, flags observation fallback, and ignores publication order', async () => {
  const late = movement(3, 'Beauty creator campaign', 'creator', '2026-10-01', [evidence(13, { eventDate: null })], { lastObservedAt: '2026-10-05T00:00:00Z' })
  const early = movement(1, 'MUSINSA Beauty Festa', 'campaign', '2026-08-20', [evidence(11)], { startedAt: '2026-08-18T00:00:00Z' })
  const { result } = await run([late, store(), early])
  const [candidate] = result.candidates
  assert.deepEqual([candidate.windowStart, candidate.windowEnd, candidate.lastSupportingMovementAt], ['2026-08-18', '2026-10-05', '2026-10-05T00:00:00Z'])
  assert.ok(candidate.uncertainties.some(text => /observation time/.test(text)))
})

test('F/14: existing patterns yield possible duplicate or revision candidates, never overwrite', async () => {
  const existing = (n, movementIds, status, title = 'Unrelated', revision = 1) => ({ id: id(n), entityId: MUSINSA, title, status, revision, movementIds })
  const candidate = { entityId: MUSINSA, title: 'Recurring beauty-related marketing activity', movementIds: [id(1), id(2), id(3)] }
  assert.equal(classifyPatternCandidate(candidate, [], policy).decision, 'NEW')
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(7), id(8)], 'published')], policy).decision, 'NEW')
  assert.deepEqual(classifyPatternCandidate(candidate, [existing(50, [id(1), id(2)], 'published', 'Beauty activity', 2)], policy), { decision: 'REVISION_CANDIDATE', matchedPatternId: id(50), revision: 3, matches: [{ patternId: id(50), overlap: 2 / 3, titleSimilarity: 2 / 5 }] })
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(1), id(2), id(3)], 'published')], policy).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(1), id(2)], 'draft')], policy).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(7), id(8)], 'published', 'Recurring beauty-related marketing activity')], policy).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(1), id(2)], 'published'), existing(51, [id(2), id(3)], 'published')], policy).decision, 'POSSIBLE_DUPLICATE')
  assert.equal(classifyPatternCandidate(candidate, [existing(50, [id(1), id(2), id(3)], 'superseded'), { ...existing(51, [id(1), id(2), id(3)], 'published'), entityId: TOSS }], policy).decision, 'NEW')
  const { result } = await run([festa(), store(), creator()], output(), [existing(50, [id(1), id(2)], 'published')])
  assert.equal(result.candidates[0].duplicate.decision, 'REVISION_CANDIDATE')
})

test('10/15: prepared storage is draft only and the engine exposes no approve/publish path', async () => {
  const { result } = await run([festa(), store(), creator()])
  const plan = preparePatternDraft(result.candidates[0])
  assert.equal(plan.pattern.status, 'draft'); assert.equal(plan.pattern.revision, 1); assert.equal(plan.pattern.supersedes_id, null)
  assert.deepEqual(plan.links.map(row => row.movement_id), [id(1), id(2), id(3)])
  assert.throws(() => preparePatternDraft({ ...result.candidates[0], reviewStatus: 'approved' }))
  assert.throws(() => preparePatternDraft({ ...result.candidates[0], duplicate: { ...result.candidates[0].duplicate, decision: 'POSSIBLE_DUPLICATE', matchedPatternId: id(50) } }), /DUPLICATE_REVIEW_REQUIRED/)
  for (const exported of patternModules.flatMap(module => Object.keys(module))) assert.doesNotMatch(exported, /publish|approve/i)
})

test('actual 018 stores pattern drafts and revision successors without touching the published predecessor', async () => {
  assert.ok(process.env.PGLITE_MODULE, 'Local PostgreSQL runtime required; do not skip')
  const { PGlite } = require(process.env.PGLITE_MODULE), db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE articles(id uuid PRIMARY KEY);')
    await db.exec(readFileSync('supabase/migrations/018_brand_watch_foundation.sql', 'utf8'))
    for (const file of ['019_brand_watch_review_commands', '020_brand_watch_analysis_lifecycle']) await db.exec(readFileSync(`supabase/migrations/${file}.sql`, 'utf8'))
    const insert = async (table, row) => { const keys = Object.keys(row); await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((key, index) => '$' + (index + 1)).join(',')})`, Object.values(row)) }
    const entity = launchRegistry.find(row => row.slug === 'musinsa').entity
    await insert('brand_entities', { id: entity.id, slug: entity.slug, name: entity.name, name_ko: entity.nameKo, entity_type: entity.entityType, category: entity.category })
    // Mirror the synthetic engine input as reviewed 018 rows.
    const movements = [festa(), store(), creator()]
    for (const row of movements) {
      for (const ev of row.evidence) {
        await insert('source_providers', { id: ev.source.providerId, name: 'Synthetic', domain: new URL(ev.source.canonicalUrl).hostname, provider_type: ev.source.providerType, source_tier: 2, reliability_policy: 'Attribution only', ingestion_method: 'manual' })
        await insert('source_items', { id: ev.sourceItemId, provider_id: ev.source.providerId, canonical_url: ev.source.canonicalUrl, original_url: ev.source.canonicalUrl, title: 'Synthetic', date_precision: 'unknown', content_hash: ev.source.contentHash })
        await insert('source_entity_matches', { source_item_id: ev.sourceItemId, entity_id: entity.id, role: 'primary', confidence: 1, method: 'manual', review_status: 'approved' })
        await insert('brand_evidence', { id: ev.id, entity_id: entity.id, source_item_id: ev.sourceItemId, fact: ev.fact, support_text: 'Synthetic support', event_date: ev.eventDate, date_precision: 'day', marketing_relevance: 1, confidence: 1, extraction_method: 'manual', review_status: 'approved' })
      }
      await insert('brand_movements', { id: row.id, entity_id: entity.id, event_key: row.eventKey, title: row.title, summary: row.summary, movement_type: row.movementType, scope: 'national', importance: 1, last_observed_at: row.lastObservedAt })
      for (const ev of row.evidence) await insert('movement_evidence', { entity_id: entity.id, movement_id: row.id, evidence_id: ev.id })
      await db.query("UPDATE brand_movements SET status='published' WHERE id=$1", [row.id])
    }
    // An earlier reviewed pattern over two of the movements.
    await insert('brand_patterns', { id: id(50), entity_id: entity.id, title: 'Beauty activity', description: 'Earlier reviewed pattern', window_start: '2026-09-01', window_end: '2026-09-15', confidence: 0.6 })
    for (const n of [1, 2]) await insert('pattern_movements', { entity_id: entity.id, pattern_id: id(50), movement_id: id(n) })
    await db.query("UPDATE brand_patterns SET status='published' WHERE id=$1", [id(50)])
    const existingPatterns = [{ id: id(50), entityId: entity.id, title: 'Beauty activity', status: 'published', revision: 1, movementIds: [id(1), id(2)] }]
    const { result } = await run(movements, output(), existingPatterns)
    const plan = preparePatternDraft(result.candidates[0])
    assert.deepEqual([plan.pattern.supersedes_id, plan.pattern.revision], [id(50), 2])
    await db.exec('BEGIN'); await insert('brand_patterns', plan.pattern); for (const link of plan.links) await insert('pattern_movements', link); await db.exec('COMMIT')
    assert.deepEqual((await db.query('SELECT id,status,revision FROM brand_patterns ORDER BY revision')).rows.map(row => [row.id, row.status, row.revision]), [[id(50), 'published', 1], [plan.pattern.id, 'draft', 2]])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM pattern_movements WHERE pattern_id=$1', [id(50)])).rows[0].n, 2)
    // A competing successor of the same predecessor is refused by 018; history is not overwritten.
    const { result: again } = await run(movements, output(), existingPatterns)
    await assert.rejects(insert('brand_patterns', preparePatternDraft(again.candidates[0]).pattern), /brand_patterns_successor_idx|duplicate key/)
  } finally { await db.close() }
})
